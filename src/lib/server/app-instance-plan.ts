import { appInstances } from '@wix/app-management';
import { auth } from '@wix/essentials';

import { planTierFromAppInstance } from '../auction/plans';
import type { InstalledAppPlan } from '../auction/types';

export async function readInstalledAppPlan(): Promise<InstalledAppPlan | null> {
  try {
    const elevatedGetAppInstance = auth.elevate(appInstances.getAppInstance);
    const response = await elevatedGetAppInstance();
    const instance = response.instance as any;
    if (!instance) {
      return null;
    }

    const isFree = instance.isFree;
    const packageName =
      instance.billing?.packageName?.trim() ||
      instance.billing?.planName?.trim() ||
      instance.planName?.trim() ||
      instance.packageName?.trim() ||
      null;

    return {
      tier: planTierFromAppInstance(isFree, packageName),
      isFree: Boolean(isFree),
      packageName,
      planName: packageName,
      billingCycle: instance.billing?.billingCycle
        ? String(instance.billing.billingCycle)
        : null,
      expirationDate: instance.billing?.expirationDate ?? null,
    };
  } catch (error) {
    console.warn('[auction] failed to read installed app plan', error);
    return null;
  }
}

export function isInstalledAppPlanEntitled(
  plan: InstalledAppPlan | null,
  settingsOrTier?: { planTier?: string; planName?: string | null } | string | null,
  now = Date.now(),
): boolean {
  const settingsTier =
    typeof settingsOrTier === 'string'
      ? settingsOrTier
      : settingsOrTier?.planTier;
  const settingsName =
    typeof settingsOrTier === 'object' && settingsOrTier !== null
      ? settingsOrTier.planName
      : undefined;

  const effectiveTier = (plan?.tier ?? settingsTier ?? '').trim().toLowerCase();
  const rawName = (
    plan?.packageName ??
    plan?.planName ??
    settingsName ??
    settingsTier ??
    ''
  ).trim().toLowerCase();

  // Pro and business plans are NEVER blocked from placing bids (case-insensitive)
  if (
    effectiveTier === 'pro' ||
    effectiveTier === 'business' ||
    rawName.includes('pro') ||
    rawName.includes('business') ||
    rawName.includes('starter') ||
    rawName.includes('premium') ||
    rawName.includes('enterprise')
  ) {
    return true;
  }

  if (!plan) return true;
  if (plan.isFree) return true;
  if (plan.expirationDate === null) return true;

  const expirationTime = Date.parse(plan.expirationDate);
  return Number.isFinite(expirationTime) && expirationTime > now;
}
