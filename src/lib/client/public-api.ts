import { httpClient } from '@wix/essentials';
import type {
  AuctionView,
  BidInput,
  PublicAuctionProductQuery,
  PublicAuctionProductsResult,
  PublicAuctionSettings,
} from '../auction/types';
import type { MemberSiteMethods, PublicSiteMethods } from '../server/site-methods';

export type BidMode = 'member' | 'email';

export type PlaceBidResult = { auction: AuctionView };

// Endpoints live on the app server, so URLs resolve against this module's origin,
// not the host site's.
function endpointUrl(path: string): URL {
  return new URL(path, import.meta.url);
}

async function request<T>(url: URL, init?: RequestInit): Promise<T> {
  const response = await httpClient.fetchWithAuth(url.href, init);
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

  if (!response.ok || !body) {
    throw new Error(body?.error || `Request failed (${response.status}).`);
  }

  return body;
}

export function listPublicAuctionProducts(
  query: PublicAuctionProductQuery,
): Promise<PublicAuctionProductsResult> {
  const url = endpointUrl('/api/auctions/products');
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return request(url);
}

export function listPublicAuctions(): Promise<Array<AuctionView>> {
  return request(endpointUrl('/api/auctions'));
}

export function getPublicAuctionSettings(): Promise<PublicAuctionSettings> {
  return request(endpointUrl('/api/auctions/settings'));
}

export function placeBid(
  auctionId: string,
  mode: BidMode,
  bid: Omit<BidInput, 'bidderMemberId'>,
): Promise<PlaceBidResult> {
  return request(endpointUrl('/api/auctions/bids'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auctionId, mode, bid }),
  });
}

type SiteRpcMethods = {
  [K in keyof PublicSiteMethods]: PublicSiteMethods[K];
} & {
  // Member methods: the server supplies the member argument, so callers omit it.
  [K in keyof MemberSiteMethods]: MemberSiteMethods[K] extends (member: never, ...rest: infer A) => infer R
    ? (...args: A) => R
    : never;
};

function callSiteMethod<K extends keyof SiteRpcMethods>(
  method: K,
  ...args: Parameters<SiteRpcMethods[K]>
): Promise<Awaited<ReturnType<SiteRpcMethods[K]>>> {
  return request<{ result: Awaited<ReturnType<SiteRpcMethods[K]>> }>(endpointUrl('/api/site/rpc'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, args }),
  }).then((body) => body.result);
}

export const getProductVariantState = (productId: string) =>
  callSiteMethod('getProductVariantState', productId);

/** The signed-in member's own bids on an auction. */
export const getMemberAuctionBids = (auctionId: string) =>
  callSiteMethod('getMemberAuctionBids', auctionId);

/** Checkout URL if the signed-in member won an auction for this product. */
export const getWinnerCheckoutForProduct = (productId: string) =>
  callSiteMethod('getWinnerCheckoutForProduct', productId);

/** Creates (or returns) the winner checkout; only the winning bidder may call it. */
export const triggerWinnerCheckout = (productId: string) =>
  callSiteMethod('triggerWinnerCheckout', productId);

export const acknowledgeWinnerCheckoutEmail = (auctionId: string) =>
  callSiteMethod('acknowledgeWinnerCheckoutEmail', auctionId);

export const sendWinnerCheckoutEmail = (auctionId: string) =>
  callSiteMethod('sendWinnerCheckoutEmail', auctionId);

/** The signed-in member's ended, unpaid winning items (combined checkout). */
export const listMemberWonItems = () => callSiteMethod('listMemberWonItems');

/** One checkout for every won item, each at its winning bid. */
export const createMemberCombinedCheckout = () => callSiteMethod('createMemberCombinedCheckout');
