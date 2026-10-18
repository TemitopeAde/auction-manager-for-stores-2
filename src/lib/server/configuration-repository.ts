import { items } from '@wix/data';
import { auth } from '@wix/essentials';

import { DEFAULT_SETTINGS } from '../auction/defaults';
import { normalizePlanTier } from '../auction/plans';
import type { AppSettings, PlanTier } from '../auction/types';
import { readInstalledAppPlan } from './app-instance-plan';

export const CONFIGURATION_COLLECTION_ID =
  '@hi-konsult/smart-auction-manager/Configuration';

interface ConfigurationCollectionItem {
  _id: string;
  emailBiddingEnabled?: boolean;
  emailWinnerPaymentLinkEnabled?: boolean;
  businessName?: string;
  planTier?: PlanTier | 'free' | 'starter';
  defaultMinIncrement?: number;
  antiSnipingEnabled?: boolean;
  antiSnipingWindowSeconds?: number;
  antiSnipingExtensionSeconds?: number;
  whatsappPhone?: string;
  outbidNotificationEnabled?: boolean;
  myBidsPageUrl?: string;
  winnerCheckoutEmailEnabled?: boolean;
  winnerTriggeredEmailId?: string;
  bidderConfirmationEnabled?: boolean;
  bidDepositEnabled?: boolean;
  bidDepositPercentage?: number;
  blockCartAndCheckout?: boolean;
  blockAllCartAndCheckout?: boolean;
  updatedAt?: Date | string;
}

function normalizeEmailList(value: string[] | string | null | undefined): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,;]+/) : [];

  return Array.from(
    new Set(
      values
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0),
    ),
  );
}

function normalizeSettings(item: ConfigurationCollectionItem | null): AppSettings {
  if (!item) {
    return DEFAULT_SETTINGS;
  }

  return {
    emailBiddingEnabled:
      typeof item.emailBiddingEnabled === 'boolean'
        ? item.emailBiddingEnabled
        : DEFAULT_SETTINGS.emailBiddingEnabled,
    emailWinnerPaymentLinkEnabled:
      typeof item.emailWinnerPaymentLinkEnabled === 'boolean'
        ? item.emailWinnerPaymentLinkEnabled
        : DEFAULT_SETTINGS.emailWinnerPaymentLinkEnabled,
    businessName: item.businessName ?? DEFAULT_SETTINGS.businessName,
    planTier: normalizePlanTier(item.planTier ?? DEFAULT_SETTINGS.planTier),
    defaultMinIncrement:
      typeof item.defaultMinIncrement === 'number'
        ? item.defaultMinIncrement
        : DEFAULT_SETTINGS.defaultMinIncrement,
    antiSnipingEnabled:
      typeof item.antiSnipingEnabled === 'boolean'
        ? item.antiSnipingEnabled
        : DEFAULT_SETTINGS.antiSnipingEnabled,
    antiSnipingWindowSeconds:
      typeof item.antiSnipingWindowSeconds === 'number'
        ? item.antiSnipingWindowSeconds
        : DEFAULT_SETTINGS.antiSnipingWindowSeconds,
    antiSnipingExtensionSeconds:
      typeof item.antiSnipingExtensionSeconds === 'number'
        ? item.antiSnipingExtensionSeconds
        : DEFAULT_SETTINGS.antiSnipingExtensionSeconds,
    whatsappPhone: item.whatsappPhone ?? DEFAULT_SETTINGS.whatsappPhone,
    outbidNotificationEnabled:
      typeof item.outbidNotificationEnabled === 'boolean'
        ? item.outbidNotificationEnabled
        : DEFAULT_SETTINGS.outbidNotificationEnabled,
    myBidsPageUrl: item.myBidsPageUrl ?? DEFAULT_SETTINGS.myBidsPageUrl,
    winnerCheckoutEmailEnabled:
      typeof item.winnerCheckoutEmailEnabled === 'boolean'
        ? item.winnerCheckoutEmailEnabled
        : Boolean(item.winnerTriggeredEmailId),
    bidderConfirmationEnabled:
      typeof item.bidderConfirmationEnabled === 'boolean'
        ? item.bidderConfirmationEnabled
        : DEFAULT_SETTINGS.bidderConfirmationEnabled,
    bidDepositEnabled:
      typeof item.bidDepositEnabled === 'boolean'
        ? item.bidDepositEnabled
        : DEFAULT_SETTINGS.bidDepositEnabled,
    bidDepositPercentage:
      typeof item.bidDepositPercentage === 'number'
        ? item.bidDepositPercentage
        : DEFAULT_SETTINGS.bidDepositPercentage,
    blockCartAndCheckout:
      typeof item.blockCartAndCheckout === 'boolean'
        ? item.blockCartAndCheckout
        : DEFAULT_SETTINGS.blockCartAndCheckout,
    blockAllCartAndCheckout:
      typeof item.blockAllCartAndCheckout === 'boolean'
        ? item.blockAllCartAndCheckout
        : DEFAULT_SETTINGS.blockAllCartAndCheckout,
  };
}

