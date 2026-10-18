import type { AuctionView, PublicAuctionProduct } from '../../../../lib/auction/types';
import { getMockDashboardPayload } from '../../../../lib/auction/mock';
import type { AuctionDataSource } from './auction-data';

const SAMPLE_IMAGES = [
  'https://static.wixstatic.com/media/11062b_2f97b87dcea2446fa48e9ad9c5457ae1~mv2.jpg',
  'https://static.wixstatic.com/media/11062b_73f31c7e7d3544c69dc8ecd8d34c5717~mv2.jpg',
  'https://static.wixstatic.com/media/11062b_3682ebfcb08e4da5b3168b62819a1e68~mv2.jpg',
  'https://static.wixstatic.com/media/11062b_45e67783d39c4963ab9e4fc418173233~mv2.jpg',
];

function buildSampleProducts(): Array<PublicAuctionProduct> {
  const { auctions } = getMockDashboardPayload();
  return auctions.slice(0, SAMPLE_IMAGES.length).map((auction, index) => ({
    id: `sample-product-${index + 1}`,
    _id: `sample-product-${index + 1}`,
    name: auction.title || `Sample lot ${index + 1}`,
    slug: `sample-lot-${index + 1}`,
    mainImageUrl: SAMPLE_IMAGES[index],
    priceRange: { min: auction.startingPrice, max: auction.startingPrice, currency: null },
    raw: null,
    auction,
  }));
}

/** Static sample data for the editor stage: no network, polling, or site APIs. */
export const previewDataSource: AuctionDataSource = {
  live: false,
  listPublicAuctionProducts: async () => ({
    products: buildSampleProducts(),
    cursor: null,
    nextCursor: null,
    hasNextPage: false,
  }),
  listPublicAuctions: async (): Promise<Array<AuctionView>> =>
    buildSampleProducts().flatMap((product) => (product.auction ? [product.auction] : [])),
  getPublicAuctionSettings: async () => ({
    canSubmitBid: true,
    emailBiddingEnabled: false,
    winnerCheckoutEmailEnabled: false,
  }),
  placeBid: async () => {
    throw new Error('Bidding is disabled in the editor preview.');
  },
};
