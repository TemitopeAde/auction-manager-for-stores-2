import { createContext, useContext } from 'react';
import * as liveApi from '../../../../lib/client/public-api';

/**
 * Where the component reads auction data from. The live site uses the app's
 * HTTP endpoints; the editor preview swaps in sample data through
 * `AuctionDataProvider`, so the editor never hits the network.
 */
export type AuctionDataSource = {
  listPublicAuctionProducts: typeof liveApi.listPublicAuctionProducts;
  listPublicAuctions: typeof liveApi.listPublicAuctions;
  getPublicAuctionSettings: typeof liveApi.getPublicAuctionSettings;
  placeBid: typeof liveApi.placeBid;
  /** Whether to poll, play sounds, and call site APIs (currency, member, navigation). */
  live: boolean;
};

const liveDataSource: AuctionDataSource = {
  listPublicAuctionProducts: liveApi.listPublicAuctionProducts,
  listPublicAuctions: liveApi.listPublicAuctions,
  getPublicAuctionSettings: liveApi.getPublicAuctionSettings,
  placeBid: liveApi.placeBid,
  live: true,
};

const AuctionDataContext = createContext<AuctionDataSource>(liveDataSource);

export const AuctionDataProvider = AuctionDataContext.Provider;

export function useAuctionData(): AuctionDataSource {
  return useContext(AuctionDataContext);
}
