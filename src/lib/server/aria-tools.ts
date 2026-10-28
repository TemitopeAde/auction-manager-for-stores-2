import type {
  AppSettings,
  AuctionInput,
  AuctionStatus,
  AuctionView,
  BidSummary,
} from '../auction/types';
import { DEFAULT_SETTINGS, EMPTY_AUCTION_INPUT } from '../auction/defaults';
import { saveConfigurationSettings } from './configuration-repository';
import { findAuctionsByProductIds } from './auction-repository';
import {
  createAuctionFromProduct,
  getAuctionSummary,
  getAuctionView,
  withoutDashboardPayload,
  getSettings,
  runAuctionAction,
  searchAuctionBids,
  searchDashboardAuctions,
  searchDashboardLeads,
  searchDashboardProducts,
  updateAuction,
} from './auction-service';

/**
 * Handlers for the tools declared in the `auction-tools` App Tools extension.
 * Each handler validates its payload (Wix does not validate it against the
 * declared schema) and returns a compact DTO rather than full dashboard state.
 */

type Payload = Record<string, unknown>;

const AUCTION_STATUSES: ReadonlyArray<AuctionStatus> = [
  'draft',
  'scheduled',
  'live',
  'endingSoon',
  'paused',
  'closed',
  'reserveNotMet',
  'sold',
];

const LIFECYCLE_ACTIONS = ['publish', 'draft', 'pause', 'resume', 'close'] as const;
type LifecycleAction = (typeof LIFECYCLE_ACTIONS)[number];

const EDITABLE_SETTINGS = [
  'businessName',
  'defaultMinIncrement',
  'antiSnipingEnabled',
  'antiSnipingWindowSeconds',
  'antiSnipingExtensionSeconds',
  'emailBiddingEnabled',
  'emailWinnerPaymentLinkEnabled',
  'outbidNotificationEnabled',
  'winnerCheckoutEmailEnabled',
  'bidderConfirmationEnabled',
  'whatsappPhone',
  'myBidsPageUrl',
  'blockCartAndCheckout',
  'blockAllCartAndCheckout',
  'combinedWinnerCheckoutEnabled',
] as const satisfies ReadonlyArray<keyof AppSettings>;

const MAX_PAGE_SIZE = 50;
const DEFAULT_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export class ToolInputError extends Error {}

function readString(payload: Payload, key: string, options: { required: true }): string;
function readString(payload: Payload, key: string, options?: { required?: false }): string | undefined;
function readString(payload: Payload, key: string, options?: { required?: boolean }): string | undefined {
  const value = payload[key];
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (options?.required) {
    throw new ToolInputError(`"${key}" is required.`);
  }
  return undefined;
}

function readNumber(payload: Payload, key: string): number | undefined {
  const value = payload[key];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new ToolInputError(`"${key}" must be a number.`);
  }
  return parsed;
}

function readBoolean(payload: Payload, key: string): boolean | undefined {
  const value = payload[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  throw new ToolInputError(`"${key}" must be true or false.`);
}

function readDate(payload: Payload, key: string): string | undefined {
  const value = readString(payload, key);
  if (value === undefined) {
    return undefined;
  }
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    throw new ToolInputError(`"${key}" must be an ISO 8601 date-time, for example 2026-11-01T18:00:00Z.`);
  }
  return new Date(time).toISOString();
}

function readPaging(payload: Payload): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(readNumber(payload, 'page') ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(readNumber(payload, 'pageSize') ?? 20)));
  return { page, pageSize };
}

function toAuctionSummary(auction: AuctionView) {
  return {
    id: auction.id,
    title: auction.title,
    status: auction.status,
    lifecycle: auction.lifecycle,
    productId: auction.productIds[0] ?? null,
    startingPrice: auction.startingPrice,
    reservePrice: auction.reservePrice,
    reserveReached: auction.reserveReached,
    currentHighestBid: auction.currentHighestBid,
    minimumNextBid: auction.minimumNextBid,
    bidCount: auction.bidCount,
    startTime: auction.startTime,
    endTime: auction.endTime || null,
    winner: auction.winner ? toBidSummaryDto(auction.winner) : null,
  };
}

