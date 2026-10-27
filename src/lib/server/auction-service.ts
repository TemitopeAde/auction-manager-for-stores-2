import { AsyncLocalStorage } from 'node:async_hooks';
import { Permissions, webMethod } from './permissions';
import { checkout } from '@wix/ecom';
import { catalogVersioning, products, productsV3 } from '@wix/stores';
import { siteProperties } from '@wix/business-tools';
import { appInstances } from '@wix/app-management';
import { plugins } from '@wix/site-plugins';
import { activations } from '@wix/automations';
import { auth, httpClient } from '@wix/essentials';

import { DEFAULT_SETTINGS, EMPTY_AUCTION_INPUT } from '../auction/defaults';
import {
  shouldStartNewPaymentEmailAttempt,
  validateWinnerPaymentDetails,
} from '../auction/winner-payment';
import {
  getFeatureUpgradeMessage,
  getPlan,
  getPlanLimitError,
  isAtPlanLimit,
  occupiesActivePlanSlot,
  planAllows,
} from '../auction/plans';
import {
  createCsv,
  createLeadsCsv,
  createId,
  createNotification,
  formatCurrency,
  formatDateTime,
  getAuctionStatus,
  hasAuctionEndTime,
  isAuctionLinkedToProduct,
  isValidDate,
  isCurrentProductLinkStatus,
  reservesProductForAuction,
  getBidsRelevantToVariant,
  getMinimumNextBidAmount,
  sortBidsDescending,
  toAuctionView,
  toBidSummary,
} from '../auction/utils';
import type {
  AppSettings,
  AuctionBidsQuery,
  AuctionBidsResult,
  AuctionInput,
  AuctionLifecycle,
  AuctionRecord,
  AuctionView,
  BidRecord,
  BidInput,
  BidSummary,
  DashboardMonitorPayload,
  DashboardAuctionQuery,
  DashboardAuctionResult,
  DashboardPageContextInput,
  DashboardLeadQuery,
  DashboardLeadResult,
  DashboardLeadSearchQuery,
  DashboardLeadView,
  ExportLeadsCsvInput,
  DashboardPayload,
  DashboardProductQuery,
  DashboardProductResult,
  DashboardProductRow,
  StoreProductSearchQuery,
  StoreProductSearchResult,
  MemberAuctionBidsQuery,
  MemberBidSummary,
  PublicAuctionProduct,
  PublicAuctionProductFilter,
  PublicAuctionProductQuery,
  PublicAuctionProductsResult,
  PublicAuctionTimerFilter,
  PublicAuctionSettings,
  SendLeadEmailsInput,
  SendLeadEmailsResult,
  SendWinnerCheckoutEmailInput,
  SendWinnerCheckoutEmailResult,
  ProductVariantState,
  WinnerActionPayload,
  WinnerPaymentDetails,
} from '../auction/types';
import {
  SITE_PLUGIN_DEFINITIONS,
  type SitePluginPlacementStatusResult,
} from '../site-plugins/catalog';
import {
  createAuctionRecord,
  deleteAuctionRecord,
  deleteAuctionRecords,
  findAuctionsByProductIds,
  getAuctionRecordById,
  listAuctionRecords,
  patchAuctionRecord,
  updateAuctionRecord,
} from './auction-repository';
import {
  listAllBids,
  deleteBidRecord,
  deleteBidsByAuctionId,
  deleteBidsByAuctionIds,
  getBidRecordById,
  listBidsByAuctionId,
  insertBidRecord,
} from './bid-repository';
import {
  listNotifications,
  insertNotification,
} from './notification-repository';
import {
  readSettings,
  saveConfigurationSettings,
} from './configuration-repository';
import { isInstalledAppPlanEntitled, readInstalledAppPlan } from './app-instance-plan';
import {
  deleteLeadsByAuctionId,
  deleteLeadsForEmail,
  insertLeadRecord,
  listLeads,
} from './lead-repository';
import {
  catalogReferenceOptions,
  getProductVariantState as loadProductVariantState,
  resolveBidVariant,
} from './product-variants';
import {
  buildBidderConfirmationEmail,
  buildOutbidNotificationEmail,
  buildOwnerBidNotificationEmail,
  buildWinnerCheckoutEmail,
  buildWinnerPaymentLinkEmail,
  createIdempotencyKey,
  isBlankHtml,
  isValidIdempotencyKey,
  sendAuctionEmail,
} from './auction-emails';

const WIX_STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';
const NEW_BID_NOTIFICATION_TEMPLATE_ID = 'e24efc50-48f2-45a8-9e12-c1d40ffd8670';
const NOTIFICATIONS_NOTIFY_URL = 'https://www.wixapis.com/notifications/v3/notifications/notify';
const DEFAULT_AUCTION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

async function sendSavedWinnerPaymentEmail(
  auction: AuctionRecord,
  winner: BidSummary,
  settings: AppSettings,
): Promise<string | null> {
  const recipientEmail = normalizeEmail(winner.bidderEmail);
  if (!recipientEmail || !auction.winnerPaymentUrl || !auction.winnerPaymentButtonLabel || !auction.winnerPaymentEmailAttemptKey) {
    return 'Winner payment email details are incomplete.';
  }

  try {
    const emailAttemptKey = isValidIdempotencyKey(auction.winnerPaymentEmailAttemptKey)
      ? auction.winnerPaymentEmailAttemptKey
      : createIdempotencyKey();
    const emailAuction = emailAttemptKey === auction.winnerPaymentEmailAttemptKey
      ? auction
      : await patchAuctionRecord(auction.id, auction, {
          winnerPaymentEmailAttemptKey: emailAttemptKey,
        });
    const email = buildWinnerPaymentLinkEmail({
      businessName: settings.businessName,
      auctionTitle: auction.title,
      bidderName: winner.bidderName,
      paymentUrl: auction.winnerPaymentUrl,
      buttonLabel: auction.winnerPaymentButtonLabel,
    });

    await sendAuctionEmail({
      senderName: settings.businessName,
      recipients: [{ email: recipientEmail, name: winner.bidderName }],
      subject: email.subject,
      html: email.html,
      idempotencyKey: emailAttemptKey,
    });
    await patchAuctionRecord(auction.id, emailAuction, {
      winnerPaymentEmailSentAt: new Date().toISOString(),
      winnerPaymentEmailLastSentKey: emailAttemptKey,
    });
    return null;
  } catch (error) {
    console.error('[auction] winner payment email failed:', error);
    return 'Winner selected, but the payment email could not be sent. Use Resend email to try again.';
  }
}

type OutbidNotificationContext = {
  previousHighBid: BidRecord;
  newHighBid: BidRecord;
  auction: AuctionRecord;
  auctionEndTime: string;
  placeNewBidUrl: string;
  myBidsDashboardUrl: string;
  currencyCode: string;
  productName: string;
};

type StoreProductSnapshot = {
  id: string;
  name: string;
  description: string;
  imageUrls: string[];
};

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeEmailList(values: string[] | null | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => normalizeEmail(value))
        .filter((value) => value.length > 0),
    ),
  );
}

async function readSiteOwnerEmail(): Promise<string> {
  try {
    const elevatedGetAppInstance = auth.elevate(appInstances.getAppInstance);
    const response = await elevatedGetAppInstance();
    return normalizeEmail(
      response.site?.ownerInfo?.email ?? response.site?.ownerEmail ?? '',
    );
  } catch (error) {
    console.warn('[auction] failed to fetch site owner email', error);
    return '';
  }
}

async function resolveOwnerNotificationEmails(): Promise<string[]> {
  return normalizeEmailList([await readSiteOwnerEmail()]);
}

async function sendBidNotificationEmails(
  settings: AppSettings,
  auction: AuctionRecord,
  bid: BidRecord,
): Promise<void> {
  const emailTasks: Promise<number>[] = [];
  const ownerNotificationEmails = await resolveOwnerNotificationEmails();
  const bidAmount = String(bid.amount);

  if (
    planAllows(settings.planTier, 'ownerBidNotifications') &&
    ownerNotificationEmails.length === 0
  ) {
    console.warn(
      '[auction] skipping owner bid email: no site owner email was returned by the instance SDK',
    );
  } else if (planAllows(settings.planTier, 'ownerBidNotifications')) {
    const ownerEmail = buildOwnerBidNotificationEmail({
      businessName: settings.businessName,
      auctionTitle: auction.title,
      bidAmount,
      bidderName: bid.bidderName,
      bidderEmail: bid.bidderEmail,
      bidderPhone: bid.bidderPhone || '',
    });

    console.log(
      '[auction] sending owner bid email',
      JSON.stringify({
        auctionId: auction.id,
        bidId: bid.id,
        recipients: ownerNotificationEmails,
      }),
    );

    for (const email of ownerNotificationEmails) {
      emailTasks.push(
        sendAuctionEmail({
          senderName: settings.businessName,
          recipients: [{ email, name: settings.businessName }],
          subject: ownerEmail.subject,
          html: ownerEmail.html,
        }),
      );
    }
  }

  if (
    planAllows(settings.planTier, 'bidConfirmationEmail') &&
    settings.bidderConfirmationEnabled &&
    normalizeEmail(bid.bidderEmail)
  ) {
    const bidderEmail = buildBidderConfirmationEmail({
      businessName: settings.businessName,
      auctionTitle: auction.title,
      bidAmount,
      bidderName: bid.bidderName,
    });

    emailTasks.push(
      sendAuctionEmail({
        senderName: settings.businessName,
        recipients: [{ email: bid.bidderEmail, name: bid.bidderName }],
        subject: bidderEmail.subject,
        html: bidderEmail.html,
      }),
    );
  }

  if (emailTasks.length === 0) {
    return;
  }

  const results = await Promise.allSettled(emailTasks);
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.warn('[auction] bid email send failed', result.reason);
    }
  });
}

function isSameBidder(left: BidInput | BidRecord, right: BidInput | BidRecord): boolean {
  if (
    left.bidderMemberId &&
    right.bidderMemberId &&
    left.bidderMemberId.trim() &&
    left.bidderMemberId === right.bidderMemberId
  ) {
    return true;
  }

  return normalizeEmail(left.bidderEmail) !== '' &&
    normalizeEmail(left.bidderEmail) === normalizeEmail(right.bidderEmail);
}

async function readSiteDisplayName(): Promise<string | null> {
  try {
    const props = await auth.elevate(siteProperties.getSiteProperties)({
      fields: ['siteDisplayName'],
    });

    return props.properties?.siteDisplayName?.trim() || null;
  } catch (error) {
    console.warn('[auction] failed to fetch site display name', error);
    return null;
  }
}

async function readSiteCurrency(): Promise<string> {
  try {
    const props = await auth.elevate(siteProperties.getSiteProperties)({
      fields: ['paymentCurrency'],
    });

    const currency = props.properties?.paymentCurrency?.trim();
    if (!currency) {
      throw new Error('The site currency is not configured.');
    }

    return currency;
  } catch (error) {
    console.warn('[auction] failed to fetch site currency', error);
    throw error;
  }
}

function normalizeImageUrls(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0),
    ),
  );
}

function getStoreProductDescription(product: any): string {
  const description =
    product?.description ??
    product?.plainDescription ??
    product?.product?.description ??
    product?.product?.plainDescription ??
    '';

  return typeof description === 'string' ? description.trim() : '';
}

