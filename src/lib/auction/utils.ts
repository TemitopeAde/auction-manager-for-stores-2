import { ENDING_SOON_WINDOW_MS } from './defaults';
import { getPlan } from './plans';
import type {
  AppSettings,
  AuctionRecord,
  AuctionStatus,
  AuctionView,
  BidRecord,
  BidSummary,
  NotificationRecord,
} from './types';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function createId(prefix: string, value: string): string {
  const base = slugify(value) || Math.random().toString(36).slice(2, 10);
  return `${prefix}-${base}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseDate(value: string): number {
  return new Date(value).getTime();
}

export function isValidDate(value: string): boolean {
  return Boolean(value) && Number.isFinite(parseDate(value));
}

export function hasAuctionEndTime(endTime: string | null | undefined): boolean {
  return typeof endTime === 'string' && isValidDate(endTime);
}

export function getPlanLimit(settings: AppSettings): number {
  return getPlan(settings.planTier).activeAuctions;
}

export function sortBidsDescending(bids: BidRecord[]): BidRecord[] {
  return [...bids].sort((left, right) => {
    if (right.amount !== left.amount) {
      return right.amount - left.amount;
    }

    return parseDate(right.createdAt) - parseDate(left.createdAt);
  });
}

export function toBidSummary(bid: BidRecord): BidSummary {
  return {
    id: bid.id,
    bidderMemberId: bid.bidderMemberId ?? null,
    bidderName: bid.bidderName,
    bidderEmail: bid.bidderEmail,
    bidderPhone: bid.bidderPhone,
    amount: bid.amount,
    createdAt: bid.createdAt,
    variantId: bid.variantId ?? null,
    variantLabel: bid.variantLabel ?? null,
    variantChoices: bid.variantChoices ?? null,
  };
}

export function formatCurrency(value: number | null, currencyCode?: string): string {
  if (value === null) {
    return 'No bids yet';
  }

  if (!currencyCode) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(value);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatCountdown(endTime: string, now: number): string {
  if (!hasAuctionEndTime(endTime)) {
    return 'Until manually ended';
  }

  return formatCountdownFromMs(parseDate(endTime) - now);
}

export function formatCountdownFromMs(distance: number): string {
  if (!Number.isFinite(distance)) {
    return 'Until manually ended';
  }

  if (distance <= 0) {
    return 'Closed';
  }

  const totalSeconds = Math.floor(distance / 1000);
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

export function getAuctionStatus(
  auction: AuctionRecord,
  bids: BidRecord[],
  now: number,
): AuctionStatus {
  if (auction.lifecycle === 'draft') {
    return 'draft';
  }

  if (auction.lifecycle === 'paused') {
    return 'paused';
  }

  if (auction.lifecycle === 'sold') {
    return 'sold';
  }

  const startTime = parseDate(auction.startTime);
  const hasEndTime = hasAuctionEndTime(auction.endTime);
  const endTime = hasEndTime ? parseDate(auction.endTime) : null;
  const topBid = sortBidsDescending(bids)[0];
  const reserveReached =
    auction.reservePrice === null ||
    (topBid ? topBid.amount >= auction.reservePrice : false);

  if (auction.lifecycle === 'closed') {
    return reserveReached ? 'closed' : 'reserveNotMet';
  }

  if (now < startTime) {
    return 'scheduled';
  }

  if (endTime !== null && now >= endTime) {
    return reserveReached ? 'closed' : 'reserveNotMet';
  }

  if (endTime !== null && endTime - now <= ENDING_SOON_WINDOW_MS) {
    return 'endingSoon';
  }

  return 'live';
}

export function isCurrentProductLinkStatus(status: AuctionStatus): boolean {
  return ['scheduled', 'live', 'endingSoon', 'paused'].includes(status);
}

export function reservesProductForAuction(status: AuctionStatus): boolean {
  return status === 'draft' || isCurrentProductLinkStatus(status);
}

export function reservesProductForAuctionAt(
  auction: Pick<AuctionView, 'status' | 'lifecycle' | 'endTime'>,
  now: number,
): boolean {
  if (!reservesProductForAuction(auction.status)) return false;
  return auction.lifecycle !== 'published' ||
    !hasAuctionEndTime(auction.endTime) ||
    now < parseDate(auction.endTime);
}

export function isAuctionLinkedToProduct(
  auction: Pick<AuctionRecord | AuctionView, 'productIds'>,
  productId: string,
): boolean {
  return Boolean(productId) && auction.productIds[0]?.trim() === productId.trim();
}

export function getAuctionCountdownMs(auction: AuctionRecord | AuctionView, now: number): number {
  if (auction.lifecycle === 'paused') {
    if (auction.pausedTimeRemainingMs === null) {
      return Number.POSITIVE_INFINITY;
    }

    return auction.pausedTimeRemainingMs;
  }

  if (!hasAuctionEndTime(auction.endTime)) {
    return Number.POSITIVE_INFINITY;
  }

  return parseDate(auction.endTime) - now;
}

export function getHighestBidByVariant(bids: BidRecord[]): Record<string, number> {
  const highestByVariant: Record<string, number> = {};

  for (const bid of bids) {
    const variantId = bid.variantId?.trim();

    if (!variantId) {
      continue;
    }

    const currentHighest = highestByVariant[variantId];

    if (currentHighest == null || bid.amount > currentHighest) {
      highestByVariant[variantId] = bid.amount;
    }
  }

  return highestByVariant;
}

export function getHighestUnscopedBidAmount(bids: BidRecord[]): number | null {
  const unscopedBids = bids.filter((bid) => !bid.variantId?.trim());

  if (unscopedBids.length === 0) {
    return null;
  }

  return sortBidsDescending(unscopedBids)[0]?.amount ?? null;
}

export function getBidsRelevantToVariant(
  bids: BidRecord[],
  variantId?: string | null,
): BidRecord[] {
  const normalizedVariantId = variantId?.trim();

  if (!normalizedVariantId) {
    return bids;
  }

  return bids.filter(
    (bid) => !bid.variantId?.trim() || bid.variantId === normalizedVariantId,
  );
}

export function getVariantAwareHighestBid(
  auction: AuctionView,
  variantId?: string | null,
): number | null {
  const normalizedVariantId = variantId?.trim();

  if (!normalizedVariantId) {
    return auction.currentHighestBid;
  }

  const candidates = [
    auction.highestUnscopedBid,
    auction.highestBidByVariant[normalizedVariantId] ?? null,
  ].filter((value): value is number => value != null);

  return candidates.length > 0 ? Math.max(...candidates) : null;
}

export function getVariantAwareMinimumNextBid(
  auction: AuctionView,
  variantId?: string | null,
): number {
  const highestBid = getVariantAwareHighestBid(auction, variantId);

  if (highestBid == null) {
    return auction.startingPrice;
  }

  return highestBid + auction.effectiveMinIncrement;
}

export function getMinimumNextBidAmount(
  auction: AuctionRecord,
  bids: BidRecord[],
  settings: AppSettings,
  variantId?: string | null,
): number {
  const relevantBids = getBidsRelevantToVariant(bids, variantId);
  const highestBid = sortBidsDescending(relevantBids)[0]?.amount ?? null;
  const increment = auction.minIncrement ?? settings.defaultMinIncrement;

  return highestBid == null ? auction.startingPrice : highestBid + increment;
}

export function toAuctionView(
  auction: AuctionRecord,
  bids: BidRecord[],
  settings: AppSettings,
  now: number,
): AuctionView {
  const orderedBids = sortBidsDescending(bids);
  const highestBid = orderedBids[0] ?? null;
  const effectiveMinIncrement = auction.minIncrement ?? settings.defaultMinIncrement;
  const currentHighestBid = highestBid?.amount ?? null;
  const reserveReached =
    auction.reservePrice === null ||
    (currentHighestBid !== null && currentHighestBid >= auction.reservePrice);
  const minimumNextBid =
    currentHighestBid === null
      ? auction.startingPrice
      : currentHighestBid + effectiveMinIncrement;
  const winnerBid =
    auction.winnerBidId === null
      ? null
      : bids.find((bid) => bid.id === auction.winnerBidId) ?? null;

  return {
    ...auction,
    bidCount: bids.length,
    currentHighestBid,
    currentHighestBidId: highestBid?.id ?? null,
    reserveReached,
    minimumNextBid,
    effectiveMinIncrement,
    status: getAuctionStatus(auction, bids, now),
    recentBids: orderedBids.slice(0, 5).map(toBidSummary),
    winner: winnerBid ? toBidSummary(winnerBid) : null,
    highestBidByVariant: getHighestBidByVariant(bids),
    highestUnscopedBid: getHighestUnscopedBidAmount(bids),
  };
}

export function createWhatsappLink(phone: string, message: string): string | null {
  const digits = phone.replace(/[^\d]/g, '');

  if (!digits) {
    return null;
  }

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${encodedMessage}`;
}

