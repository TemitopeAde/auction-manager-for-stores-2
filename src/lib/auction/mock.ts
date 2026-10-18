import { DEFAULT_SETTINGS, SAMPLE_STORE } from './defaults';
import type { DashboardPayload } from './types';
import { toAuctionView } from './utils';

export function getMockDashboardPayload(): DashboardPayload {
  const now = Date.now();
  const auctions = SAMPLE_STORE.auctions.map((auction) =>
    toAuctionView(
      auction,
      SAMPLE_STORE.bids.filter((bid) => bid.auctionId === auction.id),
      DEFAULT_SETTINGS,
      now,
    ),
  );

  return {
    generatedAt: new Date(now).toISOString(),
    settings: DEFAULT_SETTINGS,
    installedPlan: null,
    auctions,
    notifications: SAMPLE_STORE.notifications,
    currency: '',
    leads: SAMPLE_STORE.bids.map((b) => ({
      id: b.id,
      auctionId: b.auctionId,
      bidderName: b.bidderName,
      bidderEmail: b.bidderEmail,
      bidderPhone: b.bidderPhone,
      amount: b.amount,
      createdAt: b.createdAt,
    })),
    summary: {
      totalAuctions: auctions.length,
      activeAuctions: auctions.filter((a) =>
        ['scheduled', 'live', 'endingSoon'].includes(a.status),
      ).length,
      endingSoon: auctions.filter((a) => a.status === 'endingSoon').length,
      totalBids: SAMPLE_STORE.bids.length,
      totalLeads: new Set(SAMPLE_STORE.bids.map((b) => b.bidderEmail)).size,
    },
  };
}

export const MOCK_DASHBOARD_PAYLOAD = getMockDashboardPayload();
