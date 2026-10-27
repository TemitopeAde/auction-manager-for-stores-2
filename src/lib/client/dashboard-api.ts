import { httpClient } from '@wix/essentials';
import type {
  BidSummary,
  DashboardPageContextInput,
  ExportLeadsCsvInput,
} from '../auction/types';
import type { DashboardMethodName, DashboardMethods } from '../server/dashboard-methods';

type Awaited<T> = T extends Promise<infer U> ? U : T;

/** Calls an admin service method through the app's dashboard RPC endpoint. */
async function callDashboardMethod<K extends DashboardMethodName>(
  method: K,
  ...args: Parameters<DashboardMethods[K]>
): Promise<Awaited<ReturnType<DashboardMethods[K]>>> {
  const response = await httpClient.fetchWithAuth(new URL('/api/dashboard/rpc', import.meta.url).href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, args }),
  });
  const body = (await response.json().catch(() => null)) as { result?: unknown; error?: string } | null;

  if (!response.ok || !body) {
    throw new Error(body?.error || `Request failed (${response.status}).`);
  }

  return body.result as Awaited<ReturnType<DashboardMethods[K]>>;
}

function bindMethod<K extends DashboardMethodName>(method: K) {
  return (...args: Parameters<DashboardMethods[K]>) => callDashboardMethod(method, ...args);
}

export const loadDashboard = bindMethod('loadDashboard');
export const getDashboardMonitor = bindMethod('getDashboardMonitor');
export const createAuction = bindMethod('createAuction');
export const sendLeadEmails = bindMethod('sendLeadEmails');
export const searchDashboardAuctions = bindMethod('searchDashboardAuctions');
export const searchDashboardLeads = bindMethod('searchDashboardLeads');
export const searchAuctionBids = bindMethod('searchAuctionBids');
export const searchDashboardProducts = bindMethod('searchDashboardProducts');
export const queryStoreProducts = bindMethod('queryStoreProducts');
export const getStoreProductsByIds = bindMethod('getStoreProductsByIds');
export const createAuctionFromProduct = bindMethod('createAuctionFromProduct');
export const deleteAuction = bindMethod('deleteAuction');
export const deleteAuctions = bindMethod('deleteAuctions');
export const deleteBid = bindMethod('deleteBid');
export const updateAuction = bindMethod('updateAuction');
export const runAuctionAction = bindMethod('runAuctionAction');
export const resendWinnerPaymentEmail = bindMethod('resendWinnerPaymentEmail');
export const getSettings = bindMethod('getSettings');
export const saveSettings = bindMethod('saveSettings');

export const getSitePluginPlacementStatus = bindMethod('getSitePluginPlacementStatus');

function downloadCsvFile(csv: string, fileName: string): void {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

export async function downloadAuctionExport(auctionId: string, fileName?: string): Promise<void> {
  const csv = await callDashboardMethod('exportAuctionCsv', auctionId);
  downloadCsvFile(csv, fileName ?? `${auctionId}.csv`);
}

export async function downloadLeadsExport(
  input: ExportLeadsCsvInput = {},
  fileName = 'auction-leads.csv',
): Promise<void> {
  const csv = await callDashboardMethod('exportLeadsCsv', input);
  downloadCsvFile(csv, fileName);
}

export function createWhatsappHref(
  phone: string,
  auctionTitle: string,
  bid?: Pick<BidSummary, 'bidderName' | 'amount'> | null,
): string | null {
  const digits = phone.replace(/[^\d]/g, '');

  if (!digits) {
    return null;
  }

  const message = bid
    ? `Hello ${bid.bidderName}, we're contacting you about ${auctionTitle}. Your latest bid is ${bid.amount}.`
    : `Hello, we're contacting you about ${auctionTitle}.`;

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function readDashboardPageContext(): DashboardPageContextInput | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const productId = params.get('productId')?.trim() || '';
  const productName = params.get('productName')?.trim() || '';
  const returnToStores = params.get('returnToStores') === 'true';
  const tabParam = params.get('tab');

  if (!productId && !productName && !returnToStores && !tabParam) {
    return null;
  }

  return {
    productId: productId || undefined,
    productName: productName || undefined,
    returnToStores,
    tab:
      tabParam === 'overview' || tabParam === 'monitor' || tabParam === 'auctions'
        ? tabParam
        : undefined,
  };
}