export function createNotification(
  auctionId: string,
  audience: NotificationRecord['audience'],
  channel: NotificationRecord['channel'],
  message: string,
): NotificationRecord {
  return {
    id: createId('notification', `${auctionId}-${audience}`),
    auctionId,
    audience,
    channel,
    message,
    createdAt: new Date().toISOString(),
  };
}

export function createCsv(auction: AuctionView): string {
  const rows = [
    ['Auction', auction.title],
    ['Status', auction.status],
    ['Highest Bid', String(auction.currentHighestBid ?? '')],
    [],
    ['Name', 'Email', 'Phone', 'Variant', 'Amount', 'Timestamp'],
    ...auction.recentBids.map((bid) => [
      bid.bidderName,
      bid.bidderEmail,
      bid.bidderPhone,
      bid.variantLabel ?? '',
      String(bid.amount),
      bid.createdAt,
    ]),
  ];

  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');
}

export function createLeadsCsv(
  leads: Array<{
    bidderName: string;
    bidderEmail: string;
    bidderPhone: string;
    auctionTitle: string;
    auctionStatus: string;
    amount: number;
    createdAt: string;
  }>,
  currency: string,
): string {
  const rows = [
    [
      'Bidder Name',
      'Email',
      'Phone',
      'Auction',
      'Auction Status',
      'Bid Amount',
      'Currency',
      'Bid Date',
    ],
    ...leads.map((lead) => [
      lead.bidderName,
      lead.bidderEmail,
      lead.bidderPhone,
      lead.auctionTitle,
      lead.auctionStatus,
      String(lead.amount),
      currency,
      lead.createdAt,
    ]),
  ];

  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');
}
