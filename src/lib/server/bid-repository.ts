import { elevatedItems as items, queryAll } from './wix-data-utils';
import type { BidRecord, BidInput } from '../auction/types';

export const BIDS_COLLECTION_ID = '@hi-konsult/smart-auction-manager/Bids';

interface BidCollectionItem {
  _id: string;
  auctionId: string;
  bidderMemberId?: string | null;
  bidderName: string;
  bidderEmail: string;
  bidderPhone: string;
  amount: number;
  createdAt: string;
  variantId?: string | null;
  variantLabel?: string | null;
  variantChoices?: Record<string, string> | string | null;
}

function parseVariantChoices(value: unknown): Record<string, string> | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return parseVariantChoices(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (typeof value !== 'object') {
    return null;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, choice]) => choice != null && choice !== '')
    .map(([key, choice]) => [key, String(choice)]);

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function normalizeBidRecord(item: any): BidRecord {
  return {
    id: item._id,
    auctionId: item.auctionId,
    bidderMemberId: item.bidderMemberId ?? null,
    bidderName: item.bidderName,
    bidderEmail: item.bidderEmail,
    bidderPhone: item.bidderPhone,
    amount: item.amount,
    createdAt: item.createdAt,
    variantId: item.variantId ?? null,
    variantLabel: item.variantLabel ?? null,
    variantChoices: parseVariantChoices(item.variantChoices),
  };
}

export async function listBidsByAuctionId(auctionId: string): Promise<BidRecord[]> {
  const allItems = await queryAll<BidCollectionItem>(() =>
    items.query(BIDS_COLLECTION_ID).eq('auctionId', auctionId),
  );

  return allItems
    .map(normalizeBidRecord)
    .sort((left, right) => right.amount - left.amount);
}

export async function listAllBids(): Promise<BidRecord[]> {
  const allItems = await queryAll<BidCollectionItem>(() =>
    items.query(BIDS_COLLECTION_ID),
  );

  return allItems
    .map(normalizeBidRecord)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getBidRecordById(bidId: string): Promise<BidRecord | null> {
  try {
    const item = await items.get(BIDS_COLLECTION_ID, bidId);
    return item ? normalizeBidRecord(item) : null;
  } catch {
    return null;
  }
}

export async function deleteBidRecord(bidId: string): Promise<void> {
  await items.remove(BIDS_COLLECTION_ID, bidId);
}

export async function deleteBidsByAuctionId(auctionId: string): Promise<void> {
  const bids = await listBidsByAuctionId(auctionId);

  await Promise.all(
    bids.map((bid) => items.remove(BIDS_COLLECTION_ID, bid.id)),
  );
}

export async function insertBidRecord(auctionId: string, input: BidInput): Promise<BidRecord> {
  const bid: Omit<BidCollectionItem, '_id'> = {
    auctionId,
    bidderMemberId: input.bidderMemberId ?? null,
    bidderName: input.bidderName || '',
    bidderEmail: input.bidderEmail.toLowerCase(),
    bidderPhone: input.bidderPhone || '',
    amount: input.amount,
    createdAt: new Date().toISOString(),
    variantId: input.variantId ?? null,
    variantLabel: input.variantLabel ?? null,
    variantChoices: input.variantChoices ?? null,
  };

  const created = await items.insert(BIDS_COLLECTION_ID, bid);
  return normalizeBidRecord(created);
}
