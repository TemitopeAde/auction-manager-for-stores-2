import type { APIRoute } from 'astro';
import type {
  PublicAuctionProductFilter,
  PublicAuctionTimerFilter,
} from '../../../lib/auction/types';
import { listPublicAuctionProducts } from '../../../lib/server/auction-service';
import { errorResponse, json } from '../../../lib/server/http-response';

// GET /api/auctions/products?search=&auctionFilter=&timerFilter=&cursor=&pageSize=
export const GET: APIRoute = async ({ request }) => {
  const params = new URL(request.url).searchParams;
  const pageSize = Number.parseInt(params.get('pageSize') ?? '', 10);

  try {
    const result = await listPublicAuctionProducts({
      search: params.get('search') ?? undefined,
      auctionFilter: (params.get('auctionFilter') ?? undefined) as PublicAuctionProductFilter | undefined,
      timerFilter: (params.get('timerFilter') ?? undefined) as PublicAuctionTimerFilter | undefined,
      cursor: params.get('cursor') || null,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
    });
    return json(result);
  } catch (error) {
    console.error('[api] GET /api/auctions/products failed', error);
    return errorResponse(error, 500);
  }
};
