export type PlanTier = 'basic' | 'pro' | 'business';

export type AuctionLifecycle = 'draft' | 'published' | 'paused' | 'closed' | 'sold';

export type AuctionStatus =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'endingSoon'
  | 'paused'
  | 'closed'
  | 'sold'
  | 'reserveNotMet';

export interface AuctionRecord {
  id: string;
  title: string;
  description: string;
  imageUrls: string[];
  startingPrice: number;
  reservePrice: number | null;
  startTime: string;
  endTime: string;
  lifecycle: AuctionLifecycle;
  minIncrement: number | null;
  antiSnipingEnabled: boolean;
  antiSnipingWindowSeconds: number;
  antiSnipingExtensionSeconds: number;
  winnerBidId: string | null;
  winnerCheckoutId: string | null;
  winnerCheckoutUrl: string | null;
  winnerCheckoutRecipientEmail: string | null;
  winnerCheckoutEmailSentAt: string | null;
  winnerPaymentUrl: string | null;
  winnerPaymentButtonLabel: string | null;
  winnerPaymentEmailSentAt: string | null;
  winnerPaymentEmailAttemptKey: string | null;
  winnerPaymentEmailLastSentKey: string | null;
  pausedAt: string | null;
  pausedStartDelayMs: number | null;
  pausedTimeRemainingMs: number | null;
  paymentMade: boolean;
  productIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LeadRecord {
  id: string;
  auctionId: string;
  bidderName: string;
  bidderEmail: string;
  bidderPhone: string;
  amount: number;
  createdAt: string;
}

export interface BidRecord {
  id: string;
  auctionId: string;
  bidderMemberId: string | null;
  bidderName: string;
  bidderEmail: string;
  bidderPhone: string;
  amount: number;
  createdAt: string;
  variantId: string | null;
  variantLabel: string | null;
  variantChoices: Record<string, string> | null;
}

export interface NotificationRecord {
  id: string;
  auctionId: string;
  audience: 'owner' | 'bidder' | 'winner';
  channel: 'dashboard' | 'whatsapp';
  message: string;
  createdAt: string;
}

export interface InstalledAppPlan {
  tier: PlanTier;
  isFree: boolean;
  packageName: string | null;
  planName?: string | null;
  billingCycle: string | null;
  expirationDate: string | null;
}

export interface AppSettings {
  emailBiddingEnabled: boolean;
  emailWinnerPaymentLinkEnabled: boolean;
  businessName: string;
  planTier: PlanTier;
  defaultMinIncrement: number;
  antiSnipingEnabled: boolean;
  antiSnipingWindowSeconds: number;
  antiSnipingExtensionSeconds: number;
  whatsappPhone: string;
  outbidNotificationEnabled: boolean;
  myBidsPageUrl: string;
  winnerCheckoutEmailEnabled: boolean;
  bidderConfirmationEnabled: boolean;
  bidDepositEnabled: boolean;
  bidDepositPercentage: number;
  blockCartAndCheckout: boolean;
  blockAllCartAndCheckout: boolean;
}

export interface WinnerPaymentDetails {
  url: string;
  buttonLabel: string;
}

export interface WinnerActionPayload extends DashboardPayload {
  winnerPaymentEmailError?: string;
}

export interface AuctionStore {
  settings: AppSettings;
  auctions: AuctionRecord[];
  bids: BidRecord[];
  notifications: NotificationRecord[];
}

export interface BidSummary {
  id: string;
  bidderMemberId: string | null;
  bidderName: string;
  bidderEmail: string;
  bidderPhone: string;
  amount: number;
  createdAt: string;
  variantId: string | null;
  variantLabel: string | null;
  variantChoices: Record<string, string> | null;
}

export interface AuctionView extends AuctionRecord {
  bidCount: number;
  currentHighestBid: number | null;
  currentHighestBidId: string | null;
  reserveReached: boolean;
  minimumNextBid: number;
  effectiveMinIncrement: number;
  status: AuctionStatus;
  recentBids: BidSummary[];
  winner: BidSummary | null;
  highestBidByVariant: Record<string, number>;
  highestUnscopedBid: number | null;
}

export interface DashboardSummary {
  totalAuctions: number;
  activeAuctions: number;
  endingSoon: number;
  totalBids: number;
  totalLeads: number;
}

export interface DashboardPayload {
  generatedAt: string;
  settings: AppSettings;
  installedPlan: InstalledAppPlan | null;
  summary: DashboardSummary;
  auctions: AuctionView[];
  notifications: NotificationRecord[];
  leads: LeadRecord[];
  currency: string;
  /** The Wix site's display name, when it can be read. */
  siteName?: string | null;
}

export interface DashboardMonitorPayload {
  generatedAt: string;
  currency: string;
  summary: DashboardSummary;
  activeAuctions: AuctionView[];
}

export interface DashboardAuctionQuery {
  search?: string;
  status?: 'all' | AuctionStatus;
  lifecycle?: 'all' | AuctionLifecycle;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
  /** Attach each auction's linked store product to the rows. */
  includeLinkedProducts?: boolean;
}

export interface DashboardAuctionLinkedProduct {
  id: string;
  name: string;
  imageUrl: string | null;
}

export interface DashboardAuctionRow extends AuctionView {
  /**
   * Store product linked to the auction. Present only when the query sets
   * `includeLinkedProducts`; null when the product could not be loaded.
   */
  linkedProduct?: DashboardAuctionLinkedProduct | null;
}

export interface DashboardAuctionResult {
  rows: DashboardAuctionRow[];
  total: number;
}

export interface DashboardLeadQuery {
  search?: string;
  auctionId?: string | 'all';
}

export interface DashboardLeadSearchQuery extends DashboardLeadQuery {
  page?: number;
  pageSize?: number;
}

export interface DashboardLeadResult {
  rows: DashboardLeadView[];
  total: number;
}

export interface ExportLeadsCsvInput extends DashboardLeadQuery {
  leadIds?: string[];
}

export interface PublicAuctionSettings {
  canSubmitBid: boolean;
  emailBiddingEnabled: boolean;
  winnerCheckoutEmailEnabled: boolean;
  planTier?: PlanTier;
  planName?: string | null;
}

export interface SendLeadEmailsInput {
  leadIds: string[];
  subject: string;
  html: string;
}

export interface SendLeadEmailsResult {
  recipientCount: number;
}

export interface SendWinnerCheckoutEmailInput {
  auctionId: string;
  bidderMemberId?: string | null;
  bidderEmail?: string | null;
}

export interface SendWinnerCheckoutEmailResult {
  sent: boolean;
  sentAt: string | null;
}

export interface AuctionBidsQuery {
  auctionId: string;
  search?: string;
  winner?: 'all' | 'winner' | 'others';
  page?: number;
  pageSize?: number;
}

export interface AuctionBidsResult {
  rows: BidSummary[];
  total: number;
}

export interface MemberAuctionBidsQuery {
  auctionId: string;
  bidderMemberId?: string | null;
  bidderEmail?: string | null;
}

export interface MemberBidSummary {
  id: string;
  amount: number;
  createdAt: string;
  variantId: string | null;
  variantLabel: string | null;
}

export type MemberBidStatus =
  | 'notParticipated'
  | 'leading'
  | 'outbid'
  | 'won'
  | 'lost';

export interface DashboardLeadView {
  auction: AuctionView;
  bid: LeadRecord;
}

export interface DashboardProductQuery {
  search?: string;
  auctionLink?: 'all' | 'linked' | 'unlinked';
  page?: number;
  pageSize?: number;
}

export interface DashboardProductRow {
  id: string;
  name: string;
  sku: string;
  auctions: AuctionView[];
}

export interface DashboardProductResult {
  rows: DashboardProductRow[];
  total: number;
}

export interface StoreProductSearchQuery {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface StoreProductSearchResult {
  products: any[];
  total: number;
}

export interface DashboardPageContextInput {
  productId?: string;
  productName?: string;
  returnToStores?: boolean;
  tab?: 'overview' | 'monitor' | 'auctions';
}

export type PublicAuctionProductFilter = 'all' | 'active' | 'inactive';

export type PublicAuctionTimerFilter =
  | 'all'
  | 'ending-1h'
  | 'ending-24h'
  | 'ending-7d'
  | 'scheduled'
  | 'paused'
  | 'ended';

export interface PublicAuctionProductQuery {
  search?: string;
  auctionFilter?: PublicAuctionProductFilter;
  timerFilter?: PublicAuctionTimerFilter;
  cursor?: string | null;
  pageSize?: number;
}

export interface PublicAuctionProduct {
  id: string;
  _id: string;
  name: string;
  slug: string;
  mainImageUrl: string | null;
  priceRange: {
    min: number | string | null;
    max: number | string | null;
    currency: string | null;
  };
  raw: unknown;
  auction: AuctionView | null;
}

export interface PublicAuctionProductsResult {
  products: PublicAuctionProduct[];
  cursor: string | null;
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface AuctionInput {
  title: string;
  description: string;
  imageUrls: string[];
  startingPrice: number;
  reservePrice: number | null;
  startTime: string;
  endTime: string;
  lifecycle: AuctionLifecycle;
  minIncrement: number | null;
  antiSnipingEnabled: boolean;
  antiSnipingWindowSeconds: number;
  antiSnipingExtensionSeconds: number;
  paymentMade: boolean;
  productIds: string[];
}

export interface BidInput {
  bidderMemberId?: string | null;
  bidderName?: string;
  bidderEmail: string;
  bidderPhone?: string;
  amount: number;
  productId?: string | null;
  variantId?: string | null;
  variantLabel?: string | null;
  variantChoices?: Record<string, string> | null;
}

export interface ProductVariantOption {
  id: string;
  label: string;
  choices: Record<string, string>;
}

export interface ProductVariantState {
  productId: string;
  catalogVersion: 'V1_CATALOG' | 'V3_CATALOG' | 'STORES_NOT_INSTALLED';
  variants: ProductVariantOption[];
  variantsRequired: boolean;
}
