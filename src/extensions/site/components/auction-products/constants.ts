export const ARIA_LABELS = {
  previousProducts: 'Previous auction products',
  nextProducts: 'Next auction products',
  closeBidDialog: 'Close bid form',
  placeBidOn: (productName: string) => `Place bid on ${productName}`,
  productImage: (index: number) => `Auction product ${index + 1}`,
} as const;

export const BIDDER_EMAIL_LABEL = 'Email address';
export const SKELETON_CARD_COUNT = 4;
export const SEARCH_DEBOUNCE_MS = 600;
export const REMOTE_BID_NOTICE_MS = 3200;
export const CLOSE_AFTER_SUCCESS_MS = 1000;
