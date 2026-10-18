import { items } from '@wix/data';
import { queryAll } from './wix-data-utils';

import type { AuctionInput, AuctionLifecycle, AuctionRecord } from '../auction/types';

export const AUCTIONS_COLLECTION_ID = '@hi-konsult/smart-auction-manager/Auctions';

interface AuctionCollectionItem {
  _id: string;
  title?: string;
  description?: string;
  imageUrls?: string[];
  startingPrice?: number;
  reservePrice?: number | null;
  startTime?: Date | string;
  endTime?: Date | string;
  lifecycle?: AuctionLifecycle;
  minIncrement?: number | null;
  antiSnipingEnabled?: boolean;
  antiSnipingWindowSeconds?: number;
  antiSnipingExtensionSeconds?: number;
  winnerBidId?: string | null;
  winnerCheckoutId?: string | null;
  winnerCheckoutUrl?: string | null;
  winnerCheckoutRecipientEmail?: string | null;
  winnerCheckoutEmailSentAt?: Date | string | null;
  winnerPaymentUrl?: string | null;
  winnerPaymentButtonLabel?: string | null;
  winnerPaymentEmailSentAt?: Date | string | null;
  winnerPaymentEmailAttemptKey?: string | null;
  winnerPaymentEmailLastSentKey?: string | null;
  pausedAt?: Date | string | null;
  pausedStartDelayMs?: number | null;
  pausedTimeRemainingMs?: number | null;
  paymentMade?: boolean;
  productIds?: string[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

function toIsoString(value: Date | string | undefined | null): string {
  if (!value) {
    return new Date().toISOString();
  }

  return new Date(value).toISOString();
}

function toOptionalIsoString(value: Date | string | undefined | null): string {
  if (!value) {
    return '';
  }

  const iso = new Date(value).toISOString();
  return Number.isNaN(new Date(iso).getTime()) ? '' : iso;
}

function toOptionalDate(value: string | undefined | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeAuctionRecord(item: AuctionCollectionItem): AuctionRecord {
  return {
    id: item._id,
    title: item.title ?? '',
    description: item.description ?? '',
    imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls : [],
    startingPrice: typeof item.startingPrice === 'number' ? item.startingPrice : 0,
    reservePrice:
      typeof item.reservePrice === 'number' ? item.reservePrice : item.reservePrice ?? null,
    startTime: toIsoString(item.startTime),
    endTime: toOptionalIsoString(item.endTime),
    lifecycle: item.lifecycle ?? 'draft',
    minIncrement:
      typeof item.minIncrement === 'number' ? item.minIncrement : item.minIncrement ?? null,
    antiSnipingEnabled: Boolean(item.antiSnipingEnabled),
    antiSnipingWindowSeconds:
      typeof item.antiSnipingWindowSeconds === 'number'
        ? item.antiSnipingWindowSeconds
        : 60,
    antiSnipingExtensionSeconds:
      typeof item.antiSnipingExtensionSeconds === 'number'
        ? item.antiSnipingExtensionSeconds
        : 60,
    winnerBidId: item.winnerBidId ?? null,
    winnerCheckoutId: item.winnerCheckoutId ?? null,
    winnerCheckoutUrl: item.winnerCheckoutUrl ?? null,
    winnerCheckoutRecipientEmail: item.winnerCheckoutRecipientEmail ?? null,
    winnerCheckoutEmailSentAt: item.winnerCheckoutEmailSentAt
      ? toIsoString(item.winnerCheckoutEmailSentAt)
      : null,
    winnerPaymentUrl: item.winnerPaymentUrl ?? null,
    winnerPaymentButtonLabel: item.winnerPaymentButtonLabel ?? null,
    winnerPaymentEmailSentAt: item.winnerPaymentEmailSentAt
      ? toIsoString(item.winnerPaymentEmailSentAt)
      : null,
    winnerPaymentEmailAttemptKey: item.winnerPaymentEmailAttemptKey ?? null,
    winnerPaymentEmailLastSentKey: item.winnerPaymentEmailLastSentKey ?? null,
    pausedAt: item.pausedAt ? toIsoString(item.pausedAt) : null,
    pausedStartDelayMs:
      typeof item.pausedStartDelayMs === 'number' ? item.pausedStartDelayMs : null,
    pausedTimeRemainingMs:
      typeof item.pausedTimeRemainingMs === 'number' ? item.pausedTimeRemainingMs : null,
    paymentMade: Boolean(item.paymentMade),
    productIds: Array.isArray(item.productIds) ? item.productIds : [],
    createdAt: toIsoString(item.createdAt),
    updatedAt: toIsoString(item.updatedAt),
  };
}

function toCollectionPayload(
  input: AuctionInput,
  overrides?: Partial<
    Pick<
      AuctionRecord,
      | 'winnerBidId'
      | 'winnerCheckoutId'
      | 'winnerCheckoutUrl'
      | 'winnerCheckoutRecipientEmail'
      | 'winnerCheckoutEmailSentAt'
      | 'winnerPaymentUrl'
      | 'winnerPaymentButtonLabel'
      | 'winnerPaymentEmailSentAt'
      | 'winnerPaymentEmailAttemptKey'
      | 'winnerPaymentEmailLastSentKey'
      | 'pausedAt'
      | 'pausedStartDelayMs'
      | 'pausedTimeRemainingMs'
      | 'paymentMade'
      | 'createdAt'
      | 'updatedAt'
    >
  >,
): Omit<AuctionCollectionItem, '_id'> {
  return {
    title: input.title,
    description: input.description,
    imageUrls: input.imageUrls,
    startingPrice: input.startingPrice,
    reservePrice: input.reservePrice,
    startTime: new Date(input.startTime),
    endTime: toOptionalDate(input.endTime),
    lifecycle: input.lifecycle,
    minIncrement: input.minIncrement,
    antiSnipingEnabled: input.antiSnipingEnabled,
    antiSnipingWindowSeconds: input.antiSnipingWindowSeconds,
    antiSnipingExtensionSeconds: input.antiSnipingExtensionSeconds,
    productIds: input.productIds,
    winnerBidId: overrides?.winnerBidId ?? null,
    winnerCheckoutId: overrides?.winnerCheckoutId ?? null,
    winnerCheckoutUrl: overrides?.winnerCheckoutUrl ?? null,
    winnerCheckoutRecipientEmail: overrides?.winnerCheckoutRecipientEmail ?? null,
    winnerCheckoutEmailSentAt: overrides?.winnerCheckoutEmailSentAt
      ? new Date(overrides.winnerCheckoutEmailSentAt)
      : null,
    winnerPaymentUrl: overrides?.winnerPaymentUrl ?? null,
    winnerPaymentButtonLabel: overrides?.winnerPaymentButtonLabel ?? null,
    winnerPaymentEmailSentAt: overrides?.winnerPaymentEmailSentAt
      ? new Date(overrides.winnerPaymentEmailSentAt)
      : null,
    winnerPaymentEmailAttemptKey: overrides?.winnerPaymentEmailAttemptKey ?? null,
    winnerPaymentEmailLastSentKey: overrides?.winnerPaymentEmailLastSentKey ?? null,
    pausedAt: overrides?.pausedAt ? new Date(overrides.pausedAt) : null,
    pausedStartDelayMs: overrides?.pausedStartDelayMs ?? null,
    pausedTimeRemainingMs: overrides?.pausedTimeRemainingMs ?? null,
    paymentMade: overrides?.paymentMade ?? input.paymentMade,
    createdAt: new Date(overrides?.createdAt ?? new Date().toISOString()),
    updatedAt: new Date(overrides?.updatedAt ?? new Date().toISOString()),
  };
}

export async function listAuctionRecords(): Promise<AuctionRecord[]> {
  const allItems = await queryAll<AuctionCollectionItem>(() =>
    items.query(AUCTIONS_COLLECTION_ID),
  );

  return allItems
    .map((item) => normalizeAuctionRecord(item))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getAuctionRecordById(
  auctionId: string,
): Promise<AuctionRecord | null> {
  const item = await items.get(AUCTIONS_COLLECTION_ID, auctionId);

  if (!item) {
    return null;
  }

  return normalizeAuctionRecord(item as unknown as AuctionCollectionItem);
}

export async function findAuctionsByProductIds(
  productIds: string[],
  excludeAuctionId?: string,
): Promise<AuctionRecord[]> {
  if (productIds.length === 0) {
    return [];
  }

  const auctions = await listAuctionRecords();

  return auctions.filter((auction) => {
    if (excludeAuctionId && auction.id === excludeAuctionId) {
      return false;
    }

    return auction.productIds.some((productId) => productIds.includes(productId));
  });
}

export async function createAuctionRecord(
  input: AuctionInput,
): Promise<AuctionRecord> {
  const timestamp = new Date().toISOString();
  const created = await items.insert(
    AUCTIONS_COLLECTION_ID,
    toCollectionPayload(input, {
      createdAt: timestamp,
      updatedAt: timestamp,
      winnerBidId: null,
      winnerCheckoutId: null,
      winnerCheckoutUrl: null,
      winnerCheckoutRecipientEmail: null,
      winnerCheckoutEmailSentAt: null,
      winnerPaymentUrl: null,
      winnerPaymentButtonLabel: null,
      winnerPaymentEmailSentAt: null,
      winnerPaymentEmailAttemptKey: null,
      winnerPaymentEmailLastSentKey: null,
      pausedAt: null,
      pausedStartDelayMs: null,
      pausedTimeRemainingMs: null,
      paymentMade: input.paymentMade,
    }),
  );

  return normalizeAuctionRecord(created as unknown as AuctionCollectionItem);
}

export async function updateAuctionRecord(
  auctionId: string,
  input: AuctionInput,
  existing: AuctionRecord,
): Promise<AuctionRecord> {
  const updated = await items.update(AUCTIONS_COLLECTION_ID, {
    _id: auctionId,
    ...toCollectionPayload(input, {
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      winnerBidId: existing.winnerBidId,
      winnerCheckoutId: existing.winnerCheckoutId,
      winnerCheckoutUrl: existing.winnerCheckoutUrl,
      winnerCheckoutRecipientEmail: existing.winnerCheckoutRecipientEmail,
      winnerCheckoutEmailSentAt: existing.winnerCheckoutEmailSentAt,
      winnerPaymentUrl: existing.winnerPaymentUrl,
      winnerPaymentButtonLabel: existing.winnerPaymentButtonLabel,
      winnerPaymentEmailSentAt: existing.winnerPaymentEmailSentAt,
      winnerPaymentEmailAttemptKey: existing.winnerPaymentEmailAttemptKey,
      winnerPaymentEmailLastSentKey: existing.winnerPaymentEmailLastSentKey,
      pausedAt: existing.pausedAt,
      pausedStartDelayMs: existing.pausedStartDelayMs,
      pausedTimeRemainingMs: existing.pausedTimeRemainingMs,
      paymentMade: input.paymentMade,
    }),
  });

  return normalizeAuctionRecord(updated as unknown as AuctionCollectionItem);
}

export async function patchAuctionRecord(
  auctionId: string,
  existing: AuctionRecord,
  patch: Partial<AuctionRecord>,
): Promise<AuctionRecord> {
  const updated = await items.update(AUCTIONS_COLLECTION_ID, {
    _id: auctionId,
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description,
    imageUrls: patch.imageUrls ?? existing.imageUrls,
    startingPrice: patch.startingPrice ?? existing.startingPrice,
    reservePrice:
      patch.reservePrice === undefined ? existing.reservePrice : patch.reservePrice,
    startTime: new Date(patch.startTime ?? existing.startTime),
    endTime: toOptionalDate(
      patch.endTime === undefined ? existing.endTime : patch.endTime,
    ),
    lifecycle: patch.lifecycle ?? existing.lifecycle,
    minIncrement: patch.minIncrement === undefined ? existing.minIncrement : patch.minIncrement,
    antiSnipingEnabled:
      patch.antiSnipingEnabled ?? existing.antiSnipingEnabled,
    antiSnipingWindowSeconds:
      patch.antiSnipingWindowSeconds ?? existing.antiSnipingWindowSeconds,
    antiSnipingExtensionSeconds:
      patch.antiSnipingExtensionSeconds ?? existing.antiSnipingExtensionSeconds,
    productIds: patch.productIds ?? existing.productIds,
    winnerBidId: patch.winnerBidId === undefined ? existing.winnerBidId : patch.winnerBidId,
    winnerCheckoutId:
      patch.winnerCheckoutId === undefined
        ? existing.winnerCheckoutId
        : patch.winnerCheckoutId,
    winnerCheckoutUrl:
      patch.winnerCheckoutUrl === undefined
        ? existing.winnerCheckoutUrl
        : patch.winnerCheckoutUrl,
    winnerCheckoutRecipientEmail:
      patch.winnerCheckoutRecipientEmail === undefined
        ? existing.winnerCheckoutRecipientEmail
        : patch.winnerCheckoutRecipientEmail,
    winnerCheckoutEmailSentAt:
      patch.winnerCheckoutEmailSentAt === undefined
        ? existing.winnerCheckoutEmailSentAt
        : patch.winnerCheckoutEmailSentAt,
    winnerPaymentUrl:
      patch.winnerPaymentUrl === undefined ? existing.winnerPaymentUrl : patch.winnerPaymentUrl,
    winnerPaymentButtonLabel:
      patch.winnerPaymentButtonLabel === undefined
        ? existing.winnerPaymentButtonLabel
        : patch.winnerPaymentButtonLabel,
    winnerPaymentEmailSentAt:
      patch.winnerPaymentEmailSentAt === undefined
        ? existing.winnerPaymentEmailSentAt
        : patch.winnerPaymentEmailSentAt,
    winnerPaymentEmailAttemptKey:
      patch.winnerPaymentEmailAttemptKey === undefined
        ? existing.winnerPaymentEmailAttemptKey
        : patch.winnerPaymentEmailAttemptKey,
    winnerPaymentEmailLastSentKey:
      patch.winnerPaymentEmailLastSentKey === undefined
        ? existing.winnerPaymentEmailLastSentKey
        : patch.winnerPaymentEmailLastSentKey,
    pausedAt: patch.pausedAt === undefined ? existing.pausedAt : patch.pausedAt,
    pausedStartDelayMs:
      patch.pausedStartDelayMs === undefined
        ? existing.pausedStartDelayMs
        : patch.pausedStartDelayMs,
    pausedTimeRemainingMs:
      patch.pausedTimeRemainingMs === undefined
        ? existing.pausedTimeRemainingMs
        : patch.pausedTimeRemainingMs,
    paymentMade: patch.paymentMade === undefined ? existing.paymentMade : patch.paymentMade,
    createdAt: new Date(existing.createdAt),
    updatedAt: new Date().toISOString(),
  });

  return normalizeAuctionRecord(updated as unknown as AuctionCollectionItem);
}

export async function deleteAuctionRecord(auctionId: string): Promise<void> {
  await items.remove(AUCTIONS_COLLECTION_ID, auctionId);
}