function getStoreProductImageUrls(product: any): string[] {
  return normalizeImageUrls([
    product?.mainImageUrl,
    product?.media?.mainMedia?.url,
    product?.media?.mainMedia?.image?.url,
    product?.media?.main?.url,
    product?.media?.main?.image?.url,
    ...(Array.isArray(product?.media?.items)
      ? product.media.items.map((item: any) => item?.image?.url ?? item?.url)
      : []),
    ...(Array.isArray(product?.media?.itemsInfo?.items)
      ? product.media.itemsInfo.items.map((item: any) => item?.image?.url ?? item?.url)
      : []),
  ]);
}

function toStoreProductSnapshot(product: any): StoreProductSnapshot {
  const id = String(product?._id ?? product?.id ?? product?.product?._id ?? product?.product?.id ?? '');
  const name = String(product?.name ?? product?.product?.name ?? 'Untitled product').trim();

  return {
    id,
    name: name || 'Untitled product',
    description: getStoreProductDescription(product),
    imageUrls: getStoreProductImageUrls(product),
  };
}

// Loads the products for one page of auctions. A product that fails to load is
// left out so the table still renders.
async function getStoreProductSnapshotsByIds(
  productIds: string[],
): Promise<Map<string, StoreProductSnapshot>> {
  const snapshots = new Map<string, StoreProductSnapshot>();
  if (productIds.length === 0) return snapshots;

  const { catalogVersion } = await catalogVersioning.getCatalogVersion();
  if (catalogVersion === 'STORES_NOT_INSTALLED') return snapshots;

  await Promise.all(
    productIds.map(async (productId) => {
      try {
        const product = catalogVersion === 'V3_CATALOG'
          ? await productsV3.getProduct(productId)
          : await products.getProduct(productId);
        snapshots.set(productId, toStoreProductSnapshot(product));
      } catch (error) {
        console.warn('[auction] failed to load linked product', { productId, error });
      }
    }),
  );

  return snapshots;
}

async function getStoreProductSnapshot(productId: string): Promise<StoreProductSnapshot> {
  const { catalogVersion } = await catalogVersioning.getCatalogVersion();
  if (catalogVersion === 'STORES_NOT_INSTALLED') {
    throw new Error('Wix Stores must be installed to create an auction.');
  }

  const product = catalogVersion === 'V3_CATALOG'
    ? await productsV3.getProduct(productId)
    : await products.getProduct(productId);
  const snapshot = toStoreProductSnapshot(product);

  if (!snapshot.id || snapshot.id !== productId) {
    throw new Error('Select a valid Wix Stores product for this auction.');
  }

  return snapshot;
}

function mergeAuctionInputWithProduct(
  input: AuctionInput,
  product: StoreProductSnapshot,
): AuctionInput {
  return {
    ...input,
    title: input.title.trim() || product.name,
    description: input.description.trim() || product.description,
    imageUrls: input.imageUrls.length > 0 ? input.imageUrls : product.imageUrls,
    productIds: [product.id],
  };
}

function getProductPageUrl(product: any): string {
  const rawUrl =
    product?.product?.productPageUrl?.url ??
    product?.product?.productPageUrl?.base ??
    product?.product?.url?.url ??
    product?.productPageUrl?.url ??
    product?.productPageUrl?.base ??
    product?.url?.url ??
    '';

  return typeof rawUrl === 'string' ? rawUrl.trim() : '';
}

function getProductName(product: any, auction: AuctionRecord): string {
  const rawName = product?.product?.name ?? product?.name ?? auction.title;
  return typeof rawName === 'string' && rawName.trim() ? rawName.trim() : auction.title;
}