async function getConfigurationItem(): Promise<ConfigurationCollectionItem | null> {
  const elevatedQuery = auth.elevate(items.query);
  const result = await elevatedQuery(CONFIGURATION_COLLECTION_ID).limit(1).find();
  const [firstItem] = result.items;

  if (!firstItem) {
    return null;
  }

  return migrateNotificationDefaults(firstItem as unknown as ConfigurationCollectionItem);
}

// Bidder confirmation and outbid emails used to default to off, and every save
// persisted that value. Turn them on once for configurations last saved before
// the default changed; saving bumps updatedAt, so this never runs again.
const NOTIFICATION_DEFAULTS_CHANGED_AT = new Date('2026-10-01T00:00:00.000Z');

async function migrateNotificationDefaults(
  item: ConfigurationCollectionItem,
): Promise<ConfigurationCollectionItem> {
  const updatedAt = item.updatedAt ? new Date(item.updatedAt) : null;

  if (updatedAt && !(updatedAt < NOTIFICATION_DEFAULTS_CHANGED_AT)) {
    return item;
  }

  const migrated: ConfigurationCollectionItem = {
    ...item,
    bidderConfirmationEnabled: true,
    outbidNotificationEnabled: true,
    updatedAt: new Date(),
  };

  try {
    const elevatedUpdate = auth.elevate(items.update);
    await elevatedUpdate(CONFIGURATION_COLLECTION_ID, migrated);
    return migrated;
  } catch (error) {
    console.error('Failed to migrate notification defaults:', error);
    return item;
  }
}

export async function readSettings(): Promise<AppSettings> {
  const item = await getConfigurationItem();
  const settings = normalizeSettings(item);
  const installedPlan = await readInstalledAppPlan();

  if (!installedPlan) {
    return settings;
  }

  return {
    ...settings,
    planTier: installedPlan.tier,
  };
}

export async function saveConfigurationSettings(
  nextSettings: Partial<AppSettings>,
): Promise<AppSettings> {
  const existingItem = await getConfigurationItem();
  const merged = {
    ...DEFAULT_SETTINGS,
    ...normalizeSettings(existingItem),
    ...nextSettings,
  };

  const payload = {
    emailBiddingEnabled: merged.emailBiddingEnabled,
    emailWinnerPaymentLinkEnabled: merged.emailWinnerPaymentLinkEnabled,
    businessName: merged.businessName,
    planTier: normalizePlanTier(merged.planTier),
    defaultMinIncrement: merged.defaultMinIncrement,
    antiSnipingEnabled: merged.antiSnipingEnabled,
    antiSnipingWindowSeconds: merged.antiSnipingWindowSeconds,
    antiSnipingExtensionSeconds: merged.antiSnipingExtensionSeconds,
    whatsappPhone: merged.whatsappPhone,
    outbidNotificationEnabled: merged.outbidNotificationEnabled,
    myBidsPageUrl: merged.myBidsPageUrl,
    winnerCheckoutEmailEnabled: merged.winnerCheckoutEmailEnabled,
    bidderConfirmationEnabled: merged.bidderConfirmationEnabled,
    bidDepositEnabled: merged.bidDepositEnabled,
    bidDepositPercentage: merged.bidDepositPercentage,
    blockCartAndCheckout: merged.blockCartAndCheckout,
    blockAllCartAndCheckout: merged.blockAllCartAndCheckout,
    updatedAt: new Date(),
  };

  if (!existingItem) {
    const elevatedInsert = auth.elevate(items.insert);
    await elevatedInsert(CONFIGURATION_COLLECTION_ID, payload);
    return merged;
  }

  const elevatedUpdate = auth.elevate(items.update);
  await elevatedUpdate(CONFIGURATION_COLLECTION_ID, {
    _id: existingItem._id,
    ...payload,
  });

  return merged;
}
