import type { CallerMember } from './caller';
import {
  acknowledgeWinnerCheckoutEmail,
  createMemberCombinedCheckout,
  getMemberAuctionBids,
  getProductVariantState,
  getWinnerCheckoutForProduct,
  listMemberWonItems,
  sendWinnerCheckoutEmail,
  triggerWinnerCheckout,
} from './auction-service';

/**
 * Site-facing methods reachable through `/api/site/rpc`. Member methods take
 * the caller's identity from the server (`getCallerMember`), replacing the
 * member ID / email arguments the legacy web methods trusted from the browser.
 */

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

/** Methods any site visitor may call. */
export const PUBLIC_SITE_METHODS = {
  getProductVariantState: (productId: unknown) =>
    getProductVariantState(requireString(productId, 'productId')),
};

/** Methods that require a signed-in site member. */
export const MEMBER_SITE_METHODS = {
  getMemberAuctionBids: (member: CallerMember, auctionId: unknown) =>
    getMemberAuctionBids({
      auctionId: requireString(auctionId, 'auctionId'),
      bidderMemberId: member.id,
      bidderEmail: member.email,
    }),
  getWinnerCheckoutForProduct: (member: CallerMember, productId: unknown) =>
    getWinnerCheckoutForProduct(requireString(productId, 'productId'), member.id, member.email),
  triggerWinnerCheckout: (member: CallerMember, productId: unknown) =>
    triggerWinnerCheckout(requireString(productId, 'productId'), {
      memberId: member.id,
      email: member.email,
    }),
  acknowledgeWinnerCheckoutEmail: (member: CallerMember, auctionId: unknown) =>
    acknowledgeWinnerCheckoutEmail(requireString(auctionId, 'auctionId'), member.email),
  listMemberWonItems: (member: CallerMember) =>
    listMemberWonItems({ memberId: member.id, email: member.email }),
  createMemberCombinedCheckout: (member: CallerMember) =>
    createMemberCombinedCheckout({ memberId: member.id, email: member.email }),
  sendWinnerCheckoutEmail: (member: CallerMember, auctionId: unknown) =>
    sendWinnerCheckoutEmail({
      auctionId: requireString(auctionId, 'auctionId'),
      bidderMemberId: member.id,
      bidderEmail: member.email,
    }),
};

export type PublicSiteMethods = typeof PUBLIC_SITE_METHODS;
export type MemberSiteMethods = typeof MEMBER_SITE_METHODS;
