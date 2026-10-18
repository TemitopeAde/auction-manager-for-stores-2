import type { AppSettings, AuctionLifecycle, PlanTier } from './types';

export type PlanFeatureKey =
  | 'antiSniping'
  | 'winnerCheckout'
  | 'bidConfirmationEmail'
  | 'ownerBidNotifications'
  | 'winnerCheckoutEmail'
  | 'outbidNotifications'
  | 'leads'
  | 'whatsapp'
  | 'blockCartDuringLive'
  | 'blockAllCart';

export interface PlanDefinition {
  id: PlanTier;
  name: string;
  monthlyPrice: number | null;
  recommended: boolean;
  bestFor: string;
  support: string;
  activeAuctions: number;
  draftAuctions: number;
  features: Record<PlanFeatureKey, boolean>;
}

const UNLIMITED = Number.POSITIVE_INFINITY;

const BASIC_FEATURES: Record<PlanFeatureKey, boolean> = {
  antiSniping: true,
  winnerCheckout: true,
  bidConfirmationEmail: true,
  ownerBidNotifications: true,
  winnerCheckoutEmail: true,
  outbidNotifications: true,
  leads: true,
  whatsapp: false,
  blockCartDuringLive: true,
  blockAllCart: true,
};

const PRO_FEATURES: Record<PlanFeatureKey, boolean> = {
  ...BASIC_FEATURES,
  leads: true,
  whatsapp: true,
};

export const PLANS: Record<PlanTier, PlanDefinition> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    monthlyPrice: null,
    recommended: false,
    bestFor: 'Trying one auction',
    support: 'Community',
    activeAuctions: 1,
    draftAuctions: 1,
    features: BASIC_FEATURES,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 6.5,
    recommended: true,
    bestFor: 'Growing stores',
    support: 'Email',
    activeAuctions: UNLIMITED,
    draftAuctions: UNLIMITED,
    features: PRO_FEATURES,
  },
  business: {
    id: 'business',
    name: 'Business',
    monthlyPrice: 12,
    recommended: false,
    bestFor: 'High-volume sellers',
    support: 'Dedicated',
    activeAuctions: UNLIMITED,
    draftAuctions: UNLIMITED,
    features: PRO_FEATURES,
  },
};

export const PLAN_ORDER: PlanTier[] = ['basic', 'pro', 'business'];

export function normalizePlanTier(value: unknown): PlanTier {
  if (typeof value !== 'string') {
    return 'basic';
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'basic' || normalized === 'pro' || normalized === 'business') {
    return normalized;
  }

  if (normalized === 'free') {
    return 'basic';
  }

  if (
    normalized.includes('business') ||
    normalized.includes('enterprise') ||
    normalized.includes('premium')
  ) {
    return 'business';
  }

  if (
    normalized.includes('pro') ||
    normalized.includes('starter') ||
    normalized.includes('plus')
  ) {
    return 'pro';
  }

  return 'basic';
}

export function planTierFromAppInstance(
  isFree: boolean | undefined,
  packageName: string | null | undefined,
): PlanTier {
  const name = (packageName ?? '').trim().toLowerCase();

  if (
    name.includes('business') ||
    name.includes('enterprise') ||
    name.includes('premium')
  ) {
    return 'business';
  }

  if (name.includes('pro') || name.includes('starter') || name.includes('plus')) {
    return 'pro';
  }

  if (name.includes('basic') || name.includes('free')) {
    return 'basic';
  }

  if (isFree !== false) {
    return 'basic';
  }

  return 'pro';
}

export function getPlan(tier: unknown): PlanDefinition {
  return PLANS[normalizePlanTier(tier)];
}

export function planAllows(tier: unknown, feature: PlanFeatureKey): boolean {
  return getPlan(tier).features[feature];
}

export function formatPlanLimit(limit: number): string {
  return Number.isFinite(limit) ? String(limit) : 'Unlimited';
}

export function formatPlanPrice(plan: PlanDefinition, currencyCode?: string): string {
  if (plan.monthlyPrice === null) {
    return 'Free';
  }

  const price = currencyCode
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 2,
      }).format(plan.monthlyPrice)
    : String(plan.monthlyPrice);

  return `${price}/mo`;
}

