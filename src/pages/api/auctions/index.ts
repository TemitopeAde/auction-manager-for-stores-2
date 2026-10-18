import type { APIRoute } from 'astro';
import { listPublicAuctions } from '../../../lib/server/auction-service';
import { errorResponse, json } from '../../../lib/server/http-response';

// GET /api/auctions — public auction views, polled by the Auction Products component.
export const GET: APIRoute = async () => {
  try {
    return json(await listPublicAuctions());
  } catch (error) {
    console.error('[api] GET /api/auctions failed', error);
    return errorResponse(error, 500);
  }
};