function toBidSummaryDto(bid: BidSummary) {
  return {
    id: bid.id,
    bidderName: bid.bidderName,
    bidderEmail: bid.bidderEmail,
    amount: bid.amount,
    createdAt: bid.createdAt,
    isMember: Boolean(bid.bidderMemberId),
    variantLabel: bid.variantLabel,
  };
}

async function requireAuctionView(auctionId: string): Promise<AuctionView> {
  const auction = await getAuctionView(auctionId);
  if (!auction) {
    throw new ToolInputError(`Auction ${auctionId} was not found.`);
  }
  return auction;
}

function readAuctionFields(payload: Payload): Partial<AuctionInput> {
  const fields: Partial<AuctionInput> = {};
  const title = readString(payload, 'title');
  const description = readString(payload, 'description');
  const startingPrice = readNumber(payload, 'startingPrice');
  const minIncrement = readNumber(payload, 'minIncrement');
  const startTime = readDate(payload, 'startTime');
  const endTime = readDate(payload, 'endTime');
  const antiSnipingEnabled = readBoolean(payload, 'antiSnipingEnabled');

  if (title !== undefined) fields.title = title;
  if (description !== undefined) fields.description = description;
  if (startingPrice !== undefined) fields.startingPrice = startingPrice;
  if (minIncrement !== undefined) fields.minIncrement = minIncrement;
  if (startTime !== undefined) fields.startTime = startTime;
  if (endTime !== undefined) fields.endTime = endTime;
  if (antiSnipingEnabled !== undefined) fields.antiSnipingEnabled = antiSnipingEnabled;
  if ('reservePrice' in payload) {
    fields.reservePrice = payload.reservePrice === null ? null : readNumber(payload, 'reservePrice') ?? null;
  }

  return fields;
}

async function getAuctionOverview() {
  const { settings, auctions, summary } = await getAuctionSummary();
  const nextToEnd = auctions
    .filter((auction) => auction.status === 'endingSoon' || auction.status === 'live')
    .sort((left, right) => (left.endTime || '9999').localeCompare(right.endTime || '9999'))
    .slice(0, 5)
    .map(toAuctionSummary);

  return { planTier: settings.planTier, summary, nextToEnd };
}

async function listAuctions(payload: Payload) {
  const status = readString(payload, 'status');
  if (status && status !== 'all' && !AUCTION_STATUSES.includes(status as AuctionStatus)) {
    throw new ToolInputError(`"status" must be one of: all, ${AUCTION_STATUSES.join(', ')}.`);
  }

  const result = await searchDashboardAuctions({
    search: readString(payload, 'search'),
    status: (status as AuctionStatus | 'all' | undefined) ?? 'all',
    activeOnly: readBoolean(payload, 'activeOnly'),
    ...readPaging(payload),
  });

  return { total: result.total, auctions: result.rows.map(toAuctionSummary) };
}

async function getAuctionBids(payload: Payload) {
  const winner = readString(payload, 'winner');
  const result = await searchAuctionBids({
    auctionId: readString(payload, 'auctionId', { required: true }),
    search: readString(payload, 'search'),
    winner: winner === 'winner' || winner === 'others' ? winner : 'all',
    ...readPaging(payload),
  });

  return { total: result.total, bids: result.rows.map(toBidSummaryDto) };
}

async function searchStoreProducts(payload: Payload) {
  const auctionLink = readString(payload, 'auctionLink');
  const result = await searchDashboardProducts({
    search: readString(payload, 'search'),
    auctionLink: auctionLink === 'linked' || auctionLink === 'unlinked' ? auctionLink : 'all',
    ...readPaging(payload),
  });

  return {
    total: result.total,
    products: result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      auctions: row.auctions.map((auction) => ({
        id: auction.id,
        title: auction.title,
        status: auction.status,
      })),
    })),
  };
}

