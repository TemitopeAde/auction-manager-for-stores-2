import type { APIRoute } from 'astro';
import { getPublicAuctionSettings } from '../../../lib/server/auction-service';
import { errorResponse, json } from '../../../lib/server/http-response';

// GET /api/auctions/settings — the public subset of app settings.
export const GET: APIRoute = async () => {
  try {
    return json(await getPublicAuctionSettings());
  } catch (error) {
    console.error('[api] GET /api/auctions/settings failed', error);
    return errorResponse(error, 500);
  }
};