async function getAuctionNotificationLinkData(
  auction: AuctionRecord,
): Promise<{ placeNewBidUrl: string; productName: string }> {
  const productId = auction.productIds[0];

  if (!productId) {
    return {
      placeNewBidUrl: '',
      productName: auction.title,
    };
  }

  try {
    const product = await products.getProduct(productId);

    return {
      placeNewBidUrl: getProductPageUrl(product),
      productName: getProductName(product, auction),
    };
  } catch (error) {
    console.warn('[auction] failed to fetch product link data for notifications', {
      auctionId: auction.id,
      productId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      placeNewBidUrl: '',
      productName: auction.title,
    };
  }
}

async function sendOutbidNotification(
  settings: AppSettings,
  context: OutbidNotificationContext,
): Promise<boolean> {
  if (
    !planAllows(settings.planTier, 'outbidNotifications') ||
    !settings.outbidNotificationEnabled
  ) {
    return false;
  }

  const recipientEmail = normalizeEmail(context.previousHighBid.bidderEmail);

  if (!recipientEmail) {
    return false;
  }

  const previousBidAmount = formatCurrency(context.previousHighBid.amount, context.currencyCode);
  const currentHighestBid = formatCurrency(context.newHighBid.amount, context.currencyCode);
  const auctionEndDate = formatDateTime(context.auctionEndTime);
  const email = buildOutbidNotificationEmail({
    businessName: settings.businessName,
    auctionTitle: context.auction.title,
    productName: context.productName,
    previousBidAmount,
    currentHighestBid,
    auctionEndDate,
    placeNewBidUrl: context.placeNewBidUrl,
    myBidsDashboardUrl: context.myBidsDashboardUrl,
  });

  await sendAuctionEmail({
    senderName: settings.businessName,
    recipients: [
      {
        email: recipientEmail,
        name: context.previousHighBid.bidderName,
      },
    ],
    subject: email.subject,
    html: email.html,
  });

  return true;
}

async function sendNewBidWixNotification(bid: BidRecord): Promise<void> {
  const elevatedFetchWithAuth = auth.elevate(httpClient.fetchWithAuth);
  const payload = {
    notificationTemplateId: NEW_BID_NOTIFICATION_TEMPLATE_ID,
    dynamicValues: {
      ' email': {
        text: bid.bidderEmail,
      },
    },
  };

  console.log(
    '[auction-web] notifications API call starting',
    JSON.stringify({
      endpoint: NOTIFICATIONS_NOTIFY_URL,
      notificationTemplateId: NEW_BID_NOTIFICATION_TEMPLATE_ID,
      dynamicValueKeys: Object.keys(payload.dynamicValues),
      auctionId: bid.auctionId,
      bidId: bid.id,
      bidderEmail: bid.bidderEmail,
    }),
  );

  const response = await elevatedFetchWithAuth(NOTIFICATIONS_NOTIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const responseText = await response.text().catch(() => '');

  console.log(
    '[auction-web] notifications API call completed',
    JSON.stringify({
      auctionId: bid.auctionId,
      bidId: bid.id,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      responseBody: responseText,
    }),
  );

  if (!response.ok) {
    throw new Error(
      `Wix notification failed with ${response.status}: ${responseText || response.statusText}`,
    );
  }
}

async function createWinnerCheckout(
  auction: AuctionRecord,
  winningBid: BidSummary,
): Promise<{ checkoutId: string; checkoutUrl: string }> {
  if (auction.productIds.length === 0) {
    throw new Error('This auction has no linked product to generate checkout for.');
  }

  const options = catalogReferenceOptions(
    winningBid.variantId,
    winningBid.variantChoices,
  );

  const createdCheckout = await checkout.createCheckout({
    channelType: 'WEB',
    lineItems: auction.productIds.map((productId, index) => ({
      catalogReference: {
        appId: WIX_STORES_APP_ID,
        catalogItemId: productId,
        ...(index === 0 && options ? { options } : {}),
      },
      quantity: 1,
    })),
    checkoutInfo: {
      buyerInfo: {
        email: winningBid.bidderEmail,
      },
    },
  });

  const checkoutId = createdCheckout._id;

  if (!checkoutId) {
    throw new Error('Checkout was created but no checkout ID was returned.');
  }

  const { checkoutUrl } = await checkout.getCheckoutUrl(checkoutId);

  if (!checkoutUrl) {
    throw new Error('Checkout was created but no checkout URL was returned.');
  }

  return {
    checkoutId,
    checkoutUrl,
  };
}

async function resolveWinnerCheckoutByProduct(
  productId: string,
  bidderMemberId?: string | null,
  bidderEmail?: string | null,
): Promise<string | null> {
  const auctions = await listAuctionRecords();
  const soldAuctions = auctions
    .filter(
      (auction) =>
        auction.lifecycle === 'sold' &&
        isAuctionLinkedToProduct(auction, productId) &&
        auction.winnerBidId &&
        auction.winnerCheckoutUrl,
    )
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );

  for (const auction of soldAuctions) {
    const bids = await listBidsByAuctionId(auction.id);
    const winnerBid = bids.find((bid) => bid.id === auction.winnerBidId) ?? null;

    if (!winnerBid) {
      continue;
    }

    const memberMatch =
      bidderMemberId &&
      winnerBid.bidderMemberId &&
      winnerBid.bidderMemberId === bidderMemberId;
    const emailMatch =
      normalizeEmail(bidderEmail) !== '' &&
      normalizeEmail(winnerBid.bidderEmail) === normalizeEmail(bidderEmail);

    if (memberMatch || emailMatch) {
      return auction.winnerCheckoutUrl;
    }
  }

  return null;
}

function toMemberBidSummary(bid: BidRecord): MemberBidSummary {
  return {
    id: bid.id,
    amount: bid.amount,
    createdAt: bid.createdAt,
    variantId: bid.variantId ?? null,
    variantLabel: bid.variantLabel ?? null,
  };
}

function bidderMatchesIdentity(
  bid: BidRecord,
  bidderMemberId?: string | null,
  bidderEmail?: string | null,
): boolean {
  const normalizedMemberId = (bidderMemberId ?? '').trim();
  const normalizedEmail = normalizeEmail(bidderEmail);

  if (normalizedMemberId && bid.bidderMemberId === normalizedMemberId) {
    return true;
  }

  if (normalizedEmail && normalizeEmail(bid.bidderEmail) === normalizedEmail) {
    return true;
  }

  return false;
}

function sanitizeAuctionInput(input: AuctionInput, settings: AppSettings): AuctionInput {
  const title = input.title.trim();
  const description = input.description.trim();
  const imageUrls = input.imageUrls
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
  const productIds = Array.from(
    new Set((input.productIds || []).map((productId) => productId.trim()).filter(Boolean)),
  );

  // Title and description are optional; an empty title falls back to the product name.

  if (productIds.length !== 1) {
    throw new Error('Select exactly one product for this auction.');
  }

  if (!isValidDate(input.startTime)) {
    throw new Error('Start time must be a valid date.');
  }

  const startMs = new Date(input.startTime).getTime();
  const endTime = isValidDate(input.endTime) ? input.endTime : '';

  if (endTime && startMs >= new Date(endTime).getTime()) {
    throw new Error('Auction end time must be later than the start time.');
  }

  if (input.startingPrice <= 0) {
    throw new Error('Starting price must be greater than zero.');
  }

  if (input.reservePrice !== null && input.reservePrice < input.startingPrice) {
    throw new Error('Reserve price must be at least the starting price.');
  }

  return {
    ...input,
    title,
    description,
    endTime,
    imageUrls,
    minIncrement: input.minIncrement ?? settings.defaultMinIncrement,
    antiSnipingEnabled:
      planAllows(settings.planTier, 'antiSniping') && input.antiSnipingEnabled,
    antiSnipingWindowSeconds: Math.max(30, input.antiSnipingWindowSeconds),
    antiSnipingExtensionSeconds: Math.max(30, input.antiSnipingExtensionSeconds),
    paymentMade: Boolean(input.paymentMade),
    productIds,
  };
}

function mapAuctions(
  auctions: AuctionRecord[],
  bids: BidRecord[],
  settings: AppSettings,
  now: number,
): AuctionView[] {
  return auctions
    .map((auction) =>
      toAuctionView(
        auction,
        bids.filter((bid) => bid.auctionId === auction.id),
        settings,
        now,
      ),
    )
    .sort((left, right) => {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
}

function countActiveAuctions(auctions: AuctionView[]): number {
  return auctions.filter((auction) =>
    ['scheduled', 'live', 'endingSoon'].includes(auction.status),
  ).length;
}

function countPlanSlots(
  auctions: Array<{ id: string; lifecycle: AuctionLifecycle }>,
  kind: 'active' | 'draft',
  excludeAuctionId?: string,
): number {
  return auctions.filter((auction) => {
    if (excludeAuctionId && auction.id === excludeAuctionId) {
      return false;
    }

    return kind === 'draft'
      ? auction.lifecycle === 'draft'
      : occupiesActivePlanSlot(auction.lifecycle);
  }).length;
}

function assertAuctionFitsPlan(
  settings: AppSettings,
  auctions: Array<{ id: string; lifecycle: AuctionLifecycle }>,
  nextLifecycle: AuctionLifecycle,
  excludeAuctionId?: string,
): void {
  const plan = getPlan(settings.planTier);

  if (nextLifecycle === 'draft') {
    if (
      isAtPlanLimit(
        countPlanSlots(auctions, 'draft', excludeAuctionId),
        plan.draftAuctions,
      )
    ) {
      throw new Error(getPlanLimitError(plan, 'draft'));
    }
    return;
  }

  if (occupiesActivePlanSlot(nextLifecycle)) {
    if (
      isAtPlanLimit(
        countPlanSlots(auctions, 'active', excludeAuctionId),
        plan.activeAuctions,
      )
    ) {
      throw new Error(getPlanLimitError(plan, 'active'));
    }
  }
}

function assertPlanFeature(
  settings: AppSettings,
  feature: Parameters<typeof planAllows>[1],
): void {
  if (!planAllows(settings.planTier, feature)) {
    throw new Error(getFeatureUpgradeMessage(feature));
  }
}

async function assertProductsAreAvailableForAuction(
  productIds: string[],
  excludeAuctionId?: string,
): Promise<void> {
  if (productIds.length === 0) {
    return;
  }

  const conflictingAuctions = await findAuctionsByProductIds(productIds, excludeAuctionId);

  if (conflictingAuctions.length === 0) {
    return;
  }

  const settings = await readSettings();
  const allBids = await listAllBids();
  const now = Date.now();
  const conflictingAuctionViews = conflictingAuctions
    .map((auction) =>
      toAuctionView(
        auction,
        allBids.filter((bid) => bid.auctionId === auction.id),
        settings,
        now,
      ),
    );
  const activeConflictingAuction = conflictingAuctionViews.find((auction) =>
    reservesProductForAuction(auction.status),
  );

  console.log(
    '[auction] assertProductsAreAvailableForAuction',
    JSON.stringify({
      productIds,
      excludeAuctionId: excludeAuctionId ?? null,
      conflictingAuctions: conflictingAuctionViews.map((auction) => ({
        id: auction.id,
        title: auction.title,
        status: auction.status,
        lifecycle: auction.lifecycle,
        productIds: auction.productIds,
        startTime: auction.startTime,
        endTime: auction.endTime,
        updatedAt: auction.updatedAt,
      })),
      activeConflictingAuction: activeConflictingAuction
        ? {
            id: activeConflictingAuction.id,
            title: activeConflictingAuction.title,
            status: activeConflictingAuction.status,
            lifecycle: activeConflictingAuction.lifecycle,
          }
        : null,
    }),
  );

  if (!activeConflictingAuction) {
    return;
  }

  throw new Error(
    `This product already has an unfinished auction: ${activeConflictingAuction.title}. End or delete it before creating another one.`,
  );
}

function normalizeSearchValue(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}

function matchesSearch(
  haystacks: Array<string | number | null | undefined>,
  query: string,
): boolean {
  if (!query) {
    return true;
  }

  return haystacks.some((value) =>
    String(value ?? '')
      .toLowerCase()
      .includes(query),
  );
}

function paginateRows<T>(
  rows: T[],
  pageInput?: number,
  pageSizeInput?: number,
): { rows: T[]; total: number } {
  const page = Number.isFinite(pageInput) ? Math.max(1, Math.floor(pageInput!)) : 1;
  const pageSize = Number.isFinite(pageSizeInput)
    ? Math.min(100, Math.max(1, Math.floor(pageSizeInput!)))
    : 5;
  const start = (page - 1) * pageSize;

  return { rows: rows.slice(start, start + pageSize), total: rows.length };
}

async function listAllStoreProducts(): Promise<any[]> {
  const { catalogVersion } = await catalogVersioning.getCatalogVersion();
  if (catalogVersion === 'STORES_NOT_INSTALLED') {
    return [];
  }

  const allProducts: any[] = [];
  let result = catalogVersion === 'V3_CATALOG'
    ? await productsV3.queryProducts().limit(100).find()
    : await products.queryProducts().limit(100).find();

  allProducts.push(...(result.items || []));

  while (result.hasNext()) {
    result = await result.next();
    allProducts.push(...(result.items || []));
  }

  return allProducts.map((product: any) => ({
    ...product,
    _id: product._id || product.id,
  }));
}

function normalizePublicAuctionProductFilter(
  value: PublicAuctionProductQuery['auctionFilter'],
): PublicAuctionProductFilter {
  return value === 'active' || value === 'inactive' ? value : 'all';
}

function normalizePublicAuctionTimerFilter(
  value: PublicAuctionProductQuery['timerFilter'],
): PublicAuctionTimerFilter {
  if (
    value === 'ending-1h' ||
    value === 'ending-24h' ||
    value === 'ending-7d' ||
    value === 'scheduled' ||
    value === 'paused' ||
    value === 'ended'
  ) {
    return value;
  }

  return 'all';
}

function normalizePublicPageSize(value: number | undefined): number {
  return Math.min(Math.max(value ?? 24, 1), 100);
}

function normalizePublicCursor(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function resolvePublicProductImageUrl(raw: any): string | null {
  const product = raw?.product ?? raw;
  const mainMedia = product?.media?.mainMedia ?? product?.media?.main;
  const image = mainMedia?.image;

  return (
    getStringValue(product?.mainImageUrl) ??
    getStringValue(mainMedia?.url) ??
    getStringValue(image?.url) ??
    getStringValue(image?.src) ??
    getStringValue(image) ??
    getStringValue(mainMedia?.thumbnail?.url) ??
    getStringValue(product?.media?.main?.url) ??
    getStringValue(product?.media?.main?.image?.url) ??
    getStringValue(product?.media?.main?.image)
  );
}

function resolvePublicProductSlug(raw: any): string {
  const product = raw?.product ?? raw;
  const fromSlug = getStringValue(product?.slug);
  if (fromSlug) {
    return fromSlug.replace(/^\/+|\/+$/g, '');
  }

  const path =
    getStringValue(product?.url?.path) ??
    getStringValue(product?.productPageUrl?.path) ??
    getStringValue(product?.url);

  if (!path) {
    return '';
  }

  const lastSegment = path.split('?')[0].split('#')[0].split('/').filter(Boolean).pop();
  return lastSegment ? decodeURIComponent(lastSegment) : '';
}

function normalizePublicProduct(raw: any): PublicAuctionProduct {
  const product = raw?.product ?? raw;
  const id = String(product?._id ?? product?.id ?? '');
  const price = product?.price ?? product?.priceData;

  return {
    id,
    _id: id,
    name: product?.name ?? 'Untitled product',
    slug: resolvePublicProductSlug(product),
    mainImageUrl: resolvePublicProductImageUrl(product),
    priceRange: {
      min:
        typeof price?.price === 'number'
          ? price.price
          : typeof price?.discountedPrice === 'number'
            ? price.discountedPrice
            : product?.actualPriceRange?.minValue?.amount ??
              product?.actualPriceRange?.minValue ??
              null,
      max:
        typeof price?.price === 'number'
          ? price.price
          : typeof price?.discountedPrice === 'number'
            ? price.discountedPrice
            : product?.actualPriceRange?.maxValue?.amount ??
              product?.actualPriceRange?.maxValue ??
              null,
      currency:
        price?.currency ??
        product?.priceData?.currency ??
        product?.actualPriceRange?.minValue?.currency ??
        product?.actualPriceRange?.currency ??
        null,
    },
    raw: product,
    auction: null,
  };
}

function getPublicAuctionStatusPriority(status: AuctionView['status']): number {
  if (status === 'live') return 0;
  if (status === 'endingSoon') return 1;
  if (status === 'scheduled') return 2;
  if (status === 'paused') return 3;
  if (status === 'sold') return 4;
  return 5;
}

function getPublicAuctionRecencyScore(auction: AuctionView): number {
  return Math.max(
    new Date(auction.updatedAt).getTime(),
    new Date(auction.createdAt).getTime(),
    0,
  );
}

function resolvePublicProductAuction(
  auctions: AuctionView[],
  productId: string,
): AuctionView | null {
  const matches = auctions.filter((auction) =>
    isAuctionLinkedToProduct(auction, productId),
  );

  if (matches.length === 0) {
    return null;
  }

  const currentLinkedAuction = matches
    .filter((auction) => isCurrentProductLinkStatus(auction.status))
    .sort((left, right) => {
      const priorityDelta =
        getPublicAuctionStatusPriority(left.status) - getPublicAuctionStatusPriority(right.status);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return getPublicAuctionRecencyScore(right) - getPublicAuctionRecencyScore(left);
    })[0];

  if (currentLinkedAuction) {
    return currentLinkedAuction;
  }

  const soldAuction = matches
    .filter((auction) => auction.status === 'sold')
    .sort((left, right) => getPublicAuctionRecencyScore(right) - getPublicAuctionRecencyScore(left))[0];

  return soldAuction ?? matches[0] ?? null;
}

function getPublicAuctionLabel(auction: AuctionView): string {
  if (auction.status === 'paused') return 'Paused';
  if (auction.status === 'endingSoon') return 'Ending soon';
  if (auction.status === 'reserveNotMet') return 'Reserve not met';
  if (auction.status === 'live') return 'Live';
  if (auction.status === 'scheduled') return 'Scheduled';
  if (auction.status === 'closed') return 'Closed';
  if (auction.status === 'sold') return 'Sold';
  return auction.status;
}

function matchesPublicTimerFilter(
  auction: AuctionView | null,
  filter: PublicAuctionTimerFilter,
  now: number,
): boolean {
  if (filter === 'all') {
    return true;
  }

  if (!auction) {
    return false;
  }

  if (filter === 'scheduled') {
    return auction.status === 'scheduled';
  }

  if (filter === 'paused') {
    return auction.status === 'paused';
  }

  if (filter === 'ended') {
    return ['closed', 'reserveNotMet', 'sold'].includes(auction.status);
  }

  if (!['live', 'endingSoon'].includes(auction.status)) {
    return false;
  }

  const remainingMs =
    auction.status === 'paused' && auction.pausedTimeRemainingMs !== null
      ? auction.pausedTimeRemainingMs
      : hasAuctionEndTime(auction.endTime)
        ? Math.max(new Date(auction.endTime).getTime() - now, 0)
        : Number.POSITIVE_INFINITY;

  if (filter === 'ending-1h') {
    return Number.isFinite(remainingMs) && remainingMs > 0 && remainingMs <= 60 * 60 * 1000;
  }

  if (filter === 'ending-24h') {
    return Number.isFinite(remainingMs) && remainingMs > 0 && remainingMs <= 24 * 60 * 60 * 1000;
  }

  if (filter === 'ending-7d') {
    return (
      Number.isFinite(remainingMs) && remainingMs > 0 && remainingMs <= 7 * 24 * 60 * 60 * 1000
    );
  }

  return true;
}

function productMatchesPublicSearch(
  product: PublicAuctionProduct,
  auction: AuctionView | null,
  query: string,
): boolean {
  if (!query) {
    return true;
  }

  return matchesSearch(
    [
      product.name,
      auction?.title,
      auction ? getPublicAuctionLabel(auction) : 'No active auction',
    ],
    query,
  );
}

function productMatchesPublicFilters(
  product: PublicAuctionProduct,
  activeProductIds: Set<string>,
  auctionFilter: PublicAuctionProductFilter,
  timerFilter: PublicAuctionTimerFilter,
  now: number,
): boolean {
  const isActive = activeProductIds.has(product.id);

  if (auctionFilter === 'active' && !isActive) {
    return false;
  }

  if (auctionFilter === 'inactive' && isActive) {
    return false;
  }

  return matchesPublicTimerFilter(product.auction, timerFilter, now);
}

async function fetchStoreProductByIdForPublic(
  id: string,
  catalogVersion: string,
): Promise<any> {
  if (catalogVersion === 'V3_CATALOG') {
    const api = productsV3 as any;
    if (typeof api.getProduct === 'function') {
      try {
        const elevated = auth.elevate(api.getProduct.bind(api));
        const res = await elevated(id);
        const unwrapped = (res as any)?.product ?? res;
        if (unwrapped) return unwrapped;
      } catch (err) {
        console.warn('[auction] productsV3.getProduct failed, trying query:', err);
      }
    }
    try {
      const elevatedQuery = auth.elevate(productsV3.queryProducts);
      const res = await elevatedQuery({ filter: { _id: { $in: [id] } } });
      const item = (res as any)?.products?.[0] ?? (res as any)?.items?.[0];
      const unwrapped = (item as any)?.product ?? item;
      if (unwrapped) return unwrapped;
    } catch (err) {
      console.warn('[auction] productsV3.queryProducts by ID failed:', err);
    }
    return null;
  }

  // V1 Catalog
  try {
    const elevated = auth.elevate(products.getProduct);
    const res = await elevated(id);
    const unwrapped = (res as any)?.product ?? res;
    if (unwrapped) return unwrapped;
  } catch (err) {
    console.warn('[auction] products.getProduct failed, trying queryProducts:', err);
    try {
      const elevatedQuery = auth.elevate(products.queryProducts);
      const res = await elevatedQuery().eq('_id', id).limit(1).find();
      const item = res.items?.[0];
      const unwrapped = (item as any)?.product ?? item;
      if (unwrapped) return unwrapped;
    } catch (queryErr) {
      console.warn('[auction] products.queryProducts fallback failed:', queryErr);
    }
  }
  return null;
}

async function getStoreProductsByIdsForPublic(ids: string[]): Promise<PublicAuctionProduct[]> {
  if (ids.length === 0) {
    return [];
  }

  let catalogVersion = 'V1_CATALOG';
  try {
    const versionRes = await auth.elevate(catalogVersioning.getCatalogVersion)();
    catalogVersion = versionRes?.catalogVersion ?? 'V1_CATALOG';
  } catch (e) {
    console.warn('[auction] failed to get catalog version:', e);
  }

  if (catalogVersion === 'STORES_NOT_INSTALLED') {
    return [];
  }

  const productsById = await Promise.all(
    ids.map((id) =>
      fetchStoreProductByIdForPublic(id, catalogVersion).catch((error) => {
        console.warn('[auction] failed to load public auction product', { id, error });
        return null;
      }),
    ),
  );

  return productsById.filter(Boolean).map(normalizePublicProduct);
}

async function findPublicStoreProductPage(
  input: PublicAuctionProductQuery,
  auctions: AuctionView[],
  activeProductIds: Set<string>,
): Promise<PublicAuctionProductsResult> {
  const search = normalizeSearchValue(input.search);
  const auctionFilter = normalizePublicAuctionProductFilter(input.auctionFilter);
  const timerFilter = normalizePublicAuctionTimerFilter(input.timerFilter);
  const pageSize = normalizePublicPageSize(input.pageSize);
  const cursor = normalizePublicCursor(input.cursor);
  const now = Date.now();
  const filteredProducts: PublicAuctionProduct[] = [];
  let skipped = 0;
  let matchedCount = 0;

  const addIfMatching = (product: PublicAuctionProduct): void => {
    const auction = resolvePublicProductAuction(auctions, product.id);
    const productWithAuction = { ...product, auction };

    if (
      productMatchesPublicSearch(productWithAuction, auction, search) &&
      productMatchesPublicFilters(
        productWithAuction,
        activeProductIds,
        auctionFilter,
        timerFilter,
        now,
      )
    ) {
      matchedCount += 1;

      if (skipped < cursor) {
        skipped += 1;
        return;
      }

      if (filteredProducts.length < pageSize) {
        filteredProducts.push(productWithAuction);
      }
    }
  };

  if (auctionFilter === 'active' || timerFilter !== 'all') {
    const candidateIds = Array.from(
      new Set(
        auctions
          .flatMap((auction) => auction.productIds)
          .filter((productId) => {
            if (auctionFilter === 'active') {
              return activeProductIds.has(productId);
            }
            if (auctionFilter === 'inactive') {
              return !activeProductIds.has(productId);
            }
            return true;
          }),
      ),
    );

    for (const product of await getStoreProductsByIdsForPublic(candidateIds)) {
      addIfMatching(product);
    }

    const nextOffset = cursor + filteredProducts.length;
    return {
      products: filteredProducts,
      cursor: input.cursor ?? null,
      nextCursor: nextOffset < matchedCount ? String(nextOffset) : null,
      hasNextPage: nextOffset < matchedCount,
    };
  }

  let catalogVersion = 'V1_CATALOG';
  try {
    const versionRes = await auth.elevate(catalogVersioning.getCatalogVersion)();
    catalogVersion = versionRes?.catalogVersion ?? 'V1_CATALOG';
  } catch (e) {
    console.warn('[auction] failed to get catalog version:', e);
  }

  if (catalogVersion === 'STORES_NOT_INSTALLED') {
    return {
      products: [],
      cursor: input.cursor ?? null,
      nextCursor: null,
      hasNextPage: false,
    };
  }

  let result = catalogVersion === 'V3_CATALOG'
    ? await auth.elevate(productsV3.queryProducts)().limit(100).find()
    : await auth.elevate(products.queryProducts)().limit(100).find();

  while (true) {
    for (const rawProduct of result.items ?? []) {
      addIfMatching(normalizePublicProduct(rawProduct));
    }

    if (filteredProducts.length >= pageSize || !result.hasNext()) {
      break;
    }

    result = await result.next();
  }

  const nextOffset = cursor + filteredProducts.length;
  const hasNextPage = matchedCount > nextOffset || result.hasNext();

  return {
    products: filteredProducts,
    cursor: input.cursor ?? null,
    nextCursor: hasNextPage ? String(nextOffset) : null,
    hasNextPage,
  };
}

// Bidder contact details must never reach site visitors; members are
// identified by bidderMemberId instead.
function redactBidContact(bid: BidSummary): BidSummary {
  return { ...bid, bidderEmail: '', bidderPhone: '' };
}

function redactAuctionContacts(auction: AuctionView): AuctionView {
  return {
    ...auction,
    recentBids: auction.recentBids.map(redactBidContact),
    winner: auction.winner ? redactBidContact(auction.winner) : null,
  };
}

async function buildPublicAuctions(): Promise<AuctionView[]> {
  const allBids = await listAllBids();
  const settings = await readSettings();
  const auctionsFromCollection = await listAuctionRecords();

  return mapAuctions(
    auctionsFromCollection,
    allBids,
    settings,
    Date.now(),
  )
    .filter((auction) =>
      ['scheduled', 'live', 'endingSoon', 'paused', 'closed', 'reserveNotMet', 'sold'].includes(
        auction.status,
      ),
    )
    .map((auction) => ({
      ...redactAuctionContacts(auction),
      // Public storefront APIs expose the same canonical single-product link
      // used by checkout and bidding, even for malformed legacy records.
      productIds: auction.productIds.slice(0, 1),
      winnerCheckoutId: null,
      winnerCheckoutUrl: null,
      winnerCheckoutRecipientEmail: null,
      winnerPaymentUrl: null,
      winnerPaymentButtonLabel: null,
      winnerPaymentEmailSentAt: null,
      winnerPaymentEmailAttemptKey: null,
      winnerPaymentEmailLastSentKey: null,
    }));
}

/**
 * A lightweight overview for Aria's tools: three reads in parallel and no
 * writes. `buildDashboardPayload` is too slow for a Tools Provider call (it
 * reads every collection one after another and de-duplicates leads), so Wix
 * times the call out. Leads are counted as distinct bidder emails, which is
 * what a lead represents, without touching the Leads collection.
 */
export async function getAuctionSummary(): Promise<{
  settings: AppSettings;
  auctions: AuctionView[];
  summary: DashboardPayload['summary'];
}> {
  const [settings, auctionRecords, allBids] = await Promise.all([
    readSettings(),
    listAuctionRecords(),
    listAllBids(),
  ]);
  const auctions = mapAuctions(auctionRecords, allBids, settings, Date.now());
  const auctionIds = new Set(auctions.map((auction) => auction.id));
  const auctionBids = allBids.filter((bid) => auctionIds.has(bid.auctionId));

  return {
    settings,
    auctions,
    summary: {
      totalAuctions: auctions.length,
      activeAuctions: countActiveAuctions(auctions),
      endingSoon: auctions.filter((auction) => auction.status === 'endingSoon').length,
      totalBids: auctionBids.length,
      totalLeads: new Set(auctionBids.map((bid) => normalizeEmail(bid.bidderEmail)).filter(Boolean)).size,
    },
  };
}

/**
 * Inside `withoutDashboardPayload`, mutations skip the full dashboard rebuild
 * they normally return. Aria's tools use this: they read back only the record
 * they changed, which keeps each call inside the Tools Provider time limit.
 */
const skipDashboardPayload = new AsyncLocalStorage<true>();

export function withoutDashboardPayload<T>(fn: () => Promise<T>): Promise<T> {
  return skipDashboardPayload.run(true, fn);
}

/** One auction as the dashboard shows it, without loading every auction. */
export async function getAuctionView(auctionId: string): Promise<AuctionView | null> {
  const [settings, record, bids] = await Promise.all([
    readSettings(),
    getAuctionRecordById(auctionId),
    listBidsByAuctionId(auctionId),
  ]);
  return record ? mapAuctions([record], bids, settings, Date.now())[0] ?? null : null;
}

async function buildDashboardPayload(): Promise<DashboardPayload> {
  if (skipDashboardPayload.getStore()) {
    // Callers in this mode ignore the payload; return a valid empty one.
    return {
      generatedAt: new Date().toISOString(),
      settings: DEFAULT_SETTINGS,
      installedPlan: null,
      auctions: [],
      notifications: [],
      leads: [],
      currency: '',
      summary: { totalAuctions: 0, activeAuctions: 0, endingSoon: 0, totalBids: 0, totalLeads: 0 },
    };
  }

  const [settings, installedPlan] = await Promise.all([
    readSettings(),
    readInstalledAppPlan(),
  ]);
  const auctionsFromCollection = await listAuctionRecords();
  const allBids = await listAllBids();
  const notifications = await listNotifications();
  const now = Date.now();
  
  const auctions = mapAuctions(
    auctionsFromCollection,
    allBids,
    settings,
    now,
  );

  const allLeads = await listLeads();
  const auctionIds = new Set(auctions.map((a) => a.id));
  const filteredLeads = allLeads.filter((lead) => auctionIds.has(lead.auctionId));

  const [currency, siteName] = await Promise.all([
    readSiteCurrency(),
    readSiteDisplayName(),
  ]);

  return {
    generatedAt: new Date(now).toISOString(),
    siteName,
    settings,
    installedPlan,
    auctions,
    notifications,
    leads: filteredLeads,
    currency,
    summary: {
      totalAuctions: auctions.length,
      activeAuctions: countActiveAuctions(auctions),
      endingSoon: auctions.filter((auction) => auction.status === 'endingSoon').length,
      totalBids: allBids.length,
      totalLeads: filteredLeads.length,
    },
  };
}

export const queryStoreProducts = webMethod(
  Permissions.Admin,
  async (input: StoreProductSearchQuery = {}): Promise<StoreProductSearchResult> => {
    const allProducts = await listAllStoreProducts();
    const query = normalizeSearchValue(input.search);
    const filteredProducts = allProducts
      .filter((product) =>
        matchesSearch(
          [product.name, product._id, product.id, product.sku, product.ribbon],
          query,
        ),
      )
      .sort((left, right) =>
        String(left.name ?? '').localeCompare(String(right.name ?? '')) ||
        String(left._id ?? left.id ?? '').localeCompare(String(right._id ?? right.id ?? '')),
      );
    const result = paginateRows(filteredProducts, input.page, input.pageSize);

    return { products: result.rows, total: result.total };
  },
);

export const getStoreProductsByIds = webMethod(
  Permissions.Admin,
  async (ids: string[]): Promise<any> => {
    console.log('[Backend] getStoreProductsByIds called with:', ids);
    if (!ids || ids.length === 0) return { products: [] };
    try {
      const results = await Promise.all(
        ids.map((id) =>
          products.getProduct(id).catch((err) => {
            console.error(`[Backend] Failed to get product ${id}:`, err);
            return null;
          }),
        ),
      );
      const items = results.filter(Boolean).map((p: any) => ({
        ...p,
        _id: p._id || p.id, // Ensure both are present for frontend compatibility
      }));
      console.log(`[Backend] Returning ${items.length} products.`);
      return { products: items };
    } catch (error) {
      console.error('[Backend] getStoreProductsByIds critical failure:', error);
      return { products: [] };
    }
  },
);

export const getSitePluginPlacementStatus = webMethod(
  Permissions.Admin,
  async (): Promise<SitePluginPlacementStatusResult> => {
    try {
      const elevatedGetPlacementStatus = auth.elevate(plugins.getPlacementStatus);
      const response = await elevatedGetPlacementStatus();

      const definitionMap = new Map(
        SITE_PLUGIN_DEFINITIONS.map((def) => [def.id, def]),
      );

      return {
        placementStatuses: (response.placementStatuses || []).map((item) => {
          const pluginId = String(item.pluginId || '');
          const def = definitionMap.get(pluginId);
          return {
            pluginId,
            placedInSlot: Boolean(item.placedInSlot),
            name: def?.name,
          };
        }),
      };
    } catch (error) {
      console.error('[auction] getSitePluginPlacementStatus failed', error);

      const isForbidden =
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        error.status === 403;

      return {
        placementStatuses: [],
        error: isForbidden
          ? 'Wix denied access to site plugin placement status. Update this app in the site’s Manage Apps page and approve the Read Site Plugin Status permission, then refresh. If the app is already updated, contact Wix support with the request ID from the server log.'
          : error instanceof Error
            ? error.message
            : 'Unable to read site plugin placement status.',
      };
    }
  },
);

export const loadDashboard = webMethod(
  Permissions.Admin,
  async (): Promise<DashboardPayload> => {
    const payload = await buildDashboardPayload();

    console.log(
      '[auction] loadDashboard',
      JSON.stringify({
        generatedAt: payload.generatedAt,
        auctionCount: payload.auctions.length,
        auctions: payload.auctions.map((auction) => ({
          id: auction.id,
          title: auction.title,
          status: auction.status,
          lifecycle: auction.lifecycle,
          productIds: auction.productIds,
          startTime: auction.startTime,
          endTime: auction.endTime,
          updatedAt: auction.updatedAt,
        })),
      }),
    );

    return payload;
  },
);

export const getDashboardMonitor = webMethod(
  Permissions.Admin,
  async (): Promise<DashboardMonitorPayload> => {
    const payload = await buildDashboardPayload();

    return {
      generatedAt: payload.generatedAt,
      currency: payload.currency,
      summary: payload.summary,
      activeAuctions: payload.auctions.filter((auction) =>
        ['scheduled', 'live', 'endingSoon', 'paused'].includes(auction.status),
      ),
    };
  },
);

export const searchDashboardAuctions = webMethod(
  Permissions.Admin,
  async (input: DashboardAuctionQuery): Promise<DashboardAuctionResult> => {
    const settings = await readSettings();
    const auctionsFromCollection = await listAuctionRecords();
    const allBids = await listAllBids();
    const auctions = mapAuctions(auctionsFromCollection, allBids, settings, Date.now());
    const query = normalizeSearchValue(input.search);

    const results = auctions.filter((auction) => {
      const matchesActiveOnly =
        !input.activeOnly ||
        ['scheduled', 'live', 'endingSoon', 'paused'].includes(auction.status);
      const matchesStatus = !input.status || input.status === 'all' || auction.status === input.status;
      const matchesLifecycle =
        !input.lifecycle ||
        input.lifecycle === 'all' ||
        auction.lifecycle === input.lifecycle;
      const matchesAuctionSearch = matchesSearch(
        [
          auction.title,
          auction.description,
          auction.id,
          auction.status,
          auction.lifecycle,
          auction.currentHighestBid,
          auction.startingPrice,
          auction.reservePrice,
        ],
        query,
      );

      return (
        matchesActiveOnly &&
        matchesStatus &&
        matchesLifecycle &&
        matchesAuctionSearch
      );
    });

    if (input.activeOnly) {
      const statusRank: Record<string, number> = {
        endingSoon: 0,
        live: 1,
        paused: 2,
        scheduled: 3,
      };
      results.sort((left, right) => {
        const rankDelta = statusRank[left.status] - statusRank[right.status];
        if (rankDelta !== 0) return rankDelta;
        const leftEnd = Date.parse(left.endTime || '') || Number.POSITIVE_INFINITY;
        const rightEnd = Date.parse(right.endTime || '') || Number.POSITIVE_INFINITY;
        return leftEnd - rightEnd || left.id.localeCompare(right.id);
      });
    }

    const paged = paginateRows(results, input.page, input.pageSize ?? 50);

    console.log(
      '[auction] searchDashboardAuctions',
      JSON.stringify({
        input,
        resultCount: paged.total,
        auctions: paged.rows.map((auction) => ({
          id: auction.id,
          title: auction.title,
          status: auction.status,
          lifecycle: auction.lifecycle,
          productIds: auction.productIds,
          updatedAt: auction.updatedAt,
        })),
      }),
    );

    if (!input.includeLinkedProducts) {
      return paged;
    }

    let productsById = new Map<string, StoreProductSnapshot>();
    try {
      productsById = await getStoreProductSnapshotsByIds(
        Array.from(new Set(paged.rows.flatMap((auction) => auction.productIds.slice(0, 1)))),
      );
    } catch (error) {
      console.warn('[auction] failed to load linked products for auctions page', error);
    }

    return {
      total: paged.total,
      rows: paged.rows.map((auction) => {
        const product = productsById.get(auction.productIds[0]);
        return {
          ...auction,
          linkedProduct: product
            ? { id: product.id, name: product.name, imageUrl: product.imageUrls[0] ?? null }
            : null,
        };
      }),
    };
  },
);

async function queryDashboardLeads(
  input: DashboardLeadQuery,
): Promise<DashboardLeadView[]> {
  const settings = await readSettings();
  const auctionsFromCollection = await listAuctionRecords();
  const allBids = await listAllBids();
  const auctions = mapAuctions(auctionsFromCollection, allBids, settings, Date.now());
  const auctionMap = new Map(auctions.map((auction) => [auction.id, auction]));
  const leads = await listLeads();
  const query = normalizeSearchValue(input.search);
  const uniqueRows = new Map<string, DashboardLeadView>();

  for (const lead of leads) {
    const auction = auctionMap.get(lead.auctionId);

    if (!auction) {
      continue;
    }

    const matchesAuction =
      !input.auctionId || input.auctionId === 'all' || auction.id === input.auctionId;
    const matchesLeadSearch = matchesSearch(
      [
        lead.bidderName,
        lead.bidderEmail,
        lead.bidderPhone,
        lead.amount,
        auction.title,
        auction.id,
      ],
      query,
    );

    if (!matchesAuction || !matchesLeadSearch) {
      continue;
    }

    const email = lead.bidderEmail.trim().toLowerCase();

    if (!email) {
      continue;
    }

    const existing = uniqueRows.get(email);

    if (
      !existing ||
      new Date(lead.createdAt).getTime() >= new Date(existing.bid.createdAt).getTime()
    ) {
      uniqueRows.set(email, { auction, bid: lead });
    }
  }

  return [...uniqueRows.values()].sort(
    (left, right) =>
      new Date(right.bid.createdAt).getTime() - new Date(left.bid.createdAt).getTime(),
  );
}

export const searchDashboardLeads = webMethod(
  Permissions.Admin,
  async (input: DashboardLeadSearchQuery): Promise<DashboardLeadResult> => {
    const leads = await queryDashboardLeads(input);
    return paginateRows(leads, input.page, input.pageSize);
  },
);

export const exportLeadsCsv = webMethod(
  Permissions.Admin,
  async (input: ExportLeadsCsvInput = {}): Promise<string> => {
    const settings = await readSettings();
    assertPlanFeature(settings, 'leads');
    const selectedIds = new Set(
      (input.leadIds ?? []).map((id) => id.trim()).filter(Boolean),
    );
    const leads = await queryDashboardLeads(input);
    const rows = selectedIds.size > 0
      ? leads.filter(({ bid }) => selectedIds.has(bid.id))
      : leads;

    if (rows.length === 0) {
      throw new Error('No leads match the current export selection.');
    }

    const currency = await readSiteCurrency();

    return createLeadsCsv(
      rows.map(({ auction, bid }) => ({
        bidderName: bid.bidderName,
        bidderEmail: bid.bidderEmail,
        bidderPhone: bid.bidderPhone,
        auctionTitle: auction.title,
        auctionStatus: auction.status,
        amount: bid.amount,
        createdAt: bid.createdAt,
      })),
      currency,
    );
  },
);

export const searchAuctionBids = webMethod(
  Permissions.Admin,
  async (input: AuctionBidsQuery): Promise<AuctionBidsResult> => {
    const auction = await getAuctionRecordById(input.auctionId);

    if (!auction) {
      throw new Error('Auction not found.');
    }

    const bids = await listBidsByAuctionId(input.auctionId);
    const query = normalizeSearchValue(input.search);
    const winner = input.winner ?? 'all';

    const results = bids
      .map(toBidSummary)
      .filter((bid) => {
        const matchesWinner =
          winner === 'all' ||
          (winner === 'winner' ? auction.winnerBidId === bid.id : auction.winnerBidId !== bid.id);
        const matchesBidSearch = matchesSearch(
          [bid.bidderName, bid.bidderEmail, bid.bidderPhone, bid.amount, bid.id, bid.variantLabel],
          query,
        );

        return matchesWinner && matchesBidSearch;
      });

    return paginateRows(results, input.page, input.pageSize);
  },
);

export const getMemberAuctionBids = webMethod(
  Permissions.SiteMember,
  async (input: MemberAuctionBidsQuery): Promise<MemberBidSummary[]> => {
    const auction = await getAuctionRecordById(input.auctionId);

    if (!auction) {
      throw new Error('Auction not found.');
    }

    const normalizedMemberId = (input.bidderMemberId ?? '').trim();
    const normalizedEmail = normalizeEmail(input.bidderEmail);

    if (!normalizedMemberId && !normalizedEmail) {
      return [];
    }

    const bids = await listBidsByAuctionId(input.auctionId);

    return bids
      .filter((bid) => bidderMatchesIdentity(bid, normalizedMemberId, normalizedEmail))
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )
      .map(toMemberBidSummary);
  },
);

export const searchDashboardProducts = webMethod(
  Permissions.Admin,
  async (input: DashboardProductQuery): Promise<DashboardProductResult> => {
    const settings = await readSettings();
    const auctionsFromCollection = await listAuctionRecords();
    const allBids = await listAllBids();
    const auctions = mapAuctions(auctionsFromCollection, allBids, settings, Date.now());
    const query = normalizeSearchValue(input.search);
    const pageSize = Math.max(1, input.pageSize ?? 5);
    const page = Math.max(1, input.page ?? 1);
    const productsList = await listAllStoreProducts();

    const rows = productsList.map((product: any) => {
      const productId = String(product._id || product.id || '');
      const linkedAuctions = auctions.filter((auction) =>
        isAuctionLinkedToProduct(auction, productId) &&
        reservesProductForAuction(auction.status),
      );

      return {
        id: productId,
        name: product.name || 'Untitled product',
        sku: getStringValue(product.sku) ?? '-',
        auctions: linkedAuctions,
      };
    });

    const filteredRows = rows.filter((row) => {
      const productMatchesSearch =
        !query ||
        matchesSearch(
          [
            row.name,
            row.id,
            row.sku,
            ...row.auctions.map((auction) => auction.title),
          ],
          query,
        );
      const matchesAuctionLink =
        !input.auctionLink ||
        input.auctionLink === 'all' ||
        (input.auctionLink === 'linked'
          ? row.auctions.length > 0
          : row.auctions.length === 0);

      return productMatchesSearch && matchesAuctionLink;
    });

    const start = (page - 1) * pageSize;

    const result = {
      rows: filteredRows.slice(start, start + pageSize),
      total: filteredRows.length,
    };

    console.log(
      '[auction] searchDashboardProducts',
      JSON.stringify({
        input,
        totalProducts: productsList.length,
        totalFilteredRows: result.total,
        rows: result.rows.map((row) => ({
          id: row.id,
          name: row.name,
          auctionIds: row.auctions.map((auction) => auction.id),
          auctions: row.auctions.map((auction) => ({
            id: auction.id,
            title: auction.title,
            status: auction.status,
            lifecycle: auction.lifecycle,
            productIds: auction.productIds,
          })),
        })),
      }),
    );

    return result;
  },
);

async function createAuctionWithValidation(
  input: AuctionInput,
  verifiedProductId?: string,
): Promise<DashboardPayload> {
  const settings = await readSettings();
  const sanitized = sanitizeAuctionInput(input, settings);
  if (verifiedProductId !== sanitized.productIds[0] || !sanitized.title) {
    const product = await getStoreProductSnapshot(sanitized.productIds[0]);
    sanitized.title = sanitized.title || product.name;
  }
  const existingAuctions = await listAuctionRecords();
  assertAuctionFitsPlan(settings, existingAuctions, sanitized.lifecycle);

  console.log(
    '[auction] createAuction input',
    JSON.stringify({
      title: sanitized.title,
      lifecycle: sanitized.lifecycle,
      productIds: sanitized.productIds,
      startTime: sanitized.startTime,
      endTime: sanitized.endTime,
    }),
  );

  await assertProductsAreAvailableForAuction(sanitized.productIds);
  await createAuctionRecord(sanitized);
  return buildDashboardPayload();
}

export const createAuction = webMethod(
  Permissions.Admin,
  async (input: AuctionInput): Promise<DashboardPayload> => {
    return createAuctionWithValidation(input);
  },
);

export const createAuctionFromProduct = webMethod(
  Permissions.Admin,
  async (productId: string, input: AuctionInput): Promise<DashboardPayload> => {
    const product = await getStoreProductSnapshot(productId);
    return createAuctionWithValidation(mergeAuctionInputWithProduct(input, product), product.id);
  },
);

export const updateAuction = webMethod(
  Permissions.Admin,
  async (
    auctionId: string,
    input: Partial<AuctionInput>,
  ): Promise<DashboardPayload> => {
    const settings = await readSettings();
    const existing = await getAuctionRecordById(auctionId);

    if (!existing) {
      throw new Error('Auction not found.');
    }

    const sanitized = sanitizeAuctionInput(
      {
        ...EMPTY_AUCTION_INPUT,
        ...existing,
        ...input,
      },
      settings,
    );
    if (sanitized.productIds[0] !== existing.productIds[0] || !sanitized.title) {
      const product = await getStoreProductSnapshot(sanitized.productIds[0]);
      sanitized.title = sanitized.title || product.name;
    }
    const existingAuctions = await listAuctionRecords();
    assertAuctionFitsPlan(
      settings,
      existingAuctions,
      sanitized.lifecycle,
      auctionId,
    );

    console.log(
      '[auction] updateAuction input',
      JSON.stringify({
        auctionId,
        title: sanitized.title,
        lifecycle: sanitized.lifecycle,
        productIds: sanitized.productIds,
        startTime: sanitized.startTime,
        endTime: sanitized.endTime,
      }),
    );

    await assertProductsAreAvailableForAuction(sanitized.productIds, auctionId);
    await updateAuctionRecord(auctionId, sanitized, existing);
    return buildDashboardPayload();
  },
);

export const runAuctionAction = webMethod(
  Permissions.Admin,
  async (
    auctionId: string,
    action: 'publish' | 'draft' | 'pause' | 'resume' | 'close' | 'restart' | 'approveWinner',
    bidId?: string,
    paymentDetails?: WinnerPaymentDetails,
  ): Promise<WinnerActionPayload> => {
    const auction = await getAuctionRecordById(auctionId);

    if (!auction) {
      throw new Error('Auction not found.');
    }

    const settings = await readSettings();
    const existingAuctions = await listAuctionRecords();
    let winnerPaymentEmailError: string | null = null;

    if (action === 'approveWinner') {
      if (!bidId) {
        throw new Error('A winner bid must be selected.');
      }

      const auctionBids = await listBidsByAuctionId(auctionId);
      const winningBid =
        auctionBids.map(toBidSummary).find((bid) => bid.id === bidId) ?? null;

      if (!winningBid) {
        throw new Error('The selected winner bid could not be found.');
      }

      const useCustomPayment =
        settings.emailBiddingEnabled &&
        settings.emailWinnerPaymentLinkEnabled &&
        !winningBid.bidderMemberId;

      if (useCustomPayment) {
        const validated = validateWinnerPaymentDetails(paymentDetails);
        const saved = await patchAuctionRecord(auctionId, auction, {
          winnerBidId: bidId,
          lifecycle: 'sold',
          winnerCheckoutId: null,
          winnerCheckoutUrl: null,
          winnerCheckoutRecipientEmail: null,
          winnerCheckoutEmailSentAt: null,
          winnerPaymentUrl: validated.url,
          winnerPaymentButtonLabel: validated.buttonLabel,
          winnerPaymentEmailSentAt: null,
          winnerPaymentEmailAttemptKey: createIdempotencyKey(),
          winnerPaymentEmailLastSentKey: null,
        });
        winnerPaymentEmailError = await sendSavedWinnerPaymentEmail(saved, winningBid, settings);
        try {
          await insertNotification(
            auctionId,
            'owner',
            'dashboard',
            winnerPaymentEmailError
              ? `Payment link saved for ${winningBid.bidderEmail}, but the email was not sent.`
              : `Payment link emailed to ${winningBid.bidderEmail}.`,
          );
        } catch (error) {
          console.error('[auction] winner payment notification failed:', error);
        }
      } else {
        const { checkoutId, checkoutUrl } = await createWinnerCheckout(auction, winningBid);

        await patchAuctionRecord(auctionId, auction, {
          winnerBidId: bidId,
          lifecycle: 'sold',
          winnerCheckoutId: checkoutId,
          winnerCheckoutUrl: checkoutUrl,
          winnerCheckoutRecipientEmail: normalizeEmail(winningBid.bidderEmail),
          winnerCheckoutEmailSentAt: null,
          winnerPaymentUrl: null,
          winnerPaymentButtonLabel: null,
          winnerPaymentEmailSentAt: null,
          winnerPaymentEmailAttemptKey: null,
          winnerPaymentEmailLastSentKey: null,
        });

        await insertNotification(
          auctionId,
          'owner',
          'dashboard',
          `Checkout generated for ${winningBid.bidderEmail}. The winner can now open the product page and continue to payment.`,
        );
      }
    } else if (action === 'publish') {
      assertAuctionFitsPlan(settings, existingAuctions, 'published', auctionId);
      await assertProductsAreAvailableForAuction(auction.productIds, auctionId);
      await patchAuctionRecord(auctionId, auction, {
        lifecycle: 'published',
        pausedAt: null,
        pausedStartDelayMs: null,
        pausedTimeRemainingMs: null,
      });
    } else if (action === 'draft') {
      assertAuctionFitsPlan(settings, existingAuctions, 'draft', auctionId);
      await assertProductsAreAvailableForAuction(auction.productIds, auctionId);
      await patchAuctionRecord(auctionId, auction, {
        lifecycle: 'draft',
        pausedAt: null,
        pausedStartDelayMs: null,
        pausedTimeRemainingMs: null,
      });
    } else if (action === 'pause') {
      const now = Date.now();
      const status = getAuctionStatus(auction, await listBidsByAuctionId(auctionId), now);

      if (!['scheduled', 'live', 'endingSoon'].includes(status)) {
        throw new Error('Only scheduled or active auctions can be paused.');
      }

      await patchAuctionRecord(auctionId, auction, {
        lifecycle: 'paused',
        pausedAt: new Date(now).toISOString(),
        pausedStartDelayMs: Math.max(new Date(auction.startTime).getTime() - now, 0),
        pausedTimeRemainingMs: hasAuctionEndTime(auction.endTime)
          ? Math.max(new Date(auction.endTime).getTime() - now, 0)
          : null,
      });
    } else if (action === 'resume') {
      if (auction.lifecycle !== 'paused') {
        throw new Error('Only paused auctions can be resumed.');
      }

      assertAuctionFitsPlan(settings, existingAuctions, 'published', auctionId);

      const now = Date.now();
      const pausedStartDelayMs = auction.pausedStartDelayMs ?? 0;
      const pausedTimeRemainingMs = auction.pausedTimeRemainingMs;
      const resumedEndTime =
        pausedTimeRemainingMs === null
          ? ''
          : new Date(now + pausedTimeRemainingMs).toISOString();

      await patchAuctionRecord(auctionId, auction, {
        lifecycle: 'published',
        startTime: new Date(now + pausedStartDelayMs).toISOString(),
        endTime: resumedEndTime,
        pausedAt: null,
        pausedStartDelayMs: null,
        pausedTimeRemainingMs: null,
      });
    } else if (action === 'close') {
      await patchAuctionRecord(auctionId, auction, { lifecycle: 'closed' });
    } else if (action === 'restart') {
      const auctionBids = await listBidsByAuctionId(auctionId);
      const status = getAuctionStatus(auction, auctionBids, Date.now());

      if (status !== 'reserveNotMet') {
        throw new Error('Only unsuccessful auctions can be restarted.');
      }

      assertAuctionFitsPlan(settings, existingAuctions, 'published', auctionId);
      await assertProductsAreAvailableForAuction(auction.productIds, auctionId);

      const startMs = Date.now();
      const resumedEndTime = hasAuctionEndTime(auction.endTime)
        ? new Date(
            startMs +
              Math.max(
                new Date(auction.endTime).getTime() - new Date(auction.startTime).getTime(),
                DEFAULT_AUCTION_DURATION_MS,
              ),
          ).toISOString()
        : '';

      await deleteBidsByAuctionId(auctionId);
      await deleteLeadsByAuctionId(auctionId);
      await patchAuctionRecord(auctionId, auction, {
        lifecycle: 'published',
        startTime: new Date(startMs).toISOString(),
        endTime: resumedEndTime,
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
        pausedAt: null,
        pausedStartDelayMs: null,
        pausedTimeRemainingMs: null,
        paymentMade: false,
      });

      await insertNotification(
        auctionId,
        'owner',
        'dashboard',
        `Auction "${auction.title}" was restarted after reserve was not met.`,
      );
    }

    const payload = await buildDashboardPayload();
    return winnerPaymentEmailError
      ? { ...payload, winnerPaymentEmailError }
      : payload;
  },
);

export const resendWinnerPaymentEmail = webMethod(
  Permissions.Admin,
  async (auctionId: string): Promise<WinnerActionPayload> => {
    const settings = await readSettings();
    if (!settings.emailBiddingEnabled || !settings.emailWinnerPaymentLinkEnabled) {
      throw new Error('Email winner payment links are disabled in Settings.');
    }

    const auction = await getAuctionRecordById(auctionId);
    if (!auction || auction.lifecycle !== 'sold' || !auction.winnerBidId || !auction.winnerPaymentUrl) {
      throw new Error('No email winner payment link is available for this auction.');
    }

    const bids = await listBidsByAuctionId(auctionId);
    const winner = bids.map(toBidSummary).find((bid) => bid.id === auction.winnerBidId);
    if (!winner || winner.bidderMemberId) {
      throw new Error('The selected email winner could not be found.');
    }

    const updated = shouldStartNewPaymentEmailAttempt(auction)
      ? await patchAuctionRecord(auctionId, auction, {
          winnerPaymentEmailAttemptKey: createIdempotencyKey(),
        })
      : auction;
    const winnerPaymentEmailError = await sendSavedWinnerPaymentEmail(updated, winner, settings);
    const payload = await buildDashboardPayload();
    return winnerPaymentEmailError
      ? { ...payload, winnerPaymentEmailError }
      : payload;
  },
);

export const deleteAuction = webMethod(
  Permissions.Admin,
  async (auctionId: string): Promise<DashboardPayload> => {
    await deleteBidsByAuctionId(auctionId);
    await deleteAuctionRecord(auctionId);
    return buildDashboardPayload();
  },
);

export const deleteAuctions = webMethod(
  Permissions.Admin,
  async (auctionIds: string[]): Promise<DashboardPayload> => {
    if (!Array.isArray(auctionIds) || auctionIds.length === 0) {
      return buildDashboardPayload();
    }
    const cleanIds = auctionIds.filter((id) => typeof id === 'string' && id.trim().length > 0);
    if (cleanIds.length > 0) {
      await deleteBidsByAuctionIds(cleanIds);
      await deleteAuctionRecords(cleanIds);
    }
    return buildDashboardPayload();
  },
);

export const deleteBid = webMethod(
  Permissions.Admin,
  async (auctionId: string, bidId: string): Promise<DashboardPayload> => {
    const auction = await getAuctionRecordById(auctionId);

    if (!auction) {
      throw new Error('Auction not found.');
    }

    const bid = await getBidRecordById(bidId);

    if (!bid || bid.auctionId !== auctionId) {
      throw new Error('Bid not found.');
    }

    await deleteBidRecord(bidId);

    const remainingBidderBids = (await listAllBids()).filter(
      (remainingBid) =>
        remainingBid.bidderEmail.toLowerCase() === bid.bidderEmail.toLowerCase(),
    );

    if (remainingBidderBids.length === 0) {
      await deleteLeadsForEmail(bid.bidderEmail);
    } else {
      const latestBid = remainingBidderBids.sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )[0];

      await insertLeadRecord(latestBid.auctionId, {
        bidderName: latestBid.bidderName,
        bidderEmail: latestBid.bidderEmail,
        bidderPhone: latestBid.bidderPhone,
        amount: latestBid.amount,
      });
    }

    if (auction.winnerBidId === bidId) {
      await patchAuctionRecord(auctionId, auction, {
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
        paymentMade: false,
        lifecycle: auction.lifecycle === 'sold' ? 'closed' : auction.lifecycle,
      });
    }

    await insertNotification(
      auctionId,
      'owner',
      'dashboard',
      `Bid from ${bid.bidderName} for ${bid.amount} was deleted.`,
    );

    return buildDashboardPayload();
  },
);

export const getSettings = webMethod(
  Permissions.Admin,
  async (): Promise<AppSettings> => readSettings(),
);

export const saveSettings = webMethod(
  Permissions.Admin,
  async (settings: Partial<AppSettings>): Promise<AppSettings> => {
    const installedPlan = await readInstalledAppPlan();
    await saveConfigurationSettings({
      ...DEFAULT_SETTINGS,
      ...settings,
      ...(installedPlan ? { planTier: installedPlan.tier } : {}),
    });
    // Only settings changed; rebuilding the full dashboard here is slow enough
    // to time out after the save has already succeeded.
    return readSettings();
  },
);

export const getPublicAuctionSettings = webMethod(
  Permissions.Anyone,
  async (): Promise<PublicAuctionSettings> => {
    const settings = await readSettings();
    const installedPlan = await readInstalledAppPlan();
    const planName = installedPlan?.packageName ?? installedPlan?.planName ?? settings.planTier;
    return {
      canSubmitBid: isInstalledAppPlanEntitled(installedPlan, settings),
      emailBiddingEnabled: settings.emailBiddingEnabled,
      winnerCheckoutEmailEnabled:
        planAllows(settings.planTier, 'winnerCheckoutEmail') &&
        settings.winnerCheckoutEmailEnabled,
      planTier: settings.planTier,
      planName,
    };
  },
);

export const getWinnerCheckoutForProduct = webMethod(
  Permissions.SiteMember,
  async (
    productId: string,
    bidderMemberId?: string | null,
    bidderEmail?: string | null,
  ): Promise<{ checkoutUrl: string | null }> => {
    return {
      checkoutUrl: await resolveWinnerCheckoutByProduct(
        productId,
        bidderMemberId,
        bidderEmail,
      ),
    };
  },
);

export const triggerWinnerCheckout = webMethod(
  Permissions.SiteMember,
  async (
    productId: string,
    caller: { memberId: string; email: string },
  ): Promise<{ checkoutUrl: string }> => {
    const auctions = await findAuctionsByProductIds([productId]);
    const auction = auctions.find((item) =>
      isAuctionLinkedToProduct(item, productId),
    );

    if (!auction) {
      throw new Error('Auction not found for this product.');
    }

    const bids = await listBidsByAuctionId(auction.id);
    const settings = await readSettings();
    const status = getAuctionStatus(auction, bids, Date.now());

    if (!['closed', 'sold'].includes(status)) {
      throw new Error('This auction is not yet ready for checkout.');
    }

    const orderedBids = sortBidsDescending(bids);
    const highestBid = orderedBids[0];

    if (!highestBid) {
      throw new Error('No winner found for this auction.');
    }

    // Only the winning bidder may open (and thereby create) the winner checkout.
    if (!bidderMatchesIdentity(highestBid, caller.memberId, caller.email)) {
      throw new Error('Only the winning bidder can check out this auction.');
    }

    if (auction.winnerBidId && auction.winnerPaymentUrl) {
      throw new Error('This winner uses an emailed payment link.');
    }

    if (auction.winnerCheckoutUrl && auction.winnerBidId === highestBid.id) {
      return { checkoutUrl: auction.winnerCheckoutUrl };
    }

    const { checkoutId, checkoutUrl } = await createWinnerCheckout(auction, highestBid);

    await patchAuctionRecord(auction.id, auction, {
      winnerBidId: highestBid.id,
      lifecycle: 'sold',
      winnerCheckoutId: checkoutId,
      winnerCheckoutUrl: checkoutUrl,
      winnerCheckoutRecipientEmail: normalizeEmail(highestBid.bidderEmail),
    });

    return { checkoutUrl };
  },
);

export const acknowledgeWinnerCheckoutEmail = webMethod(
  Permissions.SiteMember,
  async (auctionId: string, winnerEmail: string): Promise<void> => {
    const auction = await getAuctionRecordById(auctionId);

    if (!auction || !auction.winnerBidId) {
      throw new Error('Auction winner information is unavailable.');
    }

    const bids = await listBidsByAuctionId(auctionId);
    const winnerBid = bids.find((bid) => bid.id === auction.winnerBidId) ?? null;

    if (!winnerBid) {
      throw new Error('Winner bid could not be found.');
    }

    if (normalizeEmail(winnerBid.bidderEmail) !== normalizeEmail(winnerEmail)) {
      throw new Error('Winner email mismatch.');
    }

    await patchAuctionRecord(auctionId, auction, {
      winnerCheckoutEmailSentAt: new Date().toISOString(),
    });
  },
);

export const sendWinnerCheckoutEmail = webMethod(
  Permissions.SiteMember,
  async (input: SendWinnerCheckoutEmailInput): Promise<SendWinnerCheckoutEmailResult> => {
    const settings = await readSettings();

    if (
      !planAllows(settings.planTier, 'winnerCheckoutEmail') ||
      !settings.winnerCheckoutEmailEnabled
    ) {
      return { sent: false, sentAt: null };
    }

    const auction = await getAuctionRecordById(input.auctionId);

    if (!auction || !auction.winnerBidId) {
      throw new Error('Auction winner information is unavailable.');
    }

    const bids = await listBidsByAuctionId(input.auctionId);
    const winnerBid = bids.find((bid) => bid.id === auction.winnerBidId) ?? null;

    if (!winnerBid) {
      throw new Error('Winner bid could not be found.');
    }

    if (!bidderMatchesIdentity(winnerBid, input.bidderMemberId, input.bidderEmail)) {
      throw new Error('Winner identity mismatch.');
    }

    const checkoutUrl = auction.winnerCheckoutUrl?.trim() ?? '';

    if (!checkoutUrl) {
      throw new Error('Winner checkout is not ready yet.');
    }

    if (auction.winnerCheckoutEmailSentAt) {
      return { sent: false, sentAt: auction.winnerCheckoutEmailSentAt };
    }

    const recipientEmail = normalizeEmail(winnerBid.bidderEmail);

    if (!recipientEmail) {
      throw new Error('Winner email is required.');
    }

    const email = buildWinnerCheckoutEmail({
      businessName: settings.businessName,
      auctionTitle: auction.title,
      bidderName: winnerBid.bidderName,
      checkoutUrl,
    });

    await sendAuctionEmail({
      senderName: settings.businessName,
      recipients: [{ email: recipientEmail, name: winnerBid.bidderName }],
      subject: email.subject,
      html: email.html,
    });

    const sentAt = new Date().toISOString();
    await patchAuctionRecord(input.auctionId, auction, {
      winnerCheckoutEmailSentAt: sentAt,
    });

    return { sent: true, sentAt };
  },
);

export const sendLeadEmails = webMethod(
  Permissions.Admin,
  async (input: SendLeadEmailsInput): Promise<SendLeadEmailsResult> => {
    const settings = await readSettings();
    assertPlanFeature(settings, 'leads');
    const subject = input.subject.trim();
    const html = input.html.trim();

    if (!subject) {
      throw new Error('Email subject is required.');
    }

    if (isBlankHtml(html)) {
      throw new Error('Email message is required.');
    }

    const leadIds = Array.from(new Set((input.leadIds ?? []).map((id) => id.trim()).filter(Boolean)));

    if (leadIds.length === 0) {
      throw new Error('Select at least one lead.');
    }

    const leads = await listLeads();
    const selectedLeads = leads.filter((lead) => leadIds.includes(lead.id));

    if (selectedLeads.length === 0) {
      throw new Error('Selected leads could not be found.');
    }

    const recipientCount = await sendAuctionEmail({
      senderName: settings.businessName,
      recipients: selectedLeads.map((lead) => ({
        email: lead.bidderEmail,
        name: lead.bidderName,
      })),
      subject,
      html,
    });

    return { recipientCount };
  },
);

export const exportAuctionCsv = webMethod(
  Permissions.Admin,
  async (auctionId: string): Promise<string> => {
    const settings = await readSettings();
    const auction = await getAuctionRecordById(auctionId);

    if (!auction) {
      throw new Error('Auction not found.');
    }

    const auctionBids = await listBidsByAuctionId(auctionId);
    
    const view = toAuctionView(
      auction,
      auctionBids,
      settings,
      Date.now(),
    );

    return createCsv({
      ...view,
      recentBids: sortBidsDescending(auctionBids).map(toBidSummary),
    });
  },
);

export const getProductVariantState = webMethod(
  Permissions.Anyone,
  async (productId: string): Promise<ProductVariantState> => {
    return loadProductVariantState(productId);
  },
);

export const listPublicAuctions = webMethod(
  Permissions.Anyone,
  async (): Promise<AuctionView[]> => {
    const auctions = await buildPublicAuctions();

    console.log(
      '[auction] listPublicAuctions',
      JSON.stringify({
        auctionCount: auctions.length,
        auctions: auctions.map((auction) => ({
          id: auction.id,
          title: auction.title,
          status: auction.status,
          lifecycle: auction.lifecycle,
          productIds: auction.productIds,
          startTime: auction.startTime,
          endTime: auction.endTime,
          updatedAt: auction.updatedAt,
        })),
      }),
    );

    return auctions;
  },
);

export const listPublicAuctionProducts = webMethod(
  Permissions.Anyone,
  async (input: PublicAuctionProductQuery = {}): Promise<PublicAuctionProductsResult> => {
    const auctions = await buildPublicAuctions();
    const activeProductIds = new Set(
      auctions
        .filter((auction) => isCurrentProductLinkStatus(auction.status))
        .flatMap((auction) => auction.productIds),
    );

    const result = await findPublicStoreProductPage(input, auctions, activeProductIds);

    console.log(
      '[auction] listPublicAuctionProducts',
      JSON.stringify({
        search: input.search ?? '',
        auctionFilter: normalizePublicAuctionProductFilter(input.auctionFilter),
        timerFilter: normalizePublicAuctionTimerFilter(input.timerFilter),
        cursor: input.cursor ?? null,
        returned: result.products.length,
        hasNextPage: result.hasNextPage,
      }),
    );

    return result;
  },
);

async function submitBid(
    auctionId: string,
    input: BidInput,
    emailOnly = false,
    ): Promise<{ auction: AuctionView; automationResponse?: any }> {
    const settings = await readSettings();
    const installedPlan = await readInstalledAppPlan();
    if (!isInstalledAppPlanEntitled(installedPlan, settings)) {
      throw new Error('Bidding is unavailable on this site.');
    }

    if (emailOnly && !settings.emailBiddingEnabled) {
      throw new Error('Email bidding is disabled. Sign in to place a bid.');
    }
    if (emailOnly) {
      const derivedName =
        input.bidderName?.trim() ||
        input.bidderEmail?.trim()?.split('@')[0] ||
        'Bidder';
      input = {
        ...input,
        bidderMemberId: null,
        bidderName: derivedName,
        bidderPhone: input.bidderPhone ?? '',
      };
    }
    const auction = await getAuctionRecordById(auctionId);

    if (!auction) {
      throw new Error('Auction not found.');
    }

    const auctionBids = await listBidsByAuctionId(auctionId);
    const status = getAuctionStatus(auction, auctionBids, Date.now());

    if (!['live', 'endingSoon'].includes(status)) {
      throw new Error('This auction is not currently accepting bids.');
    }

    if (!input.bidderEmail?.trim()) {
      throw new Error('Email is required.');
    }
    if (!emailOnly && !input.bidderName?.trim()) {
      throw new Error('Name and email are required.');
    }
    if (!input.bidderName?.trim()) {
      throw new Error('Name is required.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.bidderEmail.trim())) {
      throw new Error('Enter a valid email address.');
    }

    const productId = input.productId?.trim() || auction.productIds[0] || '';
    const variantState = productId
      ? await loadProductVariantState(productId)
      : {
          productId,
          catalogVersion: 'STORES_NOT_INSTALLED' as const,
          variants: [],
          variantsRequired: false,
        };
    const resolvedVariant = resolveBidVariant(
      variantState,
      input.variantId,
      input.variantChoices ?? null,
    );
    const previousHighBid =
      sortBidsDescending(
        getBidsRelevantToVariant(auctionBids, resolvedVariant.variantId),
      )[0] ?? null;
    const minimumNextBid = getMinimumNextBidAmount(
      auction,
      auctionBids,
      settings,
      resolvedVariant.variantId,
    );

    if (input.amount < minimumNextBid) {
      throw new Error(`The next valid bid is ${minimumNextBid}.`);
    }

    const bid = await insertBidRecord(auctionId, {
      ...input,
      variantId: resolvedVariant.variantId,
      variantLabel: resolvedVariant.variantLabel,
      variantChoices: resolvedVariant.variantChoices,
    });
    await insertLeadRecord(auctionId, input);

    const now = Date.now();
    let effectiveAuctionEndTime = auction.endTime;

    if (hasAuctionEndTime(auction.endTime)) {
      const timeRemaining = new Date(auction.endTime).getTime() - now;

      if (
        planAllows(settings.planTier, 'antiSniping') &&
        auction.antiSnipingEnabled &&
        timeRemaining > 0 &&
        timeRemaining <= auction.antiSnipingWindowSeconds * 1000
      ) {
        effectiveAuctionEndTime = new Date(
          new Date(auction.endTime).getTime() +
            auction.antiSnipingExtensionSeconds * 1000,
        ).toISOString();

        await patchAuctionRecord(auctionId, auction, {
          endTime: effectiveAuctionEndTime,
        });
      }
    }

    await insertNotification(
      auctionId,
      'owner',
      'dashboard',
      `${bid.bidderName} placed ${input.amount} on ${auction.title}.`,
    );

    await insertNotification(
      auctionId,
      'bidder',
      'whatsapp',
      `Thanks ${bid.bidderName}, your bid of ${input.amount} was received for ${auction.title}.`,
    );

    await sendBidNotificationEmails(settings, auction, bid);

    if (previousHighBid && !isSameBidder(previousHighBid, input)) {
      const [currencyCode, linkData] = await Promise.all([
        readSiteCurrency(),
        getAuctionNotificationLinkData(auction),
      ]);

      try {
        const notificationSent = await sendOutbidNotification(settings, {
          previousHighBid,
          newHighBid: bid,
          auction,
          auctionEndTime: effectiveAuctionEndTime,
          placeNewBidUrl: linkData.placeNewBidUrl,
          myBidsDashboardUrl: settings.myBidsPageUrl,
          currencyCode,
          productName: linkData.productName,
        });

        if (notificationSent) {
          await insertNotification(
            auctionId,
            'bidder',
            'dashboard',
            `${previousHighBid.bidderName} was outbid on ${auction.title}.`,
          );
        }
      } catch (error) {
        console.warn('[auction] outbid notification failed', {
          auctionId,
          previousHighBidId: previousHighBid.id,
          newHighBidId: bid.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log(
      '[auction-web] invoking notifications API for placed bid',
      JSON.stringify({
        auctionId,
        bidId: bid.id,
        bidderEmail: bid.bidderEmail,
      }),
    );

    try {
      await sendNewBidWixNotification(bid);
    } catch (err) {
      console.warn(
        '[auction-web] notifications API call failed',
        JSON.stringify({
          auctionId,
          bidId: bid.id,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    let automationResponse: any = null;

    // Report the event to Wix Automations
    // Do not call automations when entering email manually (emailOnly mode or missing/invalid member ID)
    const isMemberBid = !emailOnly && Boolean(input.bidderMemberId?.trim());
    const isValidUuid = (val?: string | null): boolean =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val.trim()));

    if (isMemberBid && isValidUuid(input.bidderMemberId)) {
      try {
        const productId = auction.productIds[0];
        let productName = auction.title;

        if (productId) {
          try {
            const product = await products.getProduct(productId);
            if (product && product?.product?.name) {
              productName = product?.product?.name;
            }
          } catch (err) {
            console.warn(`[auction-web] failed to fetch product details for automation: ${productId}`, err);
          }
        }

        const elevatedReportEvent = auth.elevate(activations.reportEvent);
        const resolvedBidEndsAt = hasAuctionEndTime(effectiveAuctionEndTime)
          ? new Date(effectiveAuctionEndTime).toISOString()
          : (hasAuctionEndTime(auction.endTime)
              ? new Date(auction.endTime).toISOString()
              : new Date(Date.now() + 30 * 86400000).toISOString());

        const automationPayload = {
          bidderMemberId: input.bidderMemberId!.trim(),
          bidEndsAt: resolvedBidEndsAt,
          auctionId: auctionId,
          amount: Math.round(input.amount),
          bidderName: input.bidderName || 'Bidder',
          bidderPhone: input.bidderPhone || '',
          createdAt: bid.createdAt,
          productName: productName,
          productId: productId || '',
          bidderEmail: input.bidderEmail,
        };

        console.log(`[auction-web] reporting automation event: smart_auction_manager-bid_placed`, JSON.stringify(automationPayload, null, 2));

        automationResponse = await elevatedReportEvent('smart_auction_manager-bid_placed', {
          externalEntityId: auctionId,
          idempotency: {
            key: bid.id,
          },
          payload: automationPayload,
        });

        console.log('[auction-web] automation event reported successfully', automationResponse);
      } catch (err) {
        console.error('[auction-web] failed to report bid_placed event to automations', err);
        automationResponse = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    const refreshedAuction = await getAuctionRecordById(auctionId);
    const refreshedBids = await listBidsByAuctionId(auctionId);

    if (!refreshedAuction) {
      throw new Error('Auction refresh failed after bid placement.');
    }

    return {
      auction: redactAuctionContacts(
        toAuctionView(
          refreshedAuction,
          refreshedBids,
          settings,
          Date.now(),
        ),
      ),
      automationResponse,
    };
}

export const placeBid = webMethod(
  Permissions.SiteMember,
  (auctionId: string, input: BidInput) => submitBid(auctionId, input),
);

export const placeEmailBid = webMethod(
  Permissions.Anyone,
  (auctionId: string, input: BidInput) => submitBid(auctionId, input, true),
);
