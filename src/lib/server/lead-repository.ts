import { elevatedItems as items, queryAll } from './wix-data-utils';
import type { LeadRecord } from '../auction/types';

export const LEADS_COLLECTION_ID = '@hi-konsult/smart-auction-manager/Leads';

interface LeadCollectionItem {
  _id: string;
  auctionId: string;
  bidderName: string;
  bidderEmail: string;
  bidderPhone: string;
  amount: number;
  createdAt: string;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeLeadRecord(item: any): LeadRecord {
  return {
    id: item._id,
    auctionId: item.auctionId,
    bidderName: item.bidderName,
    bidderEmail: item.bidderEmail,
    bidderPhone: item.bidderPhone,
    amount: item.amount,
    createdAt: item.createdAt,
  };
}

function uniqueLeadsByEmail(leads: LeadRecord[]): LeadRecord[] {
  const latestByEmail = new Map<string, LeadRecord>();

  for (const lead of leads) {
    const email = normalizeEmail(lead.bidderEmail);

    if (!email) {
      continue;
    }

    const existing = latestByEmail.get(email);

    if (!existing || new Date(lead.createdAt).getTime() >= new Date(existing.createdAt).getTime()) {
      latestByEmail.set(email, {
        ...lead,
        bidderEmail: email,
      });
    }
  }

  return [...latestByEmail.values()].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

async function listRawLeads(): Promise<LeadRecord[]> {
  const allItems = await queryAll<LeadCollectionItem>(() =>
    items.query(LEADS_COLLECTION_ID),
  );

  return allItems.map(normalizeLeadRecord);
}

async function removeDuplicateLeads(leads: LeadRecord[]): Promise<LeadRecord[]> {
  const unique = uniqueLeadsByEmail(leads);
  const keepIds = new Set(unique.map((lead) => lead.id));
  const duplicates = leads.filter((lead) => !keepIds.has(lead.id));

  if (duplicates.length > 0) {
    await Promise.all(
      duplicates.map((lead) => items.remove(LEADS_COLLECTION_ID, lead.id)),
    );
  }

  return unique;
}

export async function listLeads(): Promise<LeadRecord[]> {
  const leads = await listRawLeads();
  return removeDuplicateLeads(leads);
}

export async function deleteLeadsByAuctionId(auctionId: string): Promise<void> {
  const leads = await listRawLeads();

  await Promise.all(
    leads
      .filter((lead) => lead.auctionId === auctionId)
      .map((lead) => items.remove(LEADS_COLLECTION_ID, lead.id)),
  );
}

export async function deleteLeadsForEmail(bidderEmail: string): Promise<void> {
  const email = normalizeEmail(bidderEmail);
  const leads = await listRawLeads();

  await Promise.all(
    leads
      .filter((lead) => normalizeEmail(lead.bidderEmail) === email)
      .map((lead) => items.remove(LEADS_COLLECTION_ID, lead.id)),
  );
}

export async function insertLeadRecord(auctionId: string, input: {
  bidderName?: string;
  bidderEmail: string;
  bidderPhone?: string;
  amount: number;
}): Promise<LeadRecord> {
  const bidderEmail = normalizeEmail(input.bidderEmail);
  const matchingLeads = (await listRawLeads())
    .filter((lead) => normalizeEmail(lead.bidderEmail) === bidderEmail)
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  const [existing, ...duplicates] = matchingLeads;

  await Promise.all(duplicates.map((lead) => items.remove(LEADS_COLLECTION_ID, lead.id)));

  if (existing) {
    const updated = await items.update(LEADS_COLLECTION_ID, {
      _id: existing.id,
      auctionId,
      bidderName: input.bidderName || '',
      bidderEmail,
      bidderPhone: input.bidderPhone || '',
      amount: input.amount,
      createdAt: new Date().toISOString(),
    });

    return normalizeLeadRecord(updated);
  }

  const created = await items.insert(LEADS_COLLECTION_ID, {
    auctionId,
    bidderName: input.bidderName || '',
    bidderEmail,
    bidderPhone: input.bidderPhone || '',
    amount: input.amount,
    createdAt: new Date().toISOString(),
  });

  return normalizeLeadRecord(created);
}