export function formatBillingCycle(cycle: string | null | undefined): string | null {
  switch (cycle) {
    case 'MONTHLY':
      return 'Billed monthly';
    case 'YEARLY':
      return 'Billed yearly';
    case 'TWO_YEARS':
      return 'Billed every 2 years';
    case 'THREE_YEARS':
      return 'Billed every 3 years';
    case 'FOUR_YEARS':
      return 'Billed every 4 years';
    case 'FIVE_YEARS':
      return 'Billed every 5 years';
    case 'ONE_TIME':
      return 'One-time purchase';
    default:
      return null;
  }
}

export function isAtPlanLimit(count: number, limit: number): boolean {
  return Number.isFinite(limit) && count >= limit;
}

export function occupiesActivePlanSlot(lifecycle: AuctionLifecycle): boolean {
  return lifecycle === 'published' || lifecycle === 'paused';
}

export function getPlanLimitError(
  plan: PlanDefinition,
  kind: 'active' | 'draft',
): string {
  const limit =
    kind === 'active' ? plan.activeAuctions : plan.draftAuctions;
  return `Your ${plan.name} plan allows ${formatPlanLimit(limit)} ${kind} auction(s). Upgrade to create more.`;
}

export function getFeatureUpgradeMessage(feature: PlanFeatureKey): string {
  if (feature === 'blockAllCart') {
    return 'Available on the Business plan.';
  }

  return 'Available on Pro and Business plans.';
}

export const PLAN_COMPARISON_ROWS: Array<{
  label: string;
  values: Record<PlanTier, string>;
}> = [
  {
    label: 'Price',
    values: {
      basic: 'Free',
      pro: '$6.50 / month',
      business: '$12 / month',
    },
  },
  {
    label: 'Active auctions',
    values: {
      basic: '1',
      pro: 'Unlimited',
      business: 'Unlimited',
    },
  },
  {
    label: 'Draft auctions',
    values: {
      basic: '1',
      pro: 'Unlimited',
      business: 'Unlimited',
    },
  },
  {
    label: 'Auction products widget',
    values: { basic: 'Included', pro: 'Included', business: 'Included' },
  },
  {
    label: 'Product-page bidding',
    values: { basic: 'Included', pro: 'Included', business: 'Included' },
  },
  {
    label: 'Winner checkout',
    values: { basic: 'Included', pro: 'Included', business: 'Included' },
  },
  {
    label: 'Anti-sniping',
    values: { basic: 'Included', pro: 'Included', business: 'Included' },
  },
  {
    label: 'Email notifications',
    values: { basic: 'Included', pro: 'Included', business: 'Included' },
  },
  {
    label: 'Lead list + CSV export',
    values: { basic: 'Included', pro: 'Included', business: 'Included' },
  },
  {
    label: 'WhatsApp contact',
    values: { basic: '—', pro: 'Included', business: 'Included' },
  },
  {
    label: 'Block cart for auction products',
    values: { basic: 'Included', pro: 'Included', business: 'Included' },
  },
  {
    label: 'Block cart for all products',
    values: { basic: 'Included', pro: 'Included', business: 'Included' },
  },
  {
    label: 'Support',
    values: {
      basic: 'Community',
      pro: 'Email',
      business: 'Dedicated',
    },
  },
];

export function applyPlanFeatureFlags(settings: AppSettings): AppSettings {
  const plan = getPlan(settings.planTier);

  return {
    ...settings,
    planTier: plan.id,
    antiSnipingEnabled:
      plan.features.antiSniping && settings.antiSnipingEnabled,
    bidderConfirmationEnabled:
      plan.features.bidConfirmationEmail && settings.bidderConfirmationEnabled,
    winnerCheckoutEmailEnabled:
      plan.features.winnerCheckoutEmail && settings.winnerCheckoutEmailEnabled,
    outbidNotificationEnabled:
      plan.features.outbidNotifications && settings.outbidNotificationEnabled,
    blockCartAndCheckout:
      plan.features.blockCartDuringLive && settings.blockCartAndCheckout,
    blockAllCartAndCheckout:
      plan.features.blockAllCart && settings.blockAllCartAndCheckout,
  };
}
