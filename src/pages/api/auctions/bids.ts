import type { APIRoute } from 'astro';
import type { BidInput } from '../../../lib/auction/types';
import { placeBid, placeEmailBid } from '../../../lib/server/auction-service';
import { getCallerMember } from '../../../lib/server/caller';
import { errorResponse, json } from '../../../lib/server/http-response';

type BidRequestBody = {
  auctionId?: unknown;
  mode?: unknown;
  bid?: Partial<BidInput>;
};

/**
 * POST /api/auctions/bids
 * Body: { auctionId, mode: 'member' | 'email', bid: BidInput }
 *
 * Member bids replace the legacy `Permissions.SiteMember` web method: the
 * member is resolved from the caller's own identity (sent by
 * `httpClient.fetchWithAuth`), never from IDs in the request body.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: BidRequestBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const auctionId = typeof body.auctionId === 'string' ? body.auctionId.trim() : '';
  const amount = Number(body.bid?.amount);
  if (!auctionId) {
    return json({ error: 'auctionId is required.' }, 400);
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return json({ error: 'A positive bid amount is required.' }, 400);
  }

  const input: BidInput = {
    bidderName: asOptionalString(body.bid?.bidderName),
    bidderEmail: asOptionalString(body.bid?.bidderEmail) ?? '',
    bidderPhone: asOptionalString(body.bid?.bidderPhone),
    amount,
    productId: asOptionalString(body.bid?.productId) ?? null,
    variantId: asOptionalString(body.bid?.variantId) ?? null,
    variantLabel: asOptionalString(body.bid?.variantLabel) ?? null,
    variantChoices: isStringRecord(body.bid?.variantChoices) ? body.bid.variantChoices : null,
  };

  try {
    if (body.mode === 'email') {
      return json(await placeEmailBid(auctionId, { ...input, bidderMemberId: null }));
    }

    const member = await getCallerMember();
    if (!member) {
      return json({ error: 'Sign in to place a bid.' }, 401);
    }

    return json(
      await placeBid(auctionId, {
        ...input,
        bidderMemberId: member.id,
        // The member's own profile wins over anything the browser sent.
        bidderName: member.name || input.bidderName,
        bidderEmail: member.email || input.bidderEmail,
        bidderPhone: member.phone || input.bidderPhone,
      }),
    );
  } catch (error) {
    console.error('[api] POST /api/auctions/bids failed', error);
    return errorResponse(error, 400);
  }
};

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}