async function createAuction(payload: Payload) {
  const productId = readString(payload, 'productId', { required: true });
  const fields = readAuctionFields(payload);
  if (fields.startingPrice === undefined) {
    throw new ToolInputError('"startingPrice" is required.');
  }

  const publish = readBoolean(payload, 'publish') ?? false;
  const startTime = fields.startTime ?? new Date().toISOString();
  await withoutDashboardPayload(() =>
    createAuctionFromProduct(productId, {
      ...EMPTY_AUCTION_INPUT,
      ...fields,
      startTime,
      // The feature spec's default duration; the service itself treats a missing end as open-ended.
      endTime: fields.endTime ?? new Date(new Date(startTime).getTime() + DEFAULT_DURATION_MS).toISOString(),
      lifecycle: publish ? 'published' : 'draft',
    }),
  );

  const created = (await findAuctionsByProductIds([productId])).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )[0];
  const view = created ? await getAuctionView(created.id) : null;
  return { auction: view ? toAuctionSummary(view) : null };
}

async function updateAuctionTool(payload: Payload) {
  const auctionId = readString(payload, 'auctionId', { required: true });
  const fields = readAuctionFields(payload);
  if (Object.keys(fields).length === 0) {
    throw new ToolInputError('Provide at least one field to update.');
  }

  await withoutDashboardPayload(() => updateAuction(auctionId, fields));
  return { auction: toAuctionSummary(await requireAuctionView(auctionId)) };
}

async function runLifecycleAction(payload: Payload) {
  const auctionId = readString(payload, 'auctionId', { required: true });
  const action = readString(payload, 'action', { required: true });
  if (!LIFECYCLE_ACTIONS.includes(action as LifecycleAction)) {
    throw new ToolInputError(`"action" must be one of: ${LIFECYCLE_ACTIONS.join(', ')}.`);
  }

  await withoutDashboardPayload(() => runAuctionAction(auctionId, action as LifecycleAction));
  return { auction: toAuctionSummary(await requireAuctionView(auctionId)) };
}

async function searchLeads(payload: Payload) {
  const result = await searchDashboardLeads({
    search: readString(payload, 'search'),
    auctionId: readString(payload, 'auctionId') ?? 'all',
    ...readPaging(payload),
  });

  return {
    total: result.total,
    leads: result.rows.map(({ auction, bid }) => ({
      bidderName: bid.bidderName,
      bidderEmail: bid.bidderEmail,
      bidderPhone: bid.bidderPhone,
      amount: bid.amount,
      createdAt: bid.createdAt,
      auctionId: auction.id,
      auctionTitle: auction.title,
    })),
  };
}

async function updateSettings(payload: Payload) {
  const changes: Partial<AppSettings> = {};

  for (const key of EDITABLE_SETTINGS) {
    if (!(key in payload)) {
      continue;
    }
    // Validate against the setting's type in the defaults, so no read is needed first.
    const defaultValue = DEFAULT_SETTINGS[key];
    const nextValue =
      typeof defaultValue === 'boolean'
        ? readBoolean(payload, key)
        : typeof defaultValue === 'number'
          ? readNumber(payload, key)
          : typeof payload[key] === 'string'
            ? (payload[key] as string).trim()
            : undefined;

    if (nextValue === undefined) {
      throw new ToolInputError(`"${key}" has an invalid value.`);
    }
    Object.assign(changes, { [key]: nextValue });
  }

  if (Object.keys(changes).length === 0) {
    throw new ToolInputError(`Provide at least one setting to change: ${EDITABLE_SETTINGS.join(', ')}.`);
  }

  // One read and one write: saveConfigurationSettings merges onto the stored
  // settings itself, so this stays fast enough for a Tools Provider call.
  const saved = await saveConfigurationSettings(changes);
  return { updated: Object.keys(changes), settings: saved };
}

export const TOOL_HANDLERS: Record<string, (payload: Payload) => Promise<Record<string, unknown>>> = {
  'get-auction-overview': () => getAuctionOverview(),
  'list-auctions': listAuctions,
  'get-auction-bids': getAuctionBids,
  'search-store-products': searchStoreProducts,
  'create-auction': createAuction,
  'update-auction': updateAuctionTool,
  'run-auction-action': runLifecycleAction,
  'search-leads': searchLeads,
  'get-settings': async () => ({ settings: await getSettings() }),
  'update-settings': updateSettings,
};
