import type { A11y, Direction } from '@wix/editor-react-types';
import type { SupportedLanguageCode } from '../../../../site/shared/languageCodes';

type PartProps = { className?: string };

export type AuctionProductsProps = {
  id: string;
  className?: string;
  direction?: Direction;
  a11y?: A11y;

  /** Heading shown above the products. */
  headerTitle?: string;
  /** Supporting line under the heading. */
  headerSubtitle?: string;
  /** Grid wraps cards into rows; carousel shows one scrollable row with arrows. */
  layout?: 'grid' | 'carousel';
  /** Language for the component's built-in labels. */
  language?: SupportedLanguageCode;
  /** Use the site visitor's language when it is supported, falling back to `language`. */
  autoDetectLanguage?: boolean;
  /**
   * Products fetched per page.
   * @min 4
   * @max 60
   */
  pageSize?: number;

  elementProps?: {
    header?: PartProps;
    title?: PartProps;
    subtitle?: PartProps;
    search?: PartProps;
    auctionFilter?: PartProps;
    timerFilter?: PartProps;
    card?: PartProps;
    statusBadge?: PartProps;
    productName?: PartProps;
    metaLabel?: PartProps;
    metaValue?: PartProps;
    timing?: PartProps;
    viewButton?: PartProps;
    bidButton?: PartProps;
    carouselArrow?: PartProps;
    loadMoreButton?: PartProps;
    bidDialog?: PartProps;
    dialogTitle?: PartProps;
    dialogInput?: PartProps;
    submitButton?: PartProps;
  };
};

export const defaultProps = {
  headerTitle: 'Live auctions',
  headerSubtitle: 'Bid on one-of-a-kind products before the timer runs out.',
  layout: 'grid',
  language: 'en',
  autoDetectLanguage: true,
  pageSize: 24,
} as const satisfies Omit<AuctionProductsProps, 'id' | 'className'>;
