import type { AuctionView, PublicAuctionProduct } from '../../../../lib/auction/types';
import {
  formatDateTime,
  getAuctionCountdownMs,
  hasAuctionEndTime,
  isAuctionLinkedToProduct,
  isCurrentProductLinkStatus,
} from '../../../../lib/auction/utils';
import { interpolateTranslation, type WidgetTranslationKey } from './i18n';

export type Translations = Record<WidgetTranslationKey, string>;

export type AuctionFilterValue = 'all' | 'active' | 'inactive';

export type TimerFilterValue =
  | 'all'
  | 'ending-1h'
  | 'ending-24h'
  | 'ending-7d'
  | 'scheduled'
  | 'paused'
  | 'ended';

export type ProductCard = {
  id: string;
  image: string;
  name: string;
  auction: AuctionView | null;
};

/** Status badge design states, one per visible auction status. */
export type BadgeState = 'live' | 'ending-soon' | 'scheduled' | 'paused' | 'ended' | 'sold' | 'none';

const PLACEHOLDER_ACCENTS = ['#d8c3a5', '#b9d4c2', '#d3c5e5', '#f0c9b6', '#bfd4e2', '#d9d8b2'];

function getAuctionStatusPriority(status: AuctionView['status']): number {
  if (status === 'live') return 0;
  if (status === 'endingSoon') return 1;
  if (status === 'scheduled') return 2;
  if (status === 'paused') return 3;
  if (status === 'sold') return 4;
  return 5;
}

function getAuctionRecencyScore(auction: AuctionView): number {
  return Math.max(new Date(auction.updatedAt).getTime(), new Date(auction.createdAt).getTime(), 0);
}

export function resolveProductAuction(
  auctions: Array<AuctionView>,
  productId: string,
): AuctionView | null {
  const matches = auctions.filter((item) => isAuctionLinkedToProduct(item, productId));

  const currentLinkedAuction = matches
    .filter((item) => isCurrentProductLinkStatus(item.status))
    .sort(
      (left, right) =>
        getAuctionStatusPriority(left.status) - getAuctionStatusPriority(right.status) ||
        getAuctionRecencyScore(right) - getAuctionRecencyScore(left),
    )[0];

  if (currentLinkedAuction) {
    return currentLinkedAuction;
  }

  return (
    matches
      .filter((item) => item.status === 'sold')
      .sort((left, right) => getAuctionRecencyScore(right) - getAuctionRecencyScore(left))[0] ?? null
  );
}

function createPlaceholderImage(label: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450"><rect width="600" height="450" fill="${accent}"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#172126" font-family="Arial, sans-serif" font-size="40" font-weight="700" letter-spacing="6">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function formatWixImageUrl(image?: string | null): string | null {
  if (!image) {
    return null;
  }

  if (!image.startsWith('wix:image://v1/')) {
    return image;
  }

  const [assetId, rest = ''] = image.replace('wix:image://v1/', '').split('/', 2);
  if (!assetId) {
    return null;
  }

  const fileName = rest.split('#')[0] || assetId;
  return `https://static.wixstatic.com/media/${assetId}/v1/fill/w_800,h_600,al_c,q_85,enc_auto/${fileName}`;
}

type RawProductMedia = {
  media?: {
    mainMedia?: { url?: string; image?: string | { url?: string } };
    main?: { url?: string; image?: string | { url?: string } };
  };
};

function readRawImageUrl(raw: unknown): string | null {
  const media = (raw as RawProductMedia | null)?.media;
  const main = media?.mainMedia ?? media?.main;
  const image = main?.image;
  return (
    formatWixImageUrl(main?.url) ??
    formatWixImageUrl(typeof image === 'string' ? image : image?.url) ??
    null
  );
}

export function mapProduct(product: PublicAuctionProduct, index: number): ProductCard {
  const imageUrl = formatWixImageUrl(product.mainImageUrl) ?? readRawImageUrl(product.raw);

  return {
    id: String(product.id ?? product._id ?? `product-${index}`),
    image:
      imageUrl ||
      createPlaceholderImage(
        `LOT ${String(index + 1).padStart(2, '0')}`,
        PLACEHOLDER_ACCENTS[index % PLACEHOLDER_ACCENTS.length],
      ),
    name: product.name?.trim() || 'Untitled Product',
    auction: product.auction ?? null,
  };
}

export function getBadgeState(auction: AuctionView | null): BadgeState {
  switch (auction?.status) {
    case 'live':
      return 'live';
    case 'endingSoon':
      return 'ending-soon';
    case 'scheduled':
      return 'scheduled';
    case 'paused':
      return 'paused';
    case 'sold':
      return 'sold';
    case 'closed':
    case 'reserveNotMet':
      return 'ended';
    default:
      return 'none';
  }
}

export function getAuctionLabel(auction: AuctionView, translations: Translations): string {
  switch (auction.status) {
    case 'paused':
      return translations.statusPaused;
    case 'endingSoon':
      return translations.statusEndingSoon;
    case 'reserveNotMet':
      return translations.statusReserveNotMet;
    case 'live':
      return translations.statusLive;
    case 'scheduled':
      return translations.statusScheduled;
    case 'closed':
      return translations.statusClosed;
    case 'sold':
      return translations.statusSold;
    default:
      return auction.status;
  }
}

export function formatCountdownCompact(distance: number): string {
  if (!Number.isFinite(distance)) {
    return 'Open';
  }

  if (distance <= 0) {
    return 'Closed';
  }

  const totalSeconds = Math.floor(distance / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  return days > 0
    ? `${days}d ${pad(hours)}h ${pad(minutes)}m`
    : `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

/** Timing line for a card. `now` is null during SSR and the first client render. */
export function formatAuctionTiming(
  auction: AuctionView,
  now: number | null,
  translations: Translations,
): string {
  if (auction.status === 'scheduled') {
    return interpolateTranslation(translations.timingStarts, {
      value: formatDateTime(auction.startTime),
    });
  }

  if (auction.status === 'live' || auction.status === 'endingSoon' || auction.status === 'paused') {
    if (now === null) {
      return '';
    }

    const remaining = getAuctionCountdownMs(auction, now);
    if (!Number.isFinite(remaining) || !hasAuctionEndTime(auction.endTime)) {
      return auction.status === 'paused' ? 'Paused (open-ended)' : 'Until manually ended';
    }

    return auction.status === 'paused'
      ? interpolateTranslation(translations.timingPausedWithLeft, {
          value: formatCountdownCompact(remaining),
        })
      : interpolateTranslation(translations.timingEndsIn, {
          value: remaining > 0 ? formatCountdownCompact(remaining) : translations.statusClosed,
        });
  }

  return interpolateTranslation(translations.timingEnded, {
    value: hasAuctionEndTime(auction.endTime) ? formatDateTime(auction.endTime) : 'Manually ended',
  });
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
