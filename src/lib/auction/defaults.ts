import { PLANS } from './plans';
import type { AppSettings, AuctionInput, AuctionStore, PlanTier } from './types';

export const PLAN_LIMITS: Record<PlanTier, number> = {
  basic: PLANS.basic.activeAuctions,
  pro: PLANS.pro.activeAuctions,
  business: PLANS.business.activeAuctions,
};

export const ENDING_SOON_WINDOW_MS = 60 * 60 * 1000;

export const DEFAULT_SETTINGS: AppSettings = {
  emailBiddingEnabled: false,
  emailWinnerPaymentLinkEnabled: false,
  businessName: 'Auction Manager for Stores',
  planTier: 'basic',
  defaultMinIncrement: 50,
  antiSnipingEnabled: true,
  antiSnipingWindowSeconds: 60,
  antiSnipingExtensionSeconds: 60,
  whatsappPhone: '',
  outbidNotificationEnabled: true,
  myBidsPageUrl: '',
  winnerCheckoutEmailEnabled: false,
  bidderConfirmationEnabled: true,
  bidDepositEnabled: false,
  bidDepositPercentage: 10,
  blockCartAndCheckout: true,
  blockAllCartAndCheckout: false,
  combinedWinnerCheckoutEnabled: true,
};

const now = new Date('2026-04-19T12:00:00.000Z');

const liveStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
const liveEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
const draftStart = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
const draftEnd = new Date(now.getTime() + 27 * 60 * 60 * 1000).toISOString();

export const EMPTY_AUCTION_INPUT: AuctionInput = {
  title: '',
  description: '',
  imageUrls: [],
  startingPrice: 0,
  reservePrice: null,
  startTime: '',
  endTime: '',
  lifecycle: 'published',
  minIncrement: null,
  antiSnipingEnabled: true,
  antiSnipingWindowSeconds: 60,
  antiSnipingExtensionSeconds: 60,
  paymentMade: false,
  productIds: [],
};

export const SAMPLE_STORE: AuctionStore = {
  settings: DEFAULT_SETTINGS,
  auctions: [
    {
      id: 'auction-mustang-1967',
      title: '1967 Ford Mustang Fastback',
      description:
        'Fresh paint, clean interior, V8 engine, and strong collector appeal. This is the demo live auction included for onboarding.',
      imageUrls: [
        'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
      ],
      startingPrice: 18500,
      reservePrice: 24000,
      startTime: liveStart,
      endTime: liveEnd,
      lifecycle: 'published',
      minIncrement: 100,
      antiSnipingEnabled: true,
      antiSnipingWindowSeconds: 60,
      antiSnipingExtensionSeconds: 60,
      winnerBidId: null,
      winnerCheckoutId: null,
      winnerCheckoutUrl: null,
      winnerCheckoutRecipientEmail: null,
      winnerCheckoutEmailSentAt: null,
      winnerPaymentUrl: null,
      winnerPaymentButtonLabel: null,
      winnerPaymentEmailSentAt: null,
      winnerPaymentEmailAttemptKey: null,
      winnerPaymentEmailLastSentKey: null,
      winnerOrderId: null,
      winnerPaidAt: null,
      pausedAt: null,
      pausedStartDelayMs: null,
      pausedTimeRemainingMs: null,
      paymentMade: false,
      productIds: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'auction-gwagon-draft',
      title: '2018 Mercedes-Benz G-Class',
      description:
        'Draft listing for a premium SUV. Use this record to test editing and scheduling controls.',
      imageUrls: [
        'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80',
      ],
      startingPrice: 62000,
      reservePrice: 70000,
      startTime: draftStart,
      endTime: draftEnd,
      lifecycle: 'draft',
      minIncrement: 250,
      antiSnipingEnabled: true,
      antiSnipingWindowSeconds: 60,
      antiSnipingExtensionSeconds: 60,
      winnerBidId: null,
      winnerCheckoutId: null,
      winnerCheckoutUrl: null,
      winnerCheckoutRecipientEmail: null,
      winnerCheckoutEmailSentAt: null,
      winnerPaymentUrl: null,
      winnerPaymentButtonLabel: null,
      winnerPaymentEmailSentAt: null,
      winnerPaymentEmailAttemptKey: null,
      winnerPaymentEmailLastSentKey: null,
      winnerOrderId: null,
      winnerPaidAt: null,
      pausedAt: null,
      pausedStartDelayMs: null,
      pausedTimeRemainingMs: null,
      paymentMade: false,
      productIds: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ],
  bids: [
    {
      id: 'bid-001',
      auctionId: 'auction-mustang-1967',
      bidderMemberId: null,
      bidderName: 'Amara James',
      bidderEmail: 'amara@example.com',
      bidderPhone: '+1 646 555 1201',
      amount: 19100,
      createdAt: new Date(now.getTime() - 50 * 60 * 1000).toISOString(),
      variantId: null,
      variantLabel: null,
      variantChoices: null,
    },
    {
      id: 'bid-002',
      auctionId: 'auction-mustang-1967',
      bidderMemberId: null,
      bidderName: 'Leo Carter',
      bidderEmail: 'leo@example.com',
      bidderPhone: '+1 404 555 9012',
      amount: 19800,
      createdAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      variantId: null,
      variantLabel: null,
      variantChoices: null,
    },
  ],
  notifications: [],
};
