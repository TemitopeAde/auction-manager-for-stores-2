import React, {
  type ChangeEvent,
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { dashboard } from '@wix/dashboard';
import {
  Badge,
  Box,
  Button,
  Card,
  Cell,
  Checkbox,
  CustomModalLayout,
  FormField,
  Heading,
  Input,
  Layout,
  Loader,
  MessageModalLayout,
  Modal,
  MultiSelect,
  NumberInput,
  Pagination,
  Select,
  Table,
  TableActionCell,
  Text,
  TextButton,
  Tooltip,
} from './ui';
import * as Icons from '@wix/wix-ui-icons-common';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

import { EMPTY_AUCTION_INPUT } from '../../../../../lib/auction/defaults';
import { DEFAULT_SETTINGS } from '../../../../../lib/auction/defaults';
import {
  formatBillingCycle,
  formatPlanPrice,
  getFeatureUpgradeMessage,
  getPlan,
  PLAN_COMPARISON_ROWS,
  PLAN_ORDER,
  PLANS,
  planAllows,
  type PlanFeatureKey,
} from '../../../../../lib/auction/plans';
import type {
  AppSettings,
  DashboardLeadView,
  DashboardProductResult,
  DashboardProductRow,
  AuctionInput,
  AuctionLifecycle,
  AuctionStatus,
  AuctionView,
  BidSummary,
  DashboardAuctionRow,
  DashboardPayload,
  PlanTier,
} from '../../../../../lib/auction/types';
import {
  formatCountdown,
  formatCountdownFromMs,
  formatCurrency,
  formatDateTime,
  getAuctionCountdownMs,
  hasAuctionEndTime,
  reservesProductForAuction,
  reservesProductForAuctionAt,
} from '../../../../../lib/auction/utils';
import {
  createAuctionFromProduct,
  downloadAuctionExport,
  downloadLeadsExport,
  createWhatsappHref,
  deleteAuction,
  deleteAuctions,
  deleteBid,
  getSettings,
  loadDashboard,
  readDashboardPageContext,
  searchAuctionBids,
  searchDashboardAuctions,
  searchDashboardLeads,
  searchDashboardProducts,
  getStoreProductsByIds,
  getSitePluginPlacementStatus,
  queryStoreProducts,
  runAuctionAction,
  resendWinnerPaymentEmail,
  saveSettings,
  updateAuction,
} from '../../../../../lib/client/dashboard-api';
import {
  PRODUCT_PAGE_PLUGIN_IDS,
  SITE_PLUGIN_DEFINITIONS,
  type SitePluginDefinition,
  type SitePluginPlacementStatusResult,
} from '../../../../../lib/site-plugins/catalog';
import { AuctionStatusBadge } from './AuctionStatusBadge';
import { MetricCard } from './MetricCard';
import styles from './AuctionDashboardApp.module.css';

const CountdownTimer: FC<{ auction: AuctionView }> = ({ auction }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (auction.status === 'paused') {
    const remainingMs = getAuctionCountdownMs(auction, now);
    return (
      <span>
        {Number.isFinite(remainingMs)
          ? `Paused with ${formatCountdownFromMs(remainingMs)} left`
          : 'Paused (open-ended)'}
      </span>
    );
  }

  return <span>{formatCountdown(auction.endTime, now)}</span>;
};

function formatCompactCurrency(value: number, currencyCode?: string): string {
  if (!currencyCode) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCompactCountdown(targetTime: string, now: number): string {
  if (!hasAuctionEndTime(targetTime)) {
    return 'Open';
  }

  const distance = new Date(targetTime).getTime() - now;

  if (distance <= 0) {
    return 'Closed';
  }

  const totalMinutes = Math.floor(distance / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${Math.max(minutes, 1)}m`;
}

const CompactCountdownTimer: FC<{ auction: AuctionView }> = ({ auction }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span>
      {auction.status === 'paused'
        ? 'Paused'
        : formatCompactCountdown(auction.endTime, now)}
    </span>
  );
};

const MonitorCountdownBadge: FC<{ auction: AuctionView }> = ({ auction }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (auction.status === 'paused') {
    return (
      <span className={`${styles.glassBadge} ${styles.glassBadgePaused}`}>
        <Icons.PauseSmall /> Paused
      </span>
    );
  }

  const isEndingSoon = auction.status === 'endingSoon';

  return (
    <span
      className={`${styles.glassCountdown} ${isEndingSoon ? styles.glassBadgeEnding : ''}`}
    >
      <Icons.TimeSmall />
      {formatCompactCountdown(auction.endTime, now)}
    </span>
  );
};

function getReserveProgress(
  currentBid: number,
  reservePrice: number | null,
): {
  percent: number;
  met: boolean;
  amountNeeded: number;
} {
  if (!reservePrice || reservePrice <= 0) {
    return { percent: 100, met: true, amountNeeded: 0 };
  }
  const met = currentBid >= reservePrice;
  const percent = Math.min(100, Math.round((currentBid / reservePrice) * 100));
  const amountNeeded = Math.max(0, reservePrice - currentBid);
  return { percent, met, amountNeeded };
}

type DashboardTab =
  | 'overview'
  | 'monitor'
  | 'auctions'
  | 'products'
  | 'leads'
  | 'settings';
type WinnerFilter = 'all' | 'winner' | 'others';
type ProductAuctionFilter = 'all' | 'linked' | 'unlinked';

const FILTER_CONTROL_STYLE: React.CSSProperties = {
  minWidth: 160,
  height: 38,
  borderRadius: 6,
  border: '1px solid #e6e4dc',
  padding: '0 12px',
  background: '#ffffff',
  color: '#15161a',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
};

const FILTER_BAR_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  width: '100%',
};

const FILTER_SEARCH_ITEM_STYLE: React.CSSProperties = {
  flex: '1 1 280px',
  minWidth: 240,
};

const FILTER_ITEM_STYLE: React.CSSProperties = {
  flex: '0 0 auto',
};

const EMPTY_STATE_STYLE: React.CSSProperties = {
  padding: '36px 24px',
  borderRadius: 8,
  border: '1px dashed #e6e4dc',
  background: '#ffffff',
  color: '#5e6068',
  textAlign: 'center',
  fontSize: '0.875rem',
};

const MONITOR_REFRESH_INTERVAL_MS = 5000;

const EMAIL_EDITOR_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'blockquote'],
    [{ align: [] }],
    ['clean'],
  ],
};

const EMAIL_EDITOR_FORMATS = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'list',
  'bullet',
  'link',
  'blockquote',
  'align',
];

const CLICKABLE_TABLE_CELL_STYLE: React.CSSProperties = {
  width: '100%',
  cursor: 'pointer',
};


function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}

function toLocalInput(value: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrEmpty(value: string): string {
  return value ? new Date(value).toISOString() : '';
}

function fromAuction(auction: AuctionView | null): AuctionInput {
  if (!auction) {
    return EMPTY_AUCTION_INPUT;
  }

  return {
    title: auction.title,
    description: auction.description,
    imageUrls: auction.imageUrls,
    startingPrice: auction.startingPrice,
    reservePrice: auction.reservePrice,
    startTime: auction.startTime,
    endTime: auction.endTime,
    lifecycle: auction.lifecycle,
    minIncrement: auction.minIncrement,
    antiSnipingEnabled: auction.antiSnipingEnabled,
    antiSnipingWindowSeconds: auction.antiSnipingWindowSeconds,
    antiSnipingExtensionSeconds: auction.antiSnipingExtensionSeconds,
    paymentMade: auction.paymentMade,
    productIds: auction.productIds || [],
  };
}

const tabs: Array<{
  id: DashboardTab;
  title: string;
  icon: React.ReactNode;
}> = [
  { id: 'overview', title: 'Overview', icon: <Icons.InfoCircle /> },
  { id: 'monitor', title: 'Monitor', icon: <Icons.LineChart /> },
  { id: 'auctions', title: 'Auctions', icon: <Icons.Collections /> },
  { id: 'products', title: 'Products', icon: <Icons.Cart /> },
  { id: 'leads', title: 'Leads', icon: <Icons.Users /> },
  { id: 'settings', title: 'Settings', icon: <Icons.Settings /> },
];

const APP_ID = '386a20a7-69ff-46a2-bc5b-2c2ce9eb7a78';
const APP_UPDATE_URL = `https://wix.com/app-installer?appId=${APP_ID}`;

const PlanLock: FC<{
  allowed: boolean;
  feature: PlanFeatureKey;
  children: React.ReactNode;
}> = ({ allowed, feature, children }) => {
  if (allowed) {
    return <>{children}</>;
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ pointerEvents: 'none', opacity: 0.55 }}>{children}</div>
      <Tooltip content={getFeatureUpgradeMessage(feature)} disabled={false}>
        <span
          aria-label={getFeatureUpgradeMessage(feature)}
          style={{
            position: 'absolute',
            inset: 0,
            cursor: 'not-allowed',
          }}
        />
      </Tooltip>
    </div>
  );
};

const TAB_SUBTITLES: Record<DashboardTab, string> = {
  overview: 'Your auction snapshot and the steps to get your store auction-ready.',
  monitor: 'Track live bidding momentum, reserve progress, and quick actions.',
  auctions: 'Search, filter, and manage every auction in your catalog.',
  products: 'Link store products to auctions and keep inventory in sync.',
  leads: 'Review bidders, winners, and follow-up opportunities.',
  settings: 'Configure defaults, messaging, and auction behavior.',
};

// Older bid notifications embedded the variant id, e.g. "... on test (00000000-0000-...)."
const VARIANT_ID_SUFFIX = / \([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\)(?=\.?$)/i;

function stripVariantIdFromMessage(message: string): string {
  return message.replace(VARIANT_ID_SUFFIX, '');
}

const EMPTY_PAYLOAD: DashboardPayload = {
  generatedAt: new Date(0).toISOString(),
  settings: DEFAULT_SETTINGS,
  installedPlan: null,
  summary: {
    totalAuctions: 0,
    activeAuctions: 0,
    endingSoon: 0,
    totalBids: 0,
    totalLeads: 0,
  },
  auctions: [],
  notifications: [],
  leads: [],
  currency: '',
};

interface AuctionDashboardAppProps {
  onTitleChange?: (title: string) => void;
  onStateChange?: (state: {
    createAuction: () => void;
    goToLeads: () => void;
    refresh: () => void;
    isBusy: boolean;
  }) => void;
}

type WinnerSelectionState = {
  auctionId: string;
  auctionTitle: string;
  bid: BidSummary;
} | null;

type BidDeletionState = {
  auctionId: string;
  auctionTitle: string;
  bid: BidSummary;
  isWinner: boolean;
} | null;

type SitePluginRow = {
  pluginId: string;
  name: string;
  placedInSlot: boolean | null;
  definition?: SitePluginDefinition;
};

export const AuctionDashboardApp: FC<AuctionDashboardAppProps> = ({
  onTitleChange,
  onStateChange,
}) => {
  const [payload, setPayload] = useState<DashboardPayload>(EMPTY_PAYLOAD);
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [form, setForm] = useState<AuctionInput>(EMPTY_AUCTION_INPUT);
  const [productAvailabilityNow, setProductAvailabilityNow] = useState(Date.now());
  const [settingsForm, setSettingsForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5;
  const auctionsPerPage = 50;
  const productsPerPage = 50;
  const [auctionTotal, setAuctionTotal] = useState(0);
  const [leadPage, setLeadPage] = useState(1);
  const [leadTotal, setLeadTotal] = useState(0);
  const [bidPage, setBidPage] = useState(1);
  const [bidTotal, setBidTotal] = useState(0);
  const [monitorPage, setMonitorPage] = useState(1);
  const [monitorTotal, setMonitorTotal] = useState(0);
  const [monitorResults, setMonitorResults] = useState<AuctionView[]>([]);
  const [isMonitorLoading, setIsMonitorLoading] = useState(true);
  const [productPickerSearch, setProductPickerSearch] = useState('');
  const [productPickerPage, setProductPickerPage] = useState(1);
  const [productPickerTotal, setProductPickerTotal] = useState(0);
  const [productPickerOptions, setProductPickerOptions] = useState<any[]>([]);
  const [isProductPickerLoading, setIsProductPickerLoading] = useState(false);
  const auctionRequestId = useRef(0);
  const leadRequestId = useRef(0);
  const productRequestId = useRef(0);
  const bidRequestId = useRef(0);
  const monitorRequestId = useRef(0);
  const monitorQueryKey = useRef<string | null>(null);
  const productPickerRequestId = useRef(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pluginPlacementResult, setPluginPlacementResult] =
    useState<SitePluginPlacementStatusResult | null>(null);
  const [isPluginStatusLoading, setIsPluginStatusLoading] = useState(false);
  const [placingPluginId, setPlacingPluginId] = useState<string | null>(null);
  const [placedPluginIds, setPlacedPluginIds] = useState<Set<string>>(() => new Set());
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [viewingBidsAuctionId, setViewingBidsAuctionId] = useState<string | null>(null);
  const [auctionSearch, setAuctionSearch] = useState<string>('');
  const [auctionStatusFilter, setAuctionStatusFilter] = useState<'all' | AuctionStatus>('all');
  const [auctionLifecycleFilter, setAuctionLifecycleFilter] = useState<
    'all' | AuctionLifecycle
  >('all');
  const [auctionResults, setAuctionResults] = useState<DashboardAuctionRow[]>([]);
  const [isAuctionsTableLoading, setIsAuctionsTableLoading] = useState<boolean>(false);
  const [leadSearch, setLeadSearch] = useState<string>('');
  const [leadAuctionFilter, setLeadAuctionFilter] = useState<string>('all');
  const [leadResults, setLeadResults] = useState<DashboardLeadView[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [isEmailComposerOpen, setIsEmailComposerOpen] = useState<boolean>(false);
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [isLeadsTableLoading, setIsLeadsTableLoading] = useState<boolean>(false);
  const [isExportingLeads, setIsExportingLeads] = useState<boolean>(false);
  const [productSearch, setProductSearch] = useState<string>('');
  const [productAuctionFilter, setProductAuctionFilter] =
    useState<ProductAuctionFilter>('all');
  const [productPage, setProductPage] = useState<number>(1);
  const [productResults, setProductResults] = useState<DashboardProductRow[]>([]);
  const [productTotal, setProductTotal] = useState<number>(0);
  const [isProductsTableLoading, setIsProductsTableLoading] = useState<boolean>(false);
  const [bidsSearch, setBidsSearch] = useState<string>('');
  const [bidsWinnerFilter, setBidsWinnerFilter] = useState<WinnerFilter>('all');
  const [bidResults, setBidResults] = useState<BidSummary[]>([]);
  const [isBidsTableLoading, setIsBidsTableLoading] = useState<boolean>(false);
  const [pendingWinnerSelection, setPendingWinnerSelection] =
    useState<WinnerSelectionState>(null);
  const [isConfirmingWinner, setIsConfirmingWinner] = useState<boolean>(false);
  const [winnerPaymentUrl, setWinnerPaymentUrl] = useState('');
  const [winnerPaymentButtonLabel, setWinnerPaymentButtonLabel] = useState('');
  const [winnerPaymentFormError, setWinnerPaymentFormError] = useState<string | null>(null);
  const [resendingWinnerAuctionId, setResendingWinnerAuctionId] = useState<string | null>(null);
  const [auctionToDelete, setAuctionToDelete] = useState<AuctionView | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [selectedAuctionIds, setSelectedAuctionIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);
  const [isSelectingAllMatching, setIsSelectingAllMatching] = useState<boolean>(false);
  const [bidToDelete, setBidToDelete] = useState<BidDeletionState>(null);
  const [isDeletingBid, setIsDeletingBid] = useState<boolean>(false);
  const [actionToConfirm, setActionToConfirm] = useState<{
    id: string;
    action: 'pause' | 'resume' | 'restart';
    title: string;
  } | null>(null);
  const [isPerformingAction, setIsPerformingAction] = useState<boolean>(false);
  const [monitorSearch, setMonitorSearch] = useState<string>('');
  const [monitorFilter, setMonitorFilter] = useState<
    'all' | 'live' | 'endingSoon' | 'scheduled' | 'paused'
  >('all');

  const debouncedAuctionSearch = useDebouncedValue(auctionSearch, 300);
  const debouncedLeadSearch = useDebouncedValue(leadSearch, 300);
  const debouncedProductSearch = useDebouncedValue(productSearch, 300);
  const debouncedBidsSearch = useDebouncedValue(bidsSearch, 300);
  const debouncedMonitorSearch = useDebouncedValue(monitorSearch, 300);
  const debouncedProductPickerSearch = useDebouncedValue(productPickerSearch, 300);

  const isAuctionSearching = (auctionSearch !== debouncedAuctionSearch) || isAuctionsTableLoading;
  const isLeadSearching = (leadSearch !== debouncedLeadSearch) || isLeadsTableLoading;
  const isProductSearching = (productSearch !== debouncedProductSearch) || isProductsTableLoading;
  const isBidsSearching = (bidsSearch !== debouncedBidsSearch) || isBidsTableLoading;
  const isMonitorSearching = (monitorSearch !== debouncedMonitorSearch) || isMonitorLoading;
  const isProductPickerSearching =
    productPickerSearch !== debouncedProductPickerSearch ||
    (isProductPickerLoading && productPickerPage === 1);
  const isProductPickerLoadingMore = isProductPickerLoading && productPickerPage > 1;

  const selectedAuction = useMemo(
    () => payload?.auctions.find((auction) => auction.id === selectedAuctionId) ?? null,
    [payload, selectedAuctionId],
  );

  const monitorCounts = useMemo(() => {
    const active = (payload.auctions || []).filter((a) =>
      ['scheduled', 'live', 'endingSoon', 'paused'].includes(a.status),
    );
    return {
      all: active.length,
      live: active.filter((a) => a.status === 'live').length,
      endingSoon: active.filter((a) => a.status === 'endingSoon').length,
      scheduled: active.filter((a) => a.status === 'scheduled').length,
      paused: active.filter((a) => a.status === 'paused').length,
      totalActiveBids: active.reduce((acc, a) => acc + (a.bidCount || 0), 0),
    };
  }, [payload.auctions]);

  const recentLiveBids = useMemo(() => {
    const list: Array<{
      id: string;
      bidderName: string;
      bidderEmail: string;
      amount: number;
      createdAt: string;
      auctionTitle: string;
      auctionId: string;
    }> = [];

    (payload.auctions || []).forEach((auction) => {
      if (['scheduled', 'live', 'endingSoon', 'paused'].includes(auction.status)) {
        auction.recentBids?.forEach((bid) => {
          list.push({
            id: bid.id,
            bidderName: bid.bidderName || 'Anonymous Bidder',
            bidderEmail: bid.bidderEmail || '',
            amount: bid.amount,
            createdAt: bid.createdAt,
            auctionTitle: auction.title,
            auctionId: auction.id,
          });
        });
      }
    });

    return list
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [payload.auctions]);

  const productAuctionConflicts = useMemo(() => {
    const activeProductIds = new Set(form.productIds || []);

    if (activeProductIds.size === 0) {
      return [];
    }

    return payload.auctions.filter((auction) => {
      if (selectedAuctionId && auction.id === selectedAuctionId) {
        return false;
      }

      return (
        reservesProductForAuctionAt(auction, productAvailabilityNow) &&
        auction.productIds.some((productId) => activeProductIds.has(productId))
      );
    });
  }, [form.productIds, payload.auctions, productAvailabilityNow, selectedAuctionId]);

  useEffect(() => {
    const nextEndTime = Math.min(
      ...payload.auctions
        .filter((auction) =>
          auction.lifecycle === 'published' &&
          reservesProductForAuction(auction.status) &&
          hasAuctionEndTime(auction.endTime),
        )
        .map((auction) => new Date(auction.endTime).getTime())
        .filter((endTime) => endTime > productAvailabilityNow),
    );

    if (!Number.isFinite(nextEndTime)) return;

    const timer = window.setTimeout(
      () => setProductAvailabilityNow(Date.now()),
      Math.max(0, nextEndTime - Date.now() + 100),
    );
    return () => window.clearTimeout(timer);
  }, [payload.auctions, productAvailabilityNow]);

  const productAuctionConflictMessage = useMemo(() => {
    if (productAuctionConflicts.length === 0) {
      return null;
    }

    const conflictingProducts = productAuctionConflicts.flatMap((auction) =>
      auction.productIds.filter((productId) => (form.productIds || []).includes(productId)),
    );

    const conflictingNames = Array.from(new Set(conflictingProducts))
      .map((productId) => {
        const product = storeProducts.find((item) => item._id === productId || item.id === productId);
        return product?.name || productId;
      })
      .join(', ');

    return `An unfinished auction already exists for: ${conflictingNames}. End or delete it before creating another one.`;
  }, [form.productIds, productAuctionConflicts, storeProducts]);

  useEffect(() => {
    if (!form.productIds?.length) {
      return;
    }

    console.log(
      '[Dashboard] productAuctionConflicts',
      JSON.stringify({
        selectedAuctionId,
        selectedProductIds: form.productIds,
        conflicts: productAuctionConflicts.map((auction) => ({
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
  }, [form.productIds, productAuctionConflicts, selectedAuctionId]);

  const viewingBidsAuction = useMemo(
    () => payload?.auctions.find((auction) => auction.id === viewingBidsAuctionId) ?? null,
    [payload, viewingBidsAuctionId],
  );

  const filteredAuctions = auctionResults;
  const areAllVisibleAuctionsSelected =
    filteredAuctions.length > 0 &&
    filteredAuctions.every((a) => selectedAuctionIds.includes(a.id));

  const filteredProductAuctionRows = productResults;

  const filteredLeads = leadResults;
  const filteredBids = bidResults;
  const areAllVisibleLeadsSelected =
    filteredLeads.length > 0 &&
    filteredLeads.every(({ bid }) => selectedLeadIds.includes(bid.id));

  useEffect(() => {
    setBidsSearch('');
    setBidsWinnerFilter('all');
    setBidPage(1);
  }, [viewingBidsAuctionId]);

  const ensureProductsLoaded = useCallback(async (ids: string[]) => {
    console.log('[Dashboard] ensureProductsLoaded triggered with IDs:', ids);
    if (!ids || ids.length === 0) {
      console.log('[Dashboard] No IDs provided, skipping fetch.');
      return;
    }
    
    // Check current state directly
    const missingIds = ids.filter(id => {
      const isLoaded = storeProducts.some(p => (p._id === id || p.id === id));
      return !isLoaded;
    });
    
    console.log('[Dashboard] Missing IDs to fetch:', missingIds);
    
    if (missingIds.length > 0) {
      try {
        console.log('[Dashboard] Calling getStoreProductsByIds API...');
        const response = await getStoreProductsByIds(missingIds);
        console.log('[Dashboard] API Response:', response);
        if (response.products?.length > 0) {
          setStoreProducts(current => {
            const existingIds = new Set(current.map(p => p._id || p.id));
            const newItems = response.products.filter((p: any) => !existingIds.has(p._id || p.id));
            return [...current, ...newItems.map((p: any) => ({ ...p, _id: p._id || p.id }))];
          });
        }
      } catch (e) {
        console.error('[Dashboard] Error fetching missing products:', e);
      }
    }
  }, [storeProducts]);

  const handleEditAuction = useCallback((auction: any) => {
    console.log('[Dashboard] handleEditAuction clicked for auction:', auction.id);
    setSelectedAuctionId(auction.id);
    const input = fromAuction(auction);
    console.log('[Dashboard] Calculated input productIds:', input.productIds);
    const productIds = Array.isArray(input.productIds) ? input.productIds.slice(0, 1) : [];
    setForm({
      ...input,
      productIds,
    });
    setIsFormOpen(true);
    if (productIds.length > 0) {
      void ensureProductsLoaded(productIds);
    } else {
      console.log('[Dashboard] Auction has no productIds to load.');
    }
  }, [ensureProductsLoaded]);

  const handleCreateAuctionForProduct = useCallback((product: {
    id: string;
    name: string;
  }) => {
    setSelectedAuctionId(null);
    setForm({
      ...EMPTY_AUCTION_INPUT,
      antiSnipingEnabled: planAllows(payload.settings.planTier, 'antiSniping'),
      productIds: [product.id],
      title: product.name,
    });
    setIsFormOpen(true);
    void ensureProductsLoaded([product.id]);
  }, [ensureProductsLoaded, payload.settings.planTier]);

  const refreshAuctionResults = useCallback(async (): Promise<void> => {
    const requestId = ++auctionRequestId.current;
    setIsAuctionsTableLoading(true);

    try {
      const results = await searchDashboardAuctions({
        search: debouncedAuctionSearch,
        status: auctionStatusFilter,
        lifecycle: auctionLifecycleFilter,
        page: currentPage,
        pageSize: auctionsPerPage,
        includeLinkedProducts: true,
      });
      if (requestId !== auctionRequestId.current) return;
      setAuctionTotal(results.total);
      setAuctionResults(results.rows);
      const lastPage = Math.max(1, Math.ceil(results.total / auctionsPerPage));
      if (currentPage > lastPage) setCurrentPage(lastPage);
    } catch (error) {
      if (requestId === auctionRequestId.current) {
        setAuctionResults([]);
        setAuctionTotal(0);
        dashboard.showToast({ message: 'Unable to search auctions.', type: 'error' });
      }
    } finally {
      if (requestId === auctionRequestId.current) setIsAuctionsTableLoading(false);
    }
  }, [
    auctionLifecycleFilter,
    auctionStatusFilter,
    currentPage,
    debouncedAuctionSearch,
  ]);

  const refreshLeadResults = useCallback(async (): Promise<void> => {
    const requestId = ++leadRequestId.current;
    setIsLeadsTableLoading(true);

    try {
      const results = await searchDashboardLeads({
        search: debouncedLeadSearch,
        auctionId: leadAuctionFilter,
        page: leadPage,
        pageSize: itemsPerPage,
      });
      if (requestId !== leadRequestId.current) return;
      setLeadTotal(results.total);
      setLeadResults(results.rows);
      const lastPage = Math.max(1, Math.ceil(results.total / itemsPerPage));
      if (leadPage > lastPage) setLeadPage(lastPage);
    } catch (error) {
      if (requestId === leadRequestId.current) {
        setLeadResults([]);
        setLeadTotal(0);
        dashboard.showToast({ message: 'Unable to search leads.', type: 'error' });
      }
    } finally {
      if (requestId === leadRequestId.current) setIsLeadsTableLoading(false);
    }
  }, [debouncedLeadSearch, leadAuctionFilter, leadPage]);

  const refreshProductResults = useCallback(async (): Promise<void> => {
    const requestId = ++productRequestId.current;
    setIsProductsTableLoading(true);

    try {
      const results: DashboardProductResult = await searchDashboardProducts({
        search: debouncedProductSearch,
        auctionLink: productAuctionFilter,
        page: productPage,
        pageSize: productsPerPage,
      });
      if (requestId !== productRequestId.current) return;
      setProductResults(results.rows);
      setProductTotal(results.total);
      const lastPage = Math.max(1, Math.ceil(results.total / productsPerPage));
      if (productPage > lastPage) setProductPage(lastPage);
    } catch (error) {
      if (requestId === productRequestId.current) {
        setProductResults([]);
        setProductTotal(0);
        dashboard.showToast({ message: 'Unable to search products.', type: 'error' });
      }
    } finally {
      if (requestId === productRequestId.current) setIsProductsTableLoading(false);
    }
  }, [debouncedProductSearch, productsPerPage, productAuctionFilter, productPage]);

  const refreshBidResults = useCallback(async (): Promise<void> => {
    const requestId = ++bidRequestId.current;
    if (!viewingBidsAuctionId) {
      setBidResults([]);
      setBidTotal(0);
      return;
    }

    setIsBidsTableLoading(true);

    try {
      const results = await searchAuctionBids({
        auctionId: viewingBidsAuctionId,
        search: debouncedBidsSearch,
        winner: bidsWinnerFilter,
        page: bidPage,
        pageSize: itemsPerPage,
      });
      if (requestId !== bidRequestId.current) return;
      setBidResults(results.rows);
      setBidTotal(results.total);
      const lastPage = Math.max(1, Math.ceil(results.total / itemsPerPage));
      if (bidPage > lastPage) setBidPage(lastPage);
    } catch (error) {
      if (requestId === bidRequestId.current) {
        setBidResults([]);
        setBidTotal(0);
        dashboard.showToast({ message: 'Unable to search bids.', type: 'error' });
      }
    } finally {
      if (requestId === bidRequestId.current) setIsBidsTableLoading(false);
    }
  }, [bidPage, bidsWinnerFilter, debouncedBidsSearch, viewingBidsAuctionId]);

  const refreshMonitorResults = useCallback(async (): Promise<void> => {
    const requestId = ++monitorRequestId.current;
    // Only show the loader when the query changes; background refreshes of the
    // same query update the cards in place.
    const queryKey = JSON.stringify([debouncedMonitorSearch, monitorFilter, monitorPage]);
    const isSameQuery = monitorQueryKey.current === queryKey;
    monitorQueryKey.current = queryKey;
    if (!isSameQuery) setIsMonitorLoading(true);

    try {
      const results = await searchDashboardAuctions({
        search: debouncedMonitorSearch,
        status: monitorFilter,
        activeOnly: true,
        page: monitorPage,
        pageSize: 8,
      });
      if (requestId !== monitorRequestId.current) return;
      setMonitorResults(results.rows);
      setMonitorTotal(results.total);
      const lastPage = Math.max(1, Math.ceil(results.total / 8));
      if (monitorPage > lastPage) setMonitorPage(lastPage);
    } catch (error) {
      if (requestId === monitorRequestId.current && !isSameQuery) {
        setMonitorResults([]);
        setMonitorTotal(0);
        dashboard.showToast({ message: 'Unable to search active auctions.', type: 'error' });
      }
    } finally {
      if (requestId === monitorRequestId.current) setIsMonitorLoading(false);
    }
  }, [debouncedMonitorSearch, monitorFilter, monitorPage]);

  const refreshProductPicker = useCallback(async (): Promise<void> => {
    const requestId = ++productPickerRequestId.current;
    setIsProductPickerLoading(true);

    try {
      const results = await queryStoreProducts({
        search: debouncedProductPickerSearch,
        page: productPickerPage,
        pageSize: 20,
      });
      if (requestId !== productPickerRequestId.current) return;
      // Later pages append to the list for infinite scrolling.
      setProductPickerOptions((current) => {
        if (productPickerPage === 1) return results.products;
        const seen = new Set(current.map((product) => product._id));
        return [...current, ...results.products.filter((product) => !seen.has(product._id))];
      });
      setProductPickerTotal(results.total);
      setStoreProducts((current) => {
        const byId = new Map(current.map((product) => [product._id || product.id, product]));
        results.products.forEach((product) => byId.set(product._id || product.id, product));
        return [...byId.values()];
      });
    } catch (error) {
      if (requestId === productPickerRequestId.current) {
        if (productPickerPage === 1) {
          setProductPickerOptions([]);
          setProductPickerTotal(0);
        }
        dashboard.showToast({ message: 'Unable to search store products.', type: 'error' });
      }
    } finally {
      if (requestId === productPickerRequestId.current) setIsProductPickerLoading(false);
    }
  }, [debouncedProductPickerSearch, productPickerPage]);

  useEffect(() => {
    if (tab === 'auctions') void refreshAuctionResults();
  }, [payload.generatedAt, refreshAuctionResults, tab]);

  useEffect(() => {
    if (tab === 'leads') void refreshLeadResults();
  }, [payload.generatedAt, refreshLeadResults, tab]);

  useEffect(() => {
    if (tab === 'products') void refreshProductResults();
  }, [payload.generatedAt, refreshProductResults, tab]);

  useEffect(() => {
    if (viewingBidsAuctionId) void refreshBidResults();
  }, [payload.generatedAt, refreshBidResults]);

  useEffect(() => {
    if (tab === 'monitor') void refreshMonitorResults();
  }, [payload.generatedAt, refreshMonitorResults, tab]);

  useEffect(() => {
    if (isFormOpen) void refreshProductPicker();
  }, [isFormOpen, refreshProductPicker]);

  useEffect(() => {
    if (!isFormOpen) {
      setProductPickerSearch('');
      setProductPickerPage(1);
    }
  }, [isFormOpen]);

  useEffect(() => {
    onTitleChange?.(payload.settings.businessName || 'Auction Manager for Stores');
  }, [onTitleChange, payload.settings.businessName]);

  useEffect(() => {
    if (tab !== 'settings') return;

    let cancelled = false;
    setIsLoadingSettings(true);

    getSettings()
      .then((settings) => {
        if (!cancelled) setSettingsForm(settings);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[Dashboard] getSettings failed:', error);
        dashboard.showToast({
          message: error instanceof Error ? error.message : 'Unable to load settings.',
          type: 'error',
        });
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSettings(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab]);

  const currentPlan = useMemo(
    () => getPlan(payload.installedPlan?.tier ?? payload.settings.planTier),
    [payload.installedPlan?.tier, payload.settings.planTier],
  );

  const currentPlanTooltip = useMemo(() => {
    const billingCycle = formatBillingCycle(payload.installedPlan?.billingCycle);
    const packageName = payload.installedPlan?.packageName;

    if (payload.installedPlan?.isFree) {
      return 'Free plan from the Wix App Market';
    }

    return [packageName, billingCycle, 'Managed in the Wix App Market']
      .filter(Boolean)
      .join(' · ');
  }, [payload.installedPlan]);

  // Removed redundant selectedAuction useEffect


  const refreshDashboard = useCallback(async (
    options: { silent?: boolean } = {},
  ): Promise<void> => {
    const { silent = false } = options;

    if (!silent) {
      setIsLoading(true);
      setLoadError(null);
    }

    try {
      const nextPayload = await loadDashboard();
      setPayload(nextPayload);
      if (!silent) {
        setSettingsForm(nextPayload.settings);
      }
    } catch (error) {
      // Background refreshes keep the last good data and retry on the next tick.
      if (silent) return;
      const message =
        error instanceof Error ? error.message : 'Unable to load dashboard.';
      setLoadError(message);
      dashboard.showToast({
        message,
        type: 'error',
      });
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  const refreshPluginPlacementStatus = useCallback(async (): Promise<void> => {
    setIsPluginStatusLoading(true);

    try {
      setPluginPlacementResult(await getSitePluginPlacementStatus());
    } catch (error) {
      setPluginPlacementResult({
        placementStatuses: [],
        error: error instanceof Error ? error.message : 'Unable to read site plugin placement status.',
      });
    } finally {
      setIsPluginStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'overview') {
      void refreshPluginPlacementStatus();
    }
  }, [refreshPluginPlacementStatus, tab]);

  const sitePluginRows = useMemo((): SitePluginRow[] => {
    const statuses = pluginPlacementResult?.placementStatuses ?? [];
    const knownIds = new Set(SITE_PLUGIN_DEFINITIONS.map((plugin) => plugin.id));

    // A site has only one product page, so once a product page plugin is placed
    // (or was just placed from here) list only that one and hide the other.
    const placedProductPagePluginId =
      statuses.find(
        (status) =>
          PRODUCT_PAGE_PLUGIN_IDS.has(status.pluginId) &&
          (status.placedInSlot === true || placedPluginIds.has(status.pluginId)),
      )?.pluginId ??
      Array.from(placedPluginIds).find((id) => PRODUCT_PAGE_PLUGIN_IDS.has(id));

    const filteredDefinitions = SITE_PLUGIN_DEFINITIONS.filter(
      (definition) =>
        !placedProductPagePluginId ||
        !PRODUCT_PAGE_PLUGIN_IDS.has(definition.id) ||
        definition.id === placedProductPagePluginId,
    );

    return [
      ...filteredDefinitions.map((definition) => {
        const status = statuses.find((item) => item.pluginId === definition.id);
        return {
          pluginId: definition.id,
          name: definition.name,
          // Placement status can lag right after placing, so trust the placement we just made.
          placedInSlot:
            placedPluginIds.has(definition.id) ? true : status?.placedInSlot ?? null,
          definition,
        };
      }),
      ...statuses
        .filter((status) => !knownIds.has(status.pluginId))
        .map((status) => ({
          pluginId: status.pluginId,
          name: status.name || 'Site Plugin',
          placedInSlot:
            placedPluginIds.has(status.pluginId) ? true : status.placedInSlot,
        })),
    ];
  }, [placedPluginIds, pluginPlacementResult]);

  const handlePlaceSitePlugin = useCallback(
    async (row: SitePluginRow): Promise<void> => {
      if (placingPluginId) {
        return;
      }

      setPlacingPluginId(row.pluginId);

      try {
        const options: {
          slotId?: string;
          placement?: {
            appDefinitionId: string;
            widgetId: string;
            slotId: string;
          };
        } = {};

        if (row.definition?.slotId) {
          options.slotId = row.definition.slotId;
        }
        if (row.definition?.placement) {
          options.placement = row.definition.placement;
          if (!options.slotId && row.definition.placement.slotId) {
            options.slotId = row.definition.placement.slotId;
          }
        }

        await dashboard.addSitePlugin(
          row.pluginId,
          Object.keys(options).length > 0 ? options : undefined,
        );

        setPlacedPluginIds((prev) => {
          const next = new Set(prev);
          next.add(row.pluginId);
          return next;
        });

        await refreshPluginPlacementStatus();
        dashboard.showToast({
          message: `${row.name} was successfully placed on the site.`,
          type: 'success',
        });
      } catch (error) {
        console.error('[Dashboard] Error placing site plugin:', error);

        let message = 'Unable to place the site plugin.';
        let toastType: 'error' | 'warning' = 'error';

        if (typeof error === 'object' && error !== null && 'code' in error) {
          const code = (error as { code: number }).code;
          switch (code) {
            case 3001:
              message = 'The slot for this plugin is already occupied.';
              break;
            case 3002:
              message = 'The target slot was not found on your site.';
              break;
            case 3003:
              message = 'An error occurred while placing the plugin.';
              break;
            case 3004:
              message = 'An error occurred while replacing an existing plugin.';
              break;
            case 3005:
              message = 'Failed to load plugin placement modal data.';
              break;
            case 3006:
              message = 'Plugin placement was canceled.';
              toastType = 'warning';
              break;
            case 3007:
              message =
                'The site must be published before placing plugins. Please publish the site first.';
              break;
            default:
              message = error instanceof Error ? error.message : 'Unable to place the site plugin.';
          }
        } else if (error instanceof Error) {
          message = error.message;
        }

        dashboard.showToast({
          message,
          type: toastType,
        });
      } finally {
        setPlacingPluginId(null);
      }
    },
    [placingPluginId, refreshPluginPlacementStatus],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!auctionToDelete) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteAuction(auctionToDelete.id);
      dashboard.showToast({
        message: `Auction "${auctionToDelete.title}" deleted successfully.`,
        type: 'success',
      });
      setSelectedAuctionIds((prev) => prev.filter((id) => id !== auctionToDelete.id));
      void refreshDashboard();
      void refreshProductResults();
      void refreshAuctionResults();
      void refreshMonitorResults();
    } catch (e) {
      console.error('[Dashboard] Error deleting auction:', e);
      dashboard.showToast({
        message: 'Failed to delete auction. Please try again.',
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
      setAuctionToDelete(null);
    }
  }, [
    auctionToDelete,
    refreshAuctionResults,
    refreshDashboard,
    refreshMonitorResults,
    refreshProductResults,
  ]);

  const handleConfirmBulkDelete = useCallback(async () => {
    if (selectedAuctionIds.length === 0) {
      return;
    }

    setIsBulkDeleting(true);
    const count = selectedAuctionIds.length;

    try {
      await deleteAuctions(selectedAuctionIds);
      dashboard.showToast({
        message: `Successfully deleted ${count} auction${count === 1 ? '' : 's'}.`,
        type: 'success',
      });
      setSelectedAuctionIds([]);
      setIsBulkDeleteModalOpen(false);
      void refreshDashboard();
      void refreshProductResults();
      void refreshAuctionResults();
      void refreshMonitorResults();
    } catch (e) {
      console.error('[Dashboard] Error bulk deleting auctions:', e);
      dashboard.showToast({
        message: 'Failed to delete auctions. Please try again.',
        type: 'error',
      });
    } finally {
      setIsBulkDeleting(false);
    }
  }, [
    selectedAuctionIds,
    refreshAuctionResults,
    refreshDashboard,
    refreshMonitorResults,
    refreshProductResults,
  ]);

  const toggleAuctionSelection = useCallback((auctionId: string) => {
    setSelectedAuctionIds((current) =>
      current.includes(auctionId)
        ? current.filter((id) => id !== auctionId)
        : [...current, auctionId],
    );
  }, []);

  const toggleSelectAllVisibleAuctions = useCallback(() => {
    setSelectedAuctionIds((current) => {
      const visibleAuctionIds = filteredAuctions.map((a) => a.id);

      if (visibleAuctionIds.every((id) => current.includes(id))) {
        return current.filter((id) => !visibleAuctionIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleAuctionIds]));
    });
  }, [filteredAuctions]);

  const handleSelectAllMatchingAuctions = useCallback(async () => {
    setIsSelectingAllMatching(true);
    try {
      const res = await searchDashboardAuctions({
        search: debouncedAuctionSearch || undefined,
        status: auctionStatusFilter !== 'all' ? auctionStatusFilter : undefined,
        lifecycle: auctionLifecycleFilter !== 'all' ? auctionLifecycleFilter : undefined,
        page: 1,
        pageSize: Math.max(auctionTotal, 1000),
      });
      const allIds = res.rows.map((a) => a.id);
      setSelectedAuctionIds(allIds);
    } catch (e) {
      console.error('[Dashboard] Failed to select all matching auctions:', e);
    } finally {
      setIsSelectingAllMatching(false);
    }
  }, [
    auctionLifecycleFilter,
    auctionStatusFilter,
    auctionTotal,
    debouncedAuctionSearch,
  ]);

  const handleConfirmDeleteBid = useCallback(async () => {
    if (!bidToDelete) {
      return;
    }

    setIsDeletingBid(true);

    try {
      const nextPayload = await deleteBid(bidToDelete.auctionId, bidToDelete.bid.id);
      setPayload(nextPayload);
      dashboard.showToast({
        message: `Bid from ${bidToDelete.bid.bidderName} was deleted.`,
        type: 'success',
      });
      setBidToDelete(null);
    } catch (error) {
      console.error('[Dashboard] Error deleting bid:', error);
      dashboard.showToast({
        message:
          error instanceof Error ? error.message : 'Failed to delete bid. Please try again.',
        type: 'error',
      });
    } finally {
      setIsDeletingBid(false);
    }
  }, [bidToDelete]);

  const handleConfirmAction = useCallback(async () => {
    if (!actionToConfirm) {
      return;
    }
    setIsPerformingAction(true);
    try {
      await runAuctionAction(actionToConfirm.id, actionToConfirm.action);
      dashboard.showToast({
        message: `Auction "${actionToConfirm.title}" ${
          actionToConfirm.action === 'pause'
            ? 'paused'
            : actionToConfirm.action === 'resume'
              ? 'resumed'
              : 'restarted'
        } successfully.`,
        type: 'success',
      });
      refreshDashboard();
    } catch (e) {
      console.error(`[Dashboard] Error during ${actionToConfirm.action}:`, e);
      dashboard.showToast({
        message: `Failed to ${actionToConfirm.action} auction. Please try again.`,
        type: 'error',
      });
    } finally {
      setIsPerformingAction(false);
      setActionToConfirm(null);
    }
  }, [actionToConfirm, refreshDashboard]);

  const handleSyncFromProducts = useCallback(() => {
    const selected = storeProducts.filter((p) =>
      (form.productIds || []).includes(p._id),
    );
    if (selected.length === 0) {
      return;
    }

    const title = selected.map((p) => p.name).join(' & ');
    const description = selected
      .map((p) => p.description)
      .filter(Boolean)
      .join('\n\n');
    const imageUrls = selected
      .flatMap(
        (p) =>
          p.media?.items?.map((m: any) => m.image?.url || m.video?.url) || [],
      )
      .filter(Boolean);

    setForm((prev) => ({
      ...prev,
      title: title || prev.title,
      description: description || prev.description,
      imageUrls: imageUrls.length > 0 ? imageUrls : prev.imageUrls,
    }));

    dashboard.showToast({
      message: 'Synced details from selected product.',
      type: 'success',
    });
  }, [form.productIds, storeProducts]);

  const createAuctionAction = useCallback(() => {
    setSelectedAuctionId(null);
    setForm({
      ...EMPTY_AUCTION_INPUT,
      antiSnipingEnabled: planAllows(payload.settings.planTier, 'antiSniping'),
    });
    setIsFormOpen(true);
  }, [payload.settings.planTier]);

  const goToLeadsAction = useCallback(() => {
    setTab('leads');
  }, []);

  const toggleLeadSelection = useCallback((leadId: string) => {
    setSelectedLeadIds((current) =>
      current.includes(leadId)
        ? current.filter((id) => id !== leadId)
        : [...current, leadId],
    );
  }, []);

  const toggleSelectAllVisibleLeads = useCallback(() => {
    setSelectedLeadIds((current) => {
      const visibleLeadIds = filteredLeads.map(({ bid }) => bid.id);

      if (visibleLeadIds.every((leadId) => current.includes(leadId))) {
        return current.filter((leadId) => !visibleLeadIds.includes(leadId));
      }

      return Array.from(new Set([...current, ...visibleLeadIds]));
    });
  }, [filteredLeads]);

  const handleExportLeads = useCallback(async (): Promise<void> => {
    if (leadTotal === 0) {
      dashboard.showToast({
        message: 'No leads available to export.',
        type: 'warning',
      });
      return;
    }

    setIsExportingLeads(true);

    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadLeadsExport(
        {
          search: debouncedLeadSearch,
          auctionId: leadAuctionFilter,
          leadIds: selectedLeadIds.length > 0 ? selectedLeadIds : undefined,
        },
        `auction-leads-${stamp}.csv`,
      );
      dashboard.showToast({
        message: `Exported ${selectedLeadIds.length || leadTotal} lead${(selectedLeadIds.length || leadTotal) === 1 ? '' : 's'}.`,
        type: 'success',
      });
    } catch (error) {
      dashboard.showToast({
        message:
          error instanceof Error ? error.message : 'Unable to export leads right now.',
        type: 'error',
      });
    } finally {
      setIsExportingLeads(false);
    }
  }, [
    debouncedLeadSearch,
    leadAuctionFilter,
    leadTotal,
    selectedLeadIds,
  ]);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  // Keep the Monitor tab live: refetch on entry, poll while it is visible, and
  // refetch when the dashboard regains focus. Leads, bids and counts come
  // straight from the collections, so CMS edits/deletions show up here too.
  const hasLoadedDashboard = useRef(false);
  useEffect(() => {
    if (tab !== 'monitor') return;

    if (hasLoadedDashboard.current) {
      void refreshDashboard({ silent: true });
    }
    hasLoadedDashboard.current = true;

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshDashboard({ silent: true });
      }
    };
    const timer = setInterval(refreshIfVisible, MONITOR_REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
    };
  }, [refreshDashboard, tab]);

  useEffect(() => {
    const contextFromQuery = readDashboardPageContext();

    if (contextFromQuery) {
      if (contextFromQuery.tab) {
        setTab(contextFromQuery.tab);
      }

      if (contextFromQuery.productId) {
        setIsFormOpen(true);
        setForm((current) => ({
          ...current,
          productIds: [contextFromQuery.productId as string],
          title: current.title || contextFromQuery.productName || '',
        }));
        void ensureProductsLoaded([contextFromQuery.productId]);
      }
    }

    const observeState = (dashboard as any).observeState;

    if (typeof observeState !== 'function') {
      return;
    }

    const unsubscribe = observeState((state: Record<string, unknown> | undefined) => {
      const productId =
        typeof state?.productId === 'string' && state.productId.trim()
          ? state.productId.trim()
          : null;
      const productName =
        typeof state?.productName === 'string' && state.productName.trim()
          ? state.productName.trim()
          : null;

      if (!productId) {
        return;
      }

      setIsFormOpen(true);
      setForm((current) => ({
        ...current,
        productIds: [productId],
        title: current.title || productName || '',
      }));
      void ensureProductsLoaded([productId]);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [ensureProductsLoaded]);

  useEffect(() => {
    onStateChange?.({
      createAuction: createAuctionAction,
      goToLeads: goToLeadsAction,
      refresh: () => {
        void refreshDashboard();
      },
      isBusy: isLoading || isSaving,
    });
  }, [
    createAuctionAction,
    goToLeadsAction,
    isLoading,
    isSaving,
    onStateChange,
    refreshDashboard,
  ]);

  function updateFormField<Key extends keyof AuctionInput>(
    key: Key,
    value: AuctionInput[Key],
  ): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function pickImageUrlsFromMediaManager(): Promise<string[]> {
    const result = await dashboard.openMediaManager({
      category: 'IMAGE',
      multiSelect: true,
    });

    return (result?.items ?? [])
      .map((item) => item.url)
      .filter((url): url is string => typeof url === 'string' && url.length > 0);
  }

  async function handlePickImages(): Promise<void> {
    try {
      const urls = await pickImageUrlsFromMediaManager();

      if (urls.length > 0) {
        setForm((current) => ({
          ...current,
          imageUrls: Array.from(new Set([...current.imageUrls, ...urls])),
        }));
      }
    } catch (error) {
      dashboard.showToast({
        message: error instanceof Error ? error.message : 'Unable to open media manager.',
        type: 'error',
      });
    }
  }

  async function handleSaveAuction(): Promise<void> {
    console.log('[Dashboard] handleSaveAuction: form at save time', JSON.stringify({
      productIds: form.productIds,
      title: form.title,
      lifecycle: form.lifecycle,
      isEdit: Boolean(selectedAuction),
    }));

    if (productAuctionConflictMessage) {
      dashboard.showToast({
        message: productAuctionConflictMessage,
        type: 'error',
      });
      return;
    }

    const selectedProductId = form.productIds?.[0];

    if ((form.productIds || []).length !== 1 || !selectedProductId) {
      dashboard.showToast({
        message: 'Select one product for this auction.',
        type: 'error',
      });
      return;
    }

    const auctionInput = {
      ...form,
      productIds: [selectedProductId],
    };

    setIsSaving(true);

    try {
      const previousAuctionIds = new Set(payload.auctions.map((auction) => auction.id));
      const nextPayload = selectedAuction
        ? await updateAuction(selectedAuction.id, auctionInput)
        : await createAuctionFromProduct(selectedProductId, auctionInput);

      setPayload(nextPayload);
      setSettingsForm(nextPayload.settings);
      if (!selectedAuction) {
        const createdAuction =
          nextPayload.auctions.find((auction) => !previousAuctionIds.has(auction.id)) ??
          nextPayload.auctions.find(
            (auction) =>
              auction.title === auctionInput.title &&
              auction.lifecycle === auctionInput.lifecycle &&
              JSON.stringify(auction.productIds) === JSON.stringify(auctionInput.productIds),
          ) ??
          nextPayload.auctions[0] ??
          null;

        setSelectedAuctionId(createdAuction?.id ?? null);
        console.log(
          '[Dashboard] handleSaveAuction: selected created auction',
          JSON.stringify(
            createdAuction
              ? {
                  id: createdAuction.id,
                  title: createdAuction.title,
                  status: createdAuction.status,
                  lifecycle: createdAuction.lifecycle,
                  productIds: createdAuction.productIds,
                }
              : null,
          ),
        );
      }

      console.log('[Dashboard] handleSaveAuction: saved auction productIds', JSON.stringify({
        savedAuctions: nextPayload.auctions.map((a) => ({ id: a.id, title: a.title, productIds: a.productIds })),
      }));

      dashboard.showToast({
        message: selectedAuction ? 'Auction updated.' : 'Auction created.',
        type: 'success',
      });
      setIsFormOpen(false);
      void refreshProductResults();
      void refreshAuctionResults();
      void refreshMonitorResults();
    } catch (error: any) {
      console.error('[Dashboard] saveAuction failed:', error);
      dashboard.showToast({
        message: error?.message || 'Unable to save auction.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAction(
    auctionId: string,
    action:
      | 'publish'
      | 'draft'
      | 'pause'
      | 'resume'
      | 'close'
      | 'restart'
      | 'approveWinner',
    bidId?: string,
  ): Promise<void> {
    try {
      const nextPayload = await runAuctionAction(auctionId, action, bidId);
      setPayload(nextPayload);
      dashboard.showToast({
        message: 'Auction updated.',
        type: 'success',
      });
      void refreshProductResults();
      void refreshAuctionResults();
      void refreshMonitorResults();
    } catch (error: any) {
      console.error('[Dashboard] action failed:', error);
      dashboard.showToast({
        message: error?.message || 'Action failed.',
        type: 'error',
      });
    }
  }

  async function handleConfirmWinnerSelection(): Promise<void> {
    if (!pendingWinnerSelection) {
      return;
    }

    const needsPaymentLink =
      payload.settings.emailBiddingEnabled &&
      payload.settings.emailWinnerPaymentLinkEnabled &&
      !pendingWinnerSelection.bid.bidderMemberId;
    let paymentDetails: { url: string; buttonLabel: string } | undefined;
    if (needsPaymentLink) {
      const url = winnerPaymentUrl.trim();
      const buttonLabel = winnerPaymentButtonLabel.trim();
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) {
          throw new Error('invalid URL');
        }
      } catch {
        setWinnerPaymentFormError('Enter a valid HTTPS payment URL.');
        return;
      }
      if (!buttonLabel || buttonLabel.length > 80) {
        setWinnerPaymentFormError('Enter a button label of 1 to 80 characters.');
        return;
      }
      paymentDetails = { url, buttonLabel };
    }

    setWinnerPaymentFormError(null);
    setIsConfirmingWinner(true);

    try {
      const nextPayload = await runAuctionAction(
        pendingWinnerSelection.auctionId,
        'approveWinner',
        pendingWinnerSelection.bid.id,
        paymentDetails,
      );
      setPayload(nextPayload);
      setPendingWinnerSelection(null);
      setWinnerPaymentUrl('');
      setWinnerPaymentButtonLabel('');
      dashboard.showToast({
        message: nextPayload.winnerPaymentEmailError ||
          (needsPaymentLink ? 'Winner selected and payment email sent.' : 'Winner updated.'),
        type: nextPayload.winnerPaymentEmailError ? 'error' : 'success',
      });
    } catch (error: any) {
      console.error('[Dashboard] select winner failed:', error);
      dashboard.showToast({
        message: error?.message || 'Unable to update winner.',
        type: 'error',
      });
    } finally {
      setIsConfirmingWinner(false);
    }
  }

  async function handleResendWinnerPaymentEmail(auctionId: string): Promise<void> {
    setResendingWinnerAuctionId(auctionId);
    try {
      const nextPayload = await resendWinnerPaymentEmail(auctionId);
      setPayload(nextPayload);
      dashboard.showToast({
        message: nextPayload.winnerPaymentEmailError || 'Payment email sent again.',
        type: nextPayload.winnerPaymentEmailError ? 'error' : 'success',
      });
    } catch (error: any) {
      dashboard.showToast({
        message: error?.message || 'Unable to resend payment email.',
        type: 'error',
      });
    } finally {
      setResendingWinnerAuctionId(null);
    }
  }

  async function handleSaveSettings(): Promise<void> {
    if (!settingsForm) {
      return;
    }

    setIsSaving(true);

    try {
      const savedSettings = await saveSettings(settingsForm);
      setPayload((current) => ({ ...current, settings: savedSettings }));
      setSettingsForm(savedSettings);
      dashboard.showToast({
        message: 'Settings saved.',
        type: 'success',
      });
    } catch (error: any) {
      console.error('[Dashboard] saveSettings failed:', error);
      dashboard.showToast({
        message: error?.message || 'Unable to save settings.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }

  function renderAuctionList(auctions: AuctionView[]): JSX.Element {
    if (auctions.length === 0) {
      return (
        <div style={EMPTY_STATE_STYLE}>
          <Text secondary>
            No auctions yet. Use New Auction to create your first listing.
          </Text>
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gap: 18 }}>
        {auctions.map((auction) => {
          const winningBid = auction.winner ?? auction.recentBids[0] ?? null;
          const winnerLink = winningBid
            ? createWhatsappHref(winningBid.bidderPhone, auction.title, winningBid)
            : null;

          return (
            <Card key={auction.id}>
              <Card.Header
                title={auction.title}
                subtitle={`${formatCurrency(auction.currentHighestBid, payload.currency)} • ${auction.bidCount} bid(s)`}
              />
              <Card.Content>
                <div style={{ display: 'grid', gap: 14 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <AuctionStatusBadge status={auction.status} />
                    <span style={{ color: '#5f6b7a', fontSize: 13 }}>
                      Ends in <CountdownTimer auction={auction} />
                    </span>
                  </div>
                  <p style={{ margin: 0, color: '#3c3e45', lineHeight: 1.6 }}>
                    {auction.description}
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                      gap: 10,
                    }}
                  >
                    {auction.imageUrls.slice(0, 3).map((imageUrl) => (
                      <img
                        key={imageUrl}
                        src={imageUrl}
                        alt={auction.title}
                        style={{
                          width: '100%',
                          height: 90,
                          objectFit: 'cover',
                          borderRadius: 12,
                        }}
                      />
                    ))}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Button
                      size="small"
                      priority="secondary"
                      onClick={() => handleEditAuction(auction)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      priority="secondary"
                      onClick={() =>
                        void handleAction(
                          auction.id,
                          auction.lifecycle === 'paused'
                            ? 'resume'
                            : auction.lifecycle === 'published'
                              ? 'pause'
                              : 'publish',
                        )
                      }
                    >
                      {auction.lifecycle === 'paused'
                        ? 'Resume'
                        : auction.lifecycle === 'published'
                          ? 'Pause'
                          : 'Publish'}
                    </Button>
                    <Button
                      size="small"
                      priority="secondary"
                      onClick={() => void handleAction(auction.id, 'close')}
                    >
                      Close
                    </Button>
                    {auction.status === 'reserveNotMet' ? (
                      <Button
                        size="small"
                        priority="secondary"
                        onClick={() =>
                          setActionToConfirm({
                            id: auction.id,
                            action: 'restart',
                            title: auction.title,
                          })
                        }
                      >
                        Restart
                      </Button>
                    ) : null}
                    <Button
                      size="small"
                      priority="secondary"
                      onClick={() => setViewingBidsAuctionId(auction.id)}
                    >
                      View Bids
                    </Button>
                    <Button
                      size="small"
                      priority="secondary"
                      onClick={() =>
                        void downloadAuctionExport(
                          auction.id,
                          `${auction.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`,
                        )
                      }
                    >
                      Export CSV
                    </Button>
                    {winningBid ? (
                      <PlanLock allowed={currentPlan.features.whatsapp} feature="whatsapp">
                        {winnerLink && currentPlan.features.whatsapp ? (
                          <a
                            href={winnerLink}
                            target="_blank"
                            rel="noreferrer"
                            style={{ textDecoration: 'none' }}
                          >
                            <Button size="small" priority="secondary">
                              WhatsApp winner
                            </Button>
                          </a>
                        ) : (
                          <Button size="small" priority="secondary" disabled>
                            WhatsApp winner
                          </Button>
                        )}
                      </PlanLock>
                    ) : null}
                  </div>
                </div>
              </Card.Content>
            </Card>
          );
        })}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.centeredState}>
        <Loader />
      </div>
    );
  }

  const activeTab = tabs.find((item) => item.id === tab) ?? tabs[0];

  const unplacedPluginRows = sitePluginRows.filter((row) => row.placedInSlot === false);
  const setupChecklist: Array<{
    id: string;
    title: string;
    body: string;
    done: boolean;
    action?: { label: string; onClick: () => void };
  }> = [
    {
      id: 'create',
      title: 'Create your first auction',
      body: 'Pick a Wix Stores product and set a starting bid, reserve, and schedule.',
      done: payload.summary.totalAuctions > 0,
      action: { label: 'Create auction', onClick: createAuctionAction },
    },
    {
      id: 'widget',
      title: 'Add the auction widget to your site',
      body: 'Place the bidding plugin on your product page so shoppers can bid.',
      done: sitePluginRows.some((row) => row.placedInSlot === true),
    },
    {
      id: 'emails',
      title: 'Turn on bid emails',
      body: 'Let bidders get confirmations and outbid alerts, and send winners a payment link.',
      done: payload.settings.emailBiddingEnabled,
      action: { label: 'Open Settings', onClick: () => setTab('settings') },
    },
    {
      id: 'live',
      title: 'Go live',
      body: 'Publish an auction so it opens for bidding on your site.',
      done: payload.summary.activeAuctions > 0,
      action: { label: 'View auctions', onClick: () => setTab('auctions') },
    },
    {
      id: 'bid',
      title: 'Receive your first bid',
      body: 'Share the product page and watch bids arrive in Monitor.',
      done: payload.summary.totalBids > 0,
      action: { label: 'Open Monitor', onClick: () => setTab('monitor') },
    },
  ];
  const checklistDoneCount = setupChecklist.filter((item) => item.done).length;
  const siteName = payload.siteName?.trim() || payload.settings.businessName || 'Smart Auction';

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m14 13-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10" />
              <path d="m16 16 6-6" />
              <path d="m8 8 6-6" />
              <path d="m9 7 8 8" />
              <path d="m21 11-8-8" />
            </svg>
          </span>
          <div className={styles.brandText}>
            <h2 className={styles.brandTitle} title={siteName}>{siteName}</h2>
            <span className={styles.brandSubtitle}>Auction Manager for Stores</span>
          </div>
        </div>
        <nav className={styles.nav} aria-label="Dashboard sections">
          {tabs.map((item) => {
            const isActive = item.id === tab;
            const leadsLocked = item.id === 'leads' && !currentPlan.features.leads;
            const navButton = (
              <button
                key={item.id}
                type="button"
                className={`${styles.navItem}${isActive ? ` ${styles.navItemActive}` : ''}${
                  leadsLocked ? ` ${styles.navItemDisabled}` : ''
                }`}
                onClick={() => {
                  if (leadsLocked) {
                    return;
                  }
                  setTab(item.id);
                }}
                aria-current={isActive ? 'page' : undefined}
                aria-disabled={leadsLocked}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span>{item.title}</span>
              </button>
            );

            if (!leadsLocked) {
              return navButton;
            }

            return (
              <PlanLock key={item.id} allowed={false} feature="leads">
                {navButton}
              </PlanLock>
            );
          })}
        </nav>
        <div className={styles.planCard}>
          <div className={styles.planCardRow}>
            <span className={styles.planCardName}>{currentPlan.name} plan</span>
            {Number.isFinite(currentPlan.activeAuctions) ? (
              <span className={styles.planCardCount}>
                {Math.min(payload.summary.activeAuctions, currentPlan.activeAuctions)} / {currentPlan.activeAuctions}
              </span>
            ) : null}
          </div>
          {Number.isFinite(currentPlan.activeAuctions) ? (
            <>
              <div className={styles.planCardTrack}>
                <div
                  className={styles.planCardFill}
                  style={{
                    width: `${Math.min(
                      100,
                      (payload.summary.activeAuctions / Math.max(1, currentPlan.activeAuctions)) * 100,
                    )}%`,
                  }}
                />
              </div>
              <span className={styles.planCardHint}>
                Active auction slots used. Upgrade for unlimited auctions.
              </span>
            </>
          ) : (
            <span className={styles.planCardHint}>Unlimited active auctions.</span>
          )}
          <TextButton size="small" onClick={() => setTab('settings')} style={{ color: '#fdba74', textDecoration: 'none' }}>
            View plans →
          </TextButton>
        </div>
        <a
          href={APP_UPDATE_URL}
          target="_blank"
          rel="noreferrer"
          className={`${styles.navItem} ${styles.updateAppLink}`}
        >
          <span className={styles.navIcon}>
            <Icons.Update />
          </span>
          <span>Update App</span>
        </a>
      </aside>

      <div className={styles.main}>
        <header className={styles.topBar}>
          <div className={styles.topBarCopy}>
            <div className={styles.pageTitleRow}>
              <h1 className={styles.pageTitle}>{activeTab.title}</h1>
              {tab === 'monitor' ? (
                <span className={styles.liveSyncPill}>
                  <span className={styles.pulsingDot} /> Live
                </span>
              ) : null}
            </div>
            <p className={styles.pageSubtitle}>{TAB_SUBTITLES[tab]}</p>
          </div>
          <div className={styles.topBarActions}>
            <Tooltip content={currentPlanTooltip}>
              <Badge
                size="medium"
                skin={currentPlan.id === 'basic' ? 'neutralStandard' : 'premium'}
                uppercase={false}
              >
                {currentPlan.name} plan
              </Badge>
            </Tooltip>
            <Button
              priority="secondary"
              onClick={() => {
                void refreshDashboard();
              }}
              disabled={isLoading || isSaving}
              prefixIcon={<Icons.Refresh />}
            >
              Refresh
            </Button>
            <Button prefixIcon={<Icons.Add />} onClick={createAuctionAction}>
              New Auction
            </Button>
          </div>
        </header>

        <div className={styles.content}>
      {tab === 'overview' ? (
        <Layout gap="24px">
          <Cell span={8}>
            <Card>
              <Card.Header
                title="Welcome to Auction Manager for Stores"
                subtitle="Run timed auctions on your Wix Stores products."
              />
              <Card.Content>
                <div className={styles.guideHero}>
                  <div className={styles.guideHeroCopy}>
                    <Text secondary>
                      Turn store products into timed auctions, track bidders, and pick winners.
                      Work through the checklist below to get your store auction-ready.
                    </Text>
                  </div>
                  <div className={styles.guideSummaryGrid}>
                    <div className={styles.guideSummaryCard}>
                      <Text size="tiny" weight="bold" secondary>
                        Total Auctions
                      </Text>
                      <Heading size="medium">{payload.summary.totalAuctions}</Heading>
                    </div>
                    <div className={styles.guideSummaryCard}>
                      <Text size="tiny" weight="bold" secondary>
                        Active Auctions
                      </Text>
                      <Heading size="medium">{payload.summary.activeAuctions}</Heading>
                    </div>
                    <div className={styles.guideSummaryCard}>
                      <Text size="tiny" weight="bold" secondary>
                        Total Bids
                      </Text>
                      <Heading size="medium">{payload.summary.totalBids}</Heading>
                    </div>
                    <div className={styles.guideSummaryCard}>
                      <Text size="tiny" weight="bold" secondary>
                        Captured Leads
                      </Text>
                      <Heading size="medium">{payload.summary.totalLeads}</Heading>
                    </div>
                  </div>
                </div>
              </Card.Content>
            </Card>
          </Cell>

          <Cell span={4}>
            <Card>
              <Card.Header
                title="Quick Actions"
                subtitle="Jump straight into the most common jobs."
              />
              <Card.Content>
                <div className={styles.guideActionStack}>
                  <Button prefixIcon={<Icons.Add />} onClick={createAuctionAction}>
                    Create New Auction
                  </Button>
                  <Button priority="secondary" prefixIcon={<Icons.Collections />} onClick={() => setTab('auctions')}>
                    Manage Auctions
                  </Button>
                  <PlanLock allowed={currentPlan.features.leads} feature="leads">
                    <Button
                      priority="secondary"
                      prefixIcon={<Icons.Users />}
                      disabled={!currentPlan.features.leads}
                      onClick={() => setTab('leads')}
                    >
                      Review Leads
                    </Button>
                  </PlanLock>
                  <Button priority="secondary" prefixIcon={<Icons.Settings />} onClick={() => setTab('settings')}>
                    Open Settings
                  </Button>
                </div>
              </Card.Content>
            </Card>
          </Cell>

          <Cell span={12}>
            <Card>
              <Card.Header
                title="Setup Checklist"
                subtitle={
                  checklistDoneCount === setupChecklist.length
                    ? "You're all set. Your store is ready to run auctions."
                    : `${checklistDoneCount} of ${setupChecklist.length} steps complete`
                }
              />
              <Card.Content>
                <div className={styles.checklistTrack} aria-hidden="true">
                  <div
                    className={styles.checklistFill}
                    style={{ width: `${(checklistDoneCount / setupChecklist.length) * 100}%` }}
                  />
                </div>
                <ol className={styles.checklist}>
                  {setupChecklist.map((item) => (
                    <li
                      key={item.id}
                      className={`${styles.checklistItem}${item.done ? ` ${styles.checklistItemDone}` : ''}`}
                    >
                      <span className={styles.checklistMark} aria-hidden="true">
                        {item.done ? <Icons.Check /> : null}
                      </span>
                      <div className={styles.checklistBody}>
                        <Text weight="bold">
                          {item.title}
                          <span className={styles.visuallyHidden}>
                            {item.done ? ' (done)' : ' (to do)'}
                          </span>
                        </Text>
                        <Text size="small" secondary>{item.body}</Text>
                        {item.id === 'widget' && pluginPlacementResult?.error ? (
                          <Text size="small" secondary>
                            Unable to load plugin placement status: {pluginPlacementResult.error}
                          </Text>
                        ) : null}
                        {item.id === 'widget' && !item.done && unplacedPluginRows.length > 0 ? (
                          <div className={styles.checklistActions}>
                            {unplacedPluginRows.map((row) => (
                              <Button
                                key={row.pluginId}
                                size="small"
                                priority="secondary"
                                disabled={placingPluginId !== null || isPluginStatusLoading}
                                onClick={() => void handlePlaceSitePlugin(row)}
                              >
                                {placingPluginId === row.pluginId ? 'Placing…' : `Place ${row.name}`}
                              </Button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {!item.done && item.action ? (
                        <Button size="small" onClick={item.action.onClick}>
                          {item.action.label}
                        </Button>
                      ) : null}
                      {item.id === 'widget' ? (
                        <TextButton
                          size="small"
                          disabled={isPluginStatusLoading || placingPluginId !== null}
                          onClick={() => void refreshPluginPlacementStatus()}
                        >
                          {isPluginStatusLoading ? 'Checking…' : 'Recheck'}
                        </TextButton>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </Card.Content>
            </Card>
          </Cell>
        </Layout>
      ) : null}

      {tab === 'monitor' ? (
        <Layout gap="24px">
          {/* Top Pulse KPI Cards */}
          <Cell span={12}>
            <div className={styles.monitorKpiGrid}>
              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <span className={styles.kpiLabel}>Live Auctions</span>
                  <div className={`${styles.kpiIconWrap} ${styles.kpiIconWrapLive}`}>
                    <Icons.LineChart />
                  </div>
                </div>
                <div className={styles.kpiValueRow}>
                  <span className={styles.kpiValue}>{monitorCounts.live}</span>
                  <span className={`${styles.kpiBadge} ${styles.kpiBadgeLive}`}>
                    <span className={styles.pulsingDot} /> Active Now
                  </span>
                </div>
                <span className={styles.kpiHint}>
                  Listings currently open for customer bids
                </span>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <span className={styles.kpiLabel}>Ending Soon</span>
                  <div className={`${styles.kpiIconWrap} ${styles.kpiIconWrapWarning}`}>
                    <Icons.StatusAlertSmall />
                  </div>
                </div>
                <div className={styles.kpiValueRow}>
                  <span className={styles.kpiValue}>{monitorCounts.endingSoon}</span>
                  <span
                    className={`${styles.kpiBadge} ${
                      monitorCounts.endingSoon > 0 ? styles.kpiBadgeWarning : ''
                    }`}
                  >
                    &lt; 1h Remaining
                  </span>
                </div>
                <span className={styles.kpiHint}>
                  Urgent auctions closing within the final hour
                </span>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <span className={styles.kpiLabel}>Active Bid Momentum</span>
                  <div className={`${styles.kpiIconWrap} ${styles.kpiIconWrapIndigo}`}>
                    <Icons.Collections />
                  </div>
                </div>
                <div className={styles.kpiValueRow}>
                  <span className={styles.kpiValue}>{monitorCounts.totalActiveBids}</span>
                  <span className={styles.kpiBadge}>
                    Total Active Bids
                  </span>
                </div>
                <span className={styles.kpiHint}>
                  Combined bids placed across active auctions
                </span>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <span className={styles.kpiLabel}>Captured Leads</span>
                  <div className={`${styles.kpiIconWrap} ${styles.kpiIconWrapPurple}`}>
                    <Icons.Users />
                  </div>
                </div>
                <div className={styles.kpiValueRow}>
                  <span className={styles.kpiValue}>{payload.summary.totalLeads}</span>
                  <button
                    type="button"
                    onClick={() => setTab('leads')}
                    className={styles.kpiBadge}
                    style={{ cursor: 'pointer', border: 'none' }}
                  >
                    View Leads →
                  </button>
                </div>
                <span className={styles.kpiHint}>
                  Unique bidder contacts registered
                </span>
              </div>
            </div>
          </Cell>

          {/* Interactive Toolbar: Filter Pills, Search, New Auction */}
          <Cell span={12}>
            <div className={styles.monitorToolbar}>
              <div className={styles.monitorToolbarLeft}>
                <div className={styles.filterPillsGroup}>
                  <button
                    type="button"
                    className={`${styles.filterPill} ${
                      monitorFilter === 'all' ? styles.filterPillActive : ''
                    }`}
                    onClick={() => { setMonitorFilter('all'); setMonitorPage(1); }}
                  >
                    All Active
                    <span className={styles.filterPillBadge}>{monitorCounts.all}</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterPill} ${
                      monitorFilter === 'live' ? styles.filterPillActive : ''
                    }`}
                    onClick={() => { setMonitorFilter('live'); setMonitorPage(1); }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: '#0f766e',
                        display: 'inline-block',
                      }}
                    />
                    Live Now
                    <span className={styles.filterPillBadge}>{monitorCounts.live}</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterPill} ${
                      monitorFilter === 'endingSoon' ? styles.filterPillActive : ''
                    }`}
                    onClick={() => { setMonitorFilter('endingSoon'); setMonitorPage(1); }}
                  >
                    Ending Soon
                    <span className={styles.filterPillBadge}>{monitorCounts.endingSoon}</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterPill} ${
                      monitorFilter === 'scheduled' ? styles.filterPillActive : ''
                    }`}
                    onClick={() => { setMonitorFilter('scheduled'); setMonitorPage(1); }}
                  >
                    Scheduled
                    <span className={styles.filterPillBadge}>{monitorCounts.scheduled}</span>
                  </button>
                  {monitorCounts.paused > 0 ? (
                    <button
                      type="button"
                      className={`${styles.filterPill} ${
                        monitorFilter === 'paused' ? styles.filterPillActive : ''
                      }`}
                      onClick={() => { setMonitorFilter('paused'); setMonitorPage(1); }}
                    >
                      Paused
                      <span className={styles.filterPillBadge}>{monitorCounts.paused}</span>
                    </button>
                  ) : null}
                </div>

                <div className={styles.monitorSearchBox}>
                  <Input
                    placeholder="Search active auctions..."
                    value={monitorSearch}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setMonitorSearch(e.target.value);
                      setMonitorPage(1);
                    }}
                    prefix={<Icons.Search />}
                    clearButton
                    onClear={() => {
                      setMonitorSearch('');
                      setMonitorPage(1);
                    }}
                  />
                </div>
              </div>

              <Button
                size="small"
                prefixIcon={<Icons.Add />}
                onClick={createAuctionAction}
              >
                New Auction
              </Button>
            </div>
          </Cell>

          {/* Cards Grid */}
          <Cell span={12}>
            {monitorTotal > 8 ? (
              <Box align="right" style={{ marginBottom: 12 }}>
                <Pagination
                  currentPage={monitorPage}
                  totalPages={Math.ceil(monitorTotal / 8)}
                  onChange={(event) => setMonitorPage(event.page)}
                />
              </Box>
            ) : null}
            {isMonitorSearching ? (
              <div style={EMPTY_STATE_STYLE}><Loader size="tiny" /></div>
            ) : monitorResults.length > 0 ? (
              <div className={styles.monitorGrid}>
                {monitorResults.map((auction) => {
                  const currentPrice =
                    auction.currentHighestBid ?? auction.startingPrice;
                  const reserveInfo = getReserveProgress(
                    currentPrice,
                    auction.reservePrice,
                  );
                  const imageUrl =
                    auction.imageUrls && auction.imageUrls.length > 0
                      ? auction.imageUrls[0]
                      : null;

                  return (
                    <div key={auction.id} className={styles.monitorCard}>
                      {/* Media Header */}
                      <div className={styles.monitorCardMedia}>
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={auction.title}
                            className={styles.monitorCardImage}
                            loading="lazy"
                          />
                        ) : (
                          <div className={styles.monitorCardPlaceholder}>
                            <Icons.Collections style={{ width: 36, height: 36, opacity: 0.6 }} />
                            <Text size="tiny" secondary style={{ color: '#8d909a' }}>
                              No Product Image
                            </Text>
                          </div>
                        )}
                        <div className={styles.monitorCardOverlay} />

                        {/* Floating Badges */}
                        <div className={styles.monitorFloatingBadges}>
                          {auction.status === 'live' ? (
                            <span className={`${styles.glassBadge} ${styles.glassBadgeLive}`}>
                              <span className={styles.pulsingDot} /> LIVE
                            </span>
                          ) : auction.status === 'endingSoon' ? (
                            <span className={`${styles.glassBadge} ${styles.glassBadgeEnding}`}>
                              <span
                                className={styles.pulsingDot}
                                style={{
                                  background: '#f59e0b',
                                  boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.4)',
                                }}
                              />
                              ENDING SOON
                            </span>
                          ) : auction.status === 'paused' ? (
                            <span className={`${styles.glassBadge} ${styles.glassBadgePaused}`}>
                              <Icons.PauseSmall /> PAUSED
                            </span>
                          ) : (
                            <span className={styles.glassBadge}>
                              <Icons.DateAndTimeSmall /> SCHEDULED
                            </span>
                          )}

                          <MonitorCountdownBadge auction={auction} />
                        </div>
                      </div>

                      {/* Content Body */}
                      <div className={styles.monitorCardContent}>
                        {/* Title Row */}
                        <div className={styles.monitorCardTitleRow}>
                          <h3 className={styles.monitorCardTitle} title={auction.title}>
                            {auction.title}
                          </h3>
                          <div className={styles.monitorCardSubtitle}>
                            <span>
                              Starting: {formatCurrency(auction.startingPrice, payload.currency)}
                            </span>
                          </div>
                        </div>

                        {/* Hero Bid Box */}
                        <div className={styles.heroBidBox}>
                          <div className={styles.heroBidInfo}>
                            <span className={styles.heroBidLabel}>
                              {auction.currentHighestBid ? 'Current Bid' : 'Starting Price'}
                            </span>
                            <span className={styles.heroBidAmount}>
                              {formatCurrency(currentPrice, payload.currency)}
                            </span>
                          </div>
                          <div className={styles.heroBidMeta}>
                            <div className={styles.bidCountTag}>
                              <Icons.UsersSmall />
                              <span>{auction.bidCount} {auction.bidCount === 1 ? 'bid' : 'bids'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Reserve Progress */}
                        {auction.reservePrice ? (
                          <div className={styles.reserveSection}>
                            <div className={styles.reserveTrack}>
                              <div
                                className={`${styles.reserveFill} ${
                                  reserveInfo.met ? '' : styles.reserveFillPending
                                }`}
                                style={{ width: `${reserveInfo.percent}%` }}
                              />
                            </div>
                            <div className={styles.reserveLabels}>
                              <span>
                                Reserve: {formatCurrency(auction.reservePrice, payload.currency)}
                              </span>
                              {reserveInfo.met || auction.reserveReached ? (
                                <span className={styles.reserveMetBadge}>
                                  <Icons.Check /> Reserve Met
                                </span>
                              ) : (
                                <span>
                                  {formatCurrency(reserveInfo.amountNeeded, payload.currency)} to go ({reserveInfo.percent}%)
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className={styles.reserveLabels}>
                            <span style={{ color: '#0f766e', fontWeight: 600 }}>
                              ✓ No Reserve (Highest bid wins)
                            </span>
                          </div>
                        )}

                        {/* Quick Key Details */}
                        <div className={styles.monitorQuickDetails}>
                          <div className={styles.quickDetailItem}>
                            <span className={styles.quickDetailLabel}>Next Min. Bid</span>
                            <span className={styles.quickDetailValue}>
                              {formatCurrency(auction.minimumNextBid, payload.currency)}
                            </span>
                          </div>
                          <div className={styles.quickDetailItem}>
                            <span className={styles.quickDetailLabel}>Anti-Sniping</span>
                            <span className={styles.quickDetailValue}>
                              {auction.antiSnipingEnabled
                                ? `${auction.antiSnipingWindowSeconds}s ext.`
                                : 'Disabled'}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className={styles.monitorActions}>
                          <Button
                            size="small"
                            priority="primary"
                            prefixIcon={<Icons.Collections />}
                            onClick={() => setViewingBidsAuctionId(auction.id)}
                            style={{ flex: 1 }}
                          >
                            View Bids ({auction.bidCount})
                          </Button>
                          <Button
                            size="small"
                            priority="secondary"
                            prefixIcon={<Icons.Edit />}
                            onClick={() => handleEditAuction(auction)}
                          >
                            Edit
                          </Button>
                          {['live', 'endingSoon', 'scheduled'].includes(auction.status) ? (
                            <Button
                              size="small"
                              priority="secondary"
                              prefixIcon={<Icons.Pause />}
                              onClick={() =>
                                setActionToConfirm({
                                  id: auction.id,
                                  action: 'pause',
                                  title: auction.title,
                                })
                              }
                            >
                              Pause
                            </Button>
                          ) : null}
                          {auction.status === 'paused' ? (
                            <Button
                              size="small"
                              priority="secondary"
                              prefixIcon={<Icons.Play />}
                              onClick={() =>
                                setActionToConfirm({
                                  id: auction.id,
                                  action: 'resume',
                                  title: auction.title,
                                })
                              }
                            >
                              Resume
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Card>
                <Card.Content>
                  <div
                    style={{
                      ...EMPTY_STATE_STYLE,
                      padding: '48px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: '#f1efe8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                        color: '#5e6068',
                      }}
                    >
                      <Icons.LineChart style={{ width: 28, height: 28 }} />
                    </div>
                    <Heading size="small">
                      {monitorSearch || monitorFilter !== 'all'
                        ? 'No matching active auctions'
                        : 'No active auctions running'}
                    </Heading>
                    <Text
                      secondary
                      style={{
                        display: 'block',
                        maxWidth: 440,
                        margin: '8px 0 20px',
                        textAlign: 'center',
                        lineHeight: 1.5,
                      }}
                    >
                      {monitorSearch || monitorFilter !== 'all'
                        ? 'Try adjusting your search query or switching your status filter to see more listings.'
                        : 'Ready to launch an auction? Connect any product from your store and schedule its live bidding period.'}
                    </Text>
                    <div>
                      {monitorSearch || monitorFilter !== 'all' ? (
                        <Button
                          size="small"
                          priority="secondary"
                          onClick={() => {
                            setMonitorSearch('');
                            setMonitorFilter('all');
                            setMonitorPage(1);
                          }}
                        >
                          Clear Filters
                        </Button>
                      ) : (
                        <Button size="small" prefixIcon={<Icons.Add />} onClick={createAuctionAction}>
                          Create Your First Auction
                        </Button>
                      )}
                    </div>
                  </div>
                </Card.Content>
              </Card>
            )}
          </Cell>

          {/* Real-time Insights Lower Section */}
          <Cell span={7}>
            <Card>
              <Card.Header
                title="Live Bidding Stream"
                subtitle="Recent bids placed across active auctions."
                suffix={
                  <Tooltip content="Live stream of recent incoming bids from active auctions.">
                    <Box padding="4px">
                      <Icons.InfoCircleSmall />
                    </Box>
                  </Tooltip>
                }
              />
              <Card.Content>
                {recentLiveBids.length > 0 ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {recentLiveBids.map((item) => (
                      <div key={item.id} className={styles.bidStreamRow}>
                        <div className={styles.bidStreamLeft}>
                          <div className={styles.bidStreamAvatar}>
                            {item.bidderName.charAt(0).toUpperCase()}
                          </div>
                          <div className={styles.bidStreamInfo}>
                            <span className={styles.bidStreamBidder}>
                              {item.bidderName}
                            </span>
                            <span className={styles.bidStreamAuction} title={item.auctionTitle}>
                              on {item.auctionTitle}
                            </span>
                          </div>
                        </div>
                        <div className={styles.bidStreamRight}>
                          <span className={styles.bidStreamAmount}>
                            {formatCurrency(item.amount, payload.currency)}
                          </span>
                          <span className={styles.bidStreamTime}>
                            {formatDateTime(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                    <Text secondary>
                      No bids received yet on active auctions. Live bids will appear here in real-time.
                    </Text>
                  </div>
                )}
              </Card.Content>
            </Card>
          </Cell>

          <Cell span={5}>
            <Card>
              <Card.Header
                title="Recent Notifications"
                subtitle="Dashboard-safe event feed for bids and outreach."
              />
              <Card.Content>
                <div style={{ display: 'grid', gap: 10 }}>
                  {payload.notifications.length > 0 ? (
                    payload.notifications.slice(0, 5).map((notification) => (
                      <div
                        key={notification.id}
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          background: '#faf9f6',
                          border: '1px solid #f1efe8',
                          display: 'grid',
                          gap: 4,
                        }}
                      >
                        <Text weight="bold">{stripVariantIdFromMessage(notification.message)}</Text>
                        <Text size="small" secondary>
                          {notification.channel} • {formatDateTime(notification.createdAt)}
                        </Text>
                      </div>
                    ))
                  ) : (
                    <Text secondary>
                      No notifications yet. Activity will appear here after your first
                      auction goes live.
                    </Text>
                  )}
                </div>
              </Card.Content>
            </Card>
          </Cell>
        </Layout>
      ) : null}

      {tab === 'auctions' ? (
        <Layout gap="24px">
          <Cell span={12}>
            <Card>
              <Card.Header
                title="All Auctions"
                subtitle="View and manage your auction history."
                suffix={
                  <Box gap="SP2" align="center">
                    <Tooltip content="Full management of your auction lifecycle, statuses, and performance.">
                      <Box padding="4px">
                        <Icons.InfoCircleSmall />
                      </Box>
                    </Tooltip>
                    <Pagination
                      currentPage={currentPage}
                      totalPages={Math.ceil(auctionTotal / auctionsPerPage) || 1}
                      onChange={(e) => setCurrentPage(e.page)}
                    />
                  </Box>
                }
              />
              <Card.Content>
                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={FILTER_BAR_STYLE}>
                    <div style={FILTER_SEARCH_ITEM_STYLE}>
                      <FormField label="Search Auctions">
                        <Input
                          value={auctionSearch}
                          onChange={(event: ChangeEvent<HTMLInputElement>) => {
                            setAuctionSearch(event.target.value);
                            setCurrentPage(1);
                          }}
                          placeholder="Title, ID, description, or amount"
                          prefix={<Icons.Search />}
                          clearButton
                          onClear={() => {
                            setAuctionSearch('');
                            setCurrentPage(1);
                          }}
                        />
                      </FormField>
                    </div>
                    <div style={FILTER_ITEM_STYLE}>
                      <FormField label="Status">
                        <Select
                          value={auctionStatusFilter}
                          onChange={(event) => {
                            setAuctionStatusFilter(event.target.value as 'all' | AuctionStatus);
                            setCurrentPage(1);
                          }}
                          wrapperStyle={{ minWidth: 160 }}
                        >
                          <option value="all">All Statuses</option>
                          <option value="draft">Draft</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="live">Live</option>
                          <option value="endingSoon">Ending Soon</option>
                          <option value="paused">Paused</option>
                          <option value="closed">Closed</option>
                          <option value="sold">Sold</option>
                          <option value="reserveNotMet">Reserve Not Met</option>
                        </Select>
                      </FormField>
                    </div>
                    <div style={FILTER_ITEM_STYLE}>
                      <FormField label="Lifecycle">
                        <Select
                          value={auctionLifecycleFilter}
                          onChange={(event) => {
                            setAuctionLifecycleFilter(event.target.value as 'all' | AuctionLifecycle);
                            setCurrentPage(1);
                          }}
                          wrapperStyle={{ minWidth: 160 }}
                        >
                          <option value="all">All Lifecycles</option>
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                          <option value="paused">Paused</option>
                          <option value="closed">Closed</option>
                          <option value="sold">Sold</option>
                        </Select>
                      </FormField>
                    </div>
                  </div>

                  {isAuctionSearching ? (
                    <div style={EMPTY_STATE_STYLE}>
                      <Loader size="tiny" />
                    </div>
                  ) : filteredAuctions.length > 0 ? (
                    <>
                      <Box
                        align="space-between"
                        verticalAlign="middle"
                        gap="12px"
                        style={{ width: '100%', flexWrap: 'wrap', marginBottom: '16px' }}
                      >
                        <Box verticalAlign="middle" gap="16px">
                          <Checkbox
                            checked={areAllVisibleAuctionsSelected}
                            onChange={() => toggleSelectAllVisibleAuctions()}
                          >
                            Select all visible auctions
                          </Checkbox>
                          {selectedAuctionIds.length > 0 && (
                            <Text size="small" secondary>
                              {selectedAuctionIds.length} selected
                            </Text>
                          )}
                          {areAllVisibleAuctionsSelected &&
                            auctionTotal > filteredAuctions.length &&
                            selectedAuctionIds.length < auctionTotal && (
                              <Text size="small" secondary>
                                All {filteredAuctions.length} auctions on this page are selected.{' '}
                                <TextButton
                                  size="small"
                                  disabled={isSelectingAllMatching}
                                  onClick={() => void handleSelectAllMatchingAuctions()}
                                >
                                  {isSelectingAllMatching
                                    ? 'Selecting...'
                                    : `Select all ${auctionTotal} auctions`}
                                </TextButton>
                              </Text>
                            )}
                        </Box>
                        {selectedAuctionIds.length > 0 && (
                          <Box verticalAlign="middle" gap="8px">
                            <Button
                              size="small"
                              skin="standard"
                              priority="secondary"
                              onClick={() => setSelectedAuctionIds([])}
                            >
                              Clear Selection
                            </Button>
                            <Button
                              size="small"
                              skin="destructive"
                              prefixIcon={<Icons.Delete />}
                              onClick={() => setIsBulkDeleteModalOpen(true)}
                            >
                              Delete Selected ({selectedAuctionIds.length})
                            </Button>
                          </Box>
                        )}
                      </Box>
                      <Table
                        data={filteredAuctions}
                        columns={[
                          {
                            title: (
                              <Checkbox
                                checked={areAllVisibleAuctionsSelected}
                                onChange={() => toggleSelectAllVisibleAuctions()}
                              />
                            ),
                            width: '40px',
                            render: (row) => (
                              <Checkbox
                                checked={selectedAuctionIds.includes(row.id)}
                                onChange={() => toggleAuctionSelection(row.id)}
                              />
                            ),
                          },
                          {
                            title: 'Title',
                            render: (row) => <Text weight="bold">{row.title}</Text>,
                          },
                          {
                            title: 'Product',
                            render: (row) =>
                              row.linkedProduct ? (
                                <Box gap="8px" verticalAlign="middle">
                                  {row.linkedProduct.imageUrl ? (
                                    <img
                                      src={row.linkedProduct.imageUrl}
                                      alt=""
                                      style={{
                                        width: 32,
                                        height: 32,
                                        objectFit: 'cover',
                                        borderRadius: 6,
                                        flexShrink: 0,
                                      }}
                                    />
                                  ) : null}
                                  <Text size="small">{row.linkedProduct.name}</Text>
                                </Box>
                              ) : (
                                <Text size="small" secondary>
                                  {row.productIds.length > 0 ? 'Product unavailable' : 'No product'}
                                </Text>
                              ),
                          },
                        {
                          title: 'Status',
                          render: (row) => <AuctionStatusBadge status={row.status} />,
                        },
                        {
                          title: 'Start Price',
                          render: (row) => (
                            <Text>{formatCurrency(row.startingPrice, payload.currency)}</Text>
                          ),
                        },
                        {
                          title: 'Current Bid',
                          render: (row) => (
                            <Text weight="bold">
                              {formatCurrency(
                                row.currentHighestBid ?? row.startingPrice,
                                payload.currency,
                              )}
                            </Text>
                          ),
                        },
                        {
                          title: 'Time Remaining',
                          render: (row) => (
                            <Text size="small">
                              <CountdownTimer auction={row} />
                            </Text>
                          ),
                        },
                        {
                          title: 'Reserve',
                          render: (row) => (
                            <Text>
                              {row.reservePrice
                                ? formatCurrency(row.reservePrice, payload.currency)
                                : '-'}
                            </Text>
                          ),
                        },
                        {
                          title: 'Bids',
                          render: (row) => <Text>{row.bidCount}</Text>,
                        },
                        {
                          title: 'Reserve Status',
                          render: (row) => (
                            <Text>{row.reserveReached ? 'Met' : 'Not Met'}</Text>
                          ),
                        },
                        {
                          title: '',
                          width: '54px',
                          render: (row) => (
                            <TableActionCell
                              secondaryActions={[
                                {
                                  icon: <Icons.Edit />,
                                  text: 'Edit',
                                  onClick: () => handleEditAuction(row),
                                },
                                {
                                  icon: <Icons.Users />,
                                  text: 'View Bids',
                                  onClick: () => setViewingBidsAuctionId(row.id),
                                },
                                ...(['scheduled', 'live', 'endingSoon'].includes(row.status)
                                  ? [{
                                      icon: <Icons.Pause />,
                                      text: 'Pause',
                                      onClick: () =>
                                        setActionToConfirm({
                                          id: row.id,
                                          action: 'pause',
                                          title: row.title,
                                        }),
                                    }]
                                  : []),
                                ...(row.status === 'paused'
                                  ? [{
                                      icon: <Icons.Play />,
                                      text: 'Resume',
                                      onClick: () =>
                                        setActionToConfirm({
                                          id: row.id,
                                          action: 'resume',
                                          title: row.title,
                                        }),
                                    }]
                                  : []),
                                ...(['live', 'scheduled', 'endingSoon'].includes(row.status)
                                  ? [{
                                      icon: <Icons.Block />,
                                      text: 'End Manually',
                                      onClick: () =>
                                        runAuctionAction(row.id, 'close').then(() =>
                                          refreshDashboard(),
                                        ),
                                    }]
                                  : []),
                                ...(row.status === 'reserveNotMet'
                                  ? [{
                                      icon: <Icons.Play />,
                                      text: 'Restart',
                                      onClick: () =>
                                        setActionToConfirm({
                                          id: row.id,
                                          action: 'restart',
                                          title: row.title,
                                        }),
                                    }]
                                  : []),
                                {
                                  icon: <Icons.Delete />,
                                  text: 'Delete',
                                  onClick: () => setAuctionToDelete(row),
                                },
                              ]}
                            />
                          ),
                        },
                      ]}
                    >
                      <Table.Content />
                    </Table>
                    </>
                  ) : (
                    <div
                      style={{
                        ...EMPTY_STATE_STYLE,
                        padding: '48px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: '50%',
                          background: '#f1efe8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 16,
                          color: '#5e6068',
                        }}
                      >
                        <Icons.Collections style={{ width: 28, height: 28 }} />
                      </div>
                      <Heading size="small">
                        {debouncedAuctionSearch || auctionStatusFilter !== 'all' || auctionLifecycleFilter !== 'all'
                          ? 'No matching auctions'
                          : 'No auctions created yet'}
                      </Heading>
                      <Text
                        secondary
                        style={{
                          display: 'block',
                          maxWidth: 440,
                          margin: '8px 0 20px',
                          textAlign: 'center',
                          lineHeight: 1.5,
                        }}
                      >
                        {debouncedAuctionSearch || auctionStatusFilter !== 'all' || auctionLifecycleFilter !== 'all'
                          ? 'Try adjusting your search query or filters to find the auction you are looking for.'
                          : 'Create your first auction to start running live, scheduled, or reserve bidding for your store products.'}
                      </Text>
                      <div>
                        {debouncedAuctionSearch || auctionStatusFilter !== 'all' || auctionLifecycleFilter !== 'all' ? (
                          <Button
                            size="small"
                            priority="secondary"
                            onClick={() => {
                              setAuctionSearch('');
                              setAuctionStatusFilter('all');
                              setAuctionLifecycleFilter('all');
                              setCurrentPage(1);
                            }}
                          >
                            Clear Filters
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            prefixIcon={<Icons.Add />}
                            onClick={createAuctionAction}
                          >
                            Create Your First Auction
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card.Content>
            </Card>
          </Cell>


        </Layout>
      ) : null}

      {tab === 'products' ? (
        <Card>
          <Card.Header
            title="Products And Auctions"
            subtitle="See every store product and the auction currently linked to it."
            suffix={
              <Box gap="SP2" align="center">
                <Pagination
                  currentPage={productPage}
                  totalPages={Math.ceil(productTotal / productsPerPage) || 1}
                  onChange={(e) => setProductPage(e.page)}
                />
              </Box>
            }
          />
          <Card.Content>
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={FILTER_BAR_STYLE}>
                <div style={FILTER_SEARCH_ITEM_STYLE}>
                  <FormField label="Search Products">
                    <Input
                      value={productSearch}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        setProductSearch(event.target.value);
                        setProductPage(1);
                      }}
                      placeholder="Product name, ID, SKU, or auction"
                      prefix={<Icons.Search />}
                      clearButton
                      onClear={() => {
                        setProductSearch('');
                        setProductPage(1);
                      }}
                    />
                  </FormField>
                </div>
                <div style={FILTER_ITEM_STYLE}>
                  <FormField label="">
                    <Select
                      value={productAuctionFilter}
                      onChange={(event) => {
                        setProductAuctionFilter(event.target.value as ProductAuctionFilter);
                        setProductPage(1);
                      }}
                      wrapperStyle={{ minWidth: 180 }}
                    >
                      <option value="all">All Products</option>
                      <option value="linked">Linked To Auction</option>
                      <option value="unlinked">No Auction Linked</option>
                    </Select>
                  </FormField>
                </div>
              </div>

              {isProductSearching ? (
                <div style={EMPTY_STATE_STYLE}>
                  <Loader size="tiny" />
                </div>
              ) : filteredProductAuctionRows.length > 0 ? (
                <Table
                  data={filteredProductAuctionRows}
                  columns={[
                    {
                      title: 'Product',
                      render: (row) => (
                        <Text weight="bold">{row.name}</Text>
                      ),
                    },
                    {
                      title: 'SKU',
                      width: '160px',
                      render: (row) => row.sku,
                    },
                    {
                      title: 'Auction',
                      render: (row) =>
                        row.auctions.some((auction) =>
                          reservesProductForAuctionAt(auction, productAvailabilityNow),
                        ) ? (
                          <Box direction="vertical" gap="4px">
                            {row.auctions.filter((auction: AuctionView) =>
                              reservesProductForAuctionAt(auction, productAvailabilityNow),
                            ).map((auction: AuctionView) => (
                              <Box key={auction.id} gap="8px">
                                <Text weight="bold" style={{ textAlign: 'left', width: '100%' }}>
                                  {auction.title}
                                </Text>
                              </Box>
                            ))}
                          </Box>
                        ) : (
                          <Text secondary>No Auction Linked</Text>
                        ),
                    },
                    {
                      title: '',
                      width: '54px',
                      render: (row) => {
                        const linkedAuction = row.auctions.find((auction) =>
                          reservesProductForAuctionAt(auction, productAvailabilityNow),
                        ) ?? null;

                        return (
                          <TableActionCell
                            key={`product-actions-${row.id}`}
                            numOfVisibleSecondaryActions={0}
                            secondaryActions={
                              linkedAuction
                                ? [
                                    {
                                      icon: <Icons.Edit />,
                                      text: 'Edit',
                                      onClick: () => handleEditAuction(linkedAuction),
                                    },
                                  ]
                                : [
                                    {
                                      icon: <Icons.Add />,
                                      text: 'Create Auction',
                                      onClick: () =>
                                        handleCreateAuctionForProduct({
                                          id: row.id,
                                          name: row.name,
                                        }),
                                    },
                                  ]
                            }
                          />
                        );
                      },
                    },
                  ]}
                >
                  <Table.Content />
                </Table>
              ) : (
                <div style={EMPTY_STATE_STYLE}>
                  <Text secondary>
                    {debouncedProductSearch || productAuctionFilter !== 'all'
                      ? 'No products match the current search and filters.'
                      : 'No store products found yet.'}
                  </Text>
                </div>
              )}
            </div>
          </Card.Content>
        </Card>
      ) : null}

      <Modal
        isOpen={isFormOpen}
        onRequestClose={() => setIsFormOpen(false)}
        shouldCloseOnOverlayClick
      >
        <CustomModalLayout
          title={selectedAuctionId ? 'Edit Auction' : 'Auction Setup'}
          subtitle={
            selectedAuctionId
              ? 'Update the linked product, pricing, timing, and auction behavior.'
              : 'Link one store product and configure the auction from one place.'
          }
          primaryButtonText={selectedAuctionId ? 'Save auction' : 'Create auction'}
          primaryButtonOnClick={() => void handleSaveAuction()}
          primaryButtonProps={{
            disabled: isSaving || Boolean(productAuctionConflictMessage),
            prefixIcon: isSaving ? <Loader size="tiny" /> : undefined,
          }}
          secondaryButtonText="Cancel"
          secondaryButtonOnClick={() => setIsFormOpen(false)}
          onCloseButtonClick={() => setIsFormOpen(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 'calc(80vh - 120px)', overflowY: 'auto', paddingRight: 4 }}>
            <FormField
              label="Link Store Product"
              required
              infoContent="Select one product from your Wix Store to link to this auction."
            >
              <Box direction="vertical" gap="SP2">
                <MultiSelect
                  options={productPickerOptions.map((p) => ({
                    id: p._id,
                    value: p.name,
                  }))}
                  remoteSearch
                  loading={isProductPickerSearching}
                  hasMore={productPickerOptions.length < productPickerTotal}
                  loadingMore={isProductPickerLoadingMore}
                  onLoadMore={() => {
                    if (!isProductPickerLoading) setProductPickerPage((page) => page + 1);
                  }}
                  onSearchChange={(query) => {
                    setProductPickerSearch(query);
                    setProductPickerPage(1);
                  }}
                  tags={(form.productIds || []).map((id) => {
                    const product = (storeProducts || []).find(
                      (p) => p._id === id,
                    );
                    return { id, label: product?.name || id };
                  })}
                  onSelect={(option) => {
                    console.log('[Dashboard] Product selected:', option.id);
                    updateFormField('productIds', [String(option.id)]);
                  }}
                  onRemoveTag={(id) => {
                    console.log('[Dashboard] Product removed:', id);
                    updateFormField(
                      'productIds',
                      (form.productIds || []).filter((pid) => pid !== id),
                    );
                  }}
                  placeholder="Search Wix Store products..."
                  emptyStateMessage="No products found."
                />
                {productAuctionConflictMessage ? (
                  <span style={{ color: '#d93025', fontSize: 12 }}>
                    {productAuctionConflictMessage}
                  </span>
                ) : null}
                {(form.productIds || []).length > 0 ? (
                  <TextButton
                    size="small"
                    onClick={handleSyncFromProducts}
                    prefixIcon={<Icons.Check />}
                  >
                    Sync details from product
                  </TextButton>
                ) : null}
              </Box>
            </FormField>

            <FormField
              label="Auction Title"
              infoContent="Optional. Leave blank to use the product name."
            >
              <Input
                value={form.title}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateFormField('title', event.target.value)
                }
                placeholder="e.g. Vintage Collectible Bundle"
              />
            </FormField>

            <FormField
              label="Starting Price"
              required
              infoContent="The minimum amount the first bid must be."
            >
              <NumberInput
                value={form.startingPrice || undefined}
                onChange={(value) =>
                  updateFormField('startingPrice', value ?? 0)
                }
                min={1}
                hideStepper
                prefix={<Input.Affix>$</Input.Affix>}
              />
            </FormField>

            <FormField
              label="Reserve Price"
              infoContent="The minimum price required for the auction to be successful. If not met, the auction ends without a winner."
            >
              <NumberInput
                value={form.reservePrice || undefined}
                onChange={(value) =>
                  updateFormField('reservePrice', value ?? null)
                }
                min={0}
                hideStepper
                prefix={<Input.Affix>$</Input.Affix>}
              />
            </FormField>

            <FormField
              label="Start Time"
              required
              infoContent="When the auction will officially begin. Until then, it will be in 'Scheduled' status."
            >
              <Box direction="vertical" gap="SP2">
                <Input
                  type="datetime-local"
                  value={toLocalInput(form.startTime)}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateFormField('startTime', toIsoOrEmpty(event.target.value))
                  }
                />
                <Box direction="horizontal" gap="12px" verticalAlign="middle">
                  <Text size="small" secondary>
                    Published auctions stay scheduled until the start time is reached.
                  </Text>
                  <TextButton
                    size="small"
                    onClick={() => updateFormField('startTime', new Date().toISOString())}
                  >
                    Start now
                  </TextButton>
                </Box>
              </Box>
            </FormField>

            <FormField
              label="End Time"
              infoContent="When the auction will officially close for bidding. Leave empty to keep it open until you manually close it."
            >
              <Box direction="vertical" gap="SP2">
                <Input
                  type="datetime-local"
                  value={toLocalInput(form.endTime)}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateFormField('endTime', toIsoOrEmpty(event.target.value))
                  }
                />
                <Text size="small" secondary>
                  Optional. Leave empty to run until you manually end the auction.
                </Text>
              </Box>
            </FormField>

            <FormField
              label="Min Increment"
              infoContent="The minimum amount by which each new bid must exceed the current high bid."
            >
              <NumberInput
                value={form.minIncrement ?? payload.settings.defaultMinIncrement}
                onChange={(value) =>
                  updateFormField(
                    'minIncrement',
                    value ?? payload.settings.defaultMinIncrement,
                  )
                }
                min={1}
                hideStepper
                prefix={<Input.Affix>$</Input.Affix>}
              />
            </FormField>

            <FormField
              label="Status"
              infoContent="Select the current lifecycle stage for this auction."
            >
              <Select
                value={form.lifecycle}
                onChange={(event) =>
                  updateFormField(
                    'lifecycle',
                    event.target.value as AuctionInput['lifecycle'],
                  )
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
                <option value="sold">Sold</option>
              </Select>
            </FormField>

            <Box direction="vertical" gap="12px">
              <PlanLock allowed={currentPlan.features.antiSniping} feature="antiSniping">
                <Checkbox
                  checked={form.antiSnipingEnabled}
                  disabled={!currentPlan.features.antiSniping}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateFormField('antiSnipingEnabled', event.target.checked)
                  }
                  tooltipContent="Prevents last-second bidding by extending the auction when a bid is placed near the end."
                >
                  Enable Anti-Sniping (Extend End Time On Last-Minute Bids)
                </Checkbox>
              </PlanLock>
            </Box>

            <PlanLock allowed={currentPlan.features.antiSniping} feature="antiSniping">
              <FormField
                label="Anti-Sniping Window (Seconds)"
                infoContent="The timeframe (in seconds) before the auction ends where a bid will trigger an extension."
              >
                <NumberInput
                  value={form.antiSnipingWindowSeconds}
                  onChange={(value) =>
                    updateFormField(
                      'antiSnipingWindowSeconds',
                      value ?? form.antiSnipingWindowSeconds,
                    )
                  }
                  min={30}
                  hideStepper
                  disabled={!currentPlan.features.antiSniping}
                />
              </FormField>
            </PlanLock>

            <PlanLock allowed={currentPlan.features.antiSniping} feature="antiSniping">
              <FormField
                label="Extension Length (Seconds)"
                infoContent="How many seconds to add to the auction end time when a late bid is placed."
              >
                <NumberInput
                  value={form.antiSnipingExtensionSeconds}
                  onChange={(value) =>
                    updateFormField(
                      'antiSnipingExtensionSeconds',
                      value ?? form.antiSnipingExtensionSeconds,
                    )
                  }
                  min={30}
                  hideStepper
                  disabled={!currentPlan.features.antiSniping}
                />
              </FormField>
            </PlanLock>
          </div>
        </CustomModalLayout>
      </Modal>

      {tab === 'leads' ? (
        <Card>
          <Card.Header
            title="Bidder Leads"
            subtitle="This turns every losing bidder into follow-up inventory demand."
            suffix={
              <Pagination
                currentPage={leadPage}
                totalPages={Math.ceil(leadTotal / itemsPerPage) || 1}
                onChange={(event) => setLeadPage(event.page)}
              />
            }
          />
          <Card.Content>
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={FILTER_BAR_STYLE}>
                <div style={FILTER_SEARCH_ITEM_STYLE}>
                  <FormField label="Search Leads">
                    <Input
                      value={leadSearch}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        setLeadSearch(event.target.value);
                        setLeadPage(1);
                        setSelectedLeadIds([]);
                      }}
                      placeholder="Name, email, phone, auction, or bid"
                      prefix={<Icons.Search />}
                      clearButton
                      onClear={() => {
                        setLeadSearch('');
                        setLeadPage(1);
                        setSelectedLeadIds([]);
                      }}
                    />
                  </FormField>
                </div>
                <div style={FILTER_ITEM_STYLE}>
                  <FormField label="Auction">
                    <Select
                      value={leadAuctionFilter}
                      onChange={(event) => {
                        setLeadAuctionFilter(event.target.value);
                        setLeadPage(1);
                        setSelectedLeadIds([]);
                      }}
                      wrapperStyle={{ minWidth: 180 }}
                    >
                      <option value="all">All auctions</option>
                      {payload.auctions.map((auction) => (
                        <option key={auction.id} value={auction.id}>
                          {auction.title}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
              </div>

              <Box
                align="space-between"
                verticalAlign="middle"
                gap="12px"
                style={{ width: '100%', flexWrap: 'wrap' }}
              >
                <Box verticalAlign="middle" gap="16px">
                  <Checkbox
                    checked={areAllVisibleLeadsSelected}
                    onChange={() => toggleSelectAllVisibleLeads()}
                  >
                    Select all visible leads
                  </Checkbox>
                  <Text size="small" secondary>
                    {selectedLeadIds.length} selected
                  </Text>
                </Box>
                <Box verticalAlign="middle" gap="8px">
                <PlanLock allowed={currentPlan.features.leads} feature="leads">
                <Button
                  size="small"
                  disabled={!currentPlan.features.leads || selectedLeadIds.length === 0}
                  onClick={() => setIsEmailComposerOpen(true)}
                >
                  Send Email
                </Button>
                </PlanLock>
                <PlanLock allowed={currentPlan.features.leads} feature="leads">
                <Button
                  size="small"
                  priority="secondary"
                  prefixIcon={
                    isExportingLeads ? <Loader size="tiny" /> : <Icons.Download />
                  }
                  disabled={
                    !currentPlan.features.leads ||
                    isExportingLeads ||
                    leadTotal === 0
                  }
                  onClick={() => void handleExportLeads()}
                >
                  Export CSV
                </Button>
                </PlanLock>
                </Box>
              </Box>

              {isLeadSearching ? (
                <div style={EMPTY_STATE_STYLE}>
                  <Loader size="tiny" />
                </div>
              ) : filteredLeads.length > 0 ? (
                <Table
                  data={filteredLeads}
                  columns={[
                    {
                      title: '',
                      width: '52px',
                      render: ({ bid }) => (
                        <Checkbox
                          checked={selectedLeadIds.includes(bid.id)}
                          onChange={() => toggleLeadSelection(bid.id)}
                        />
                      ),
                    },
                    {
                      title: 'Bidder',
                      render: ({ bid }) => (
                        <div
                          style={CLICKABLE_TABLE_CELL_STYLE}
                          onClick={() => toggleLeadSelection(bid.id)}
                        >
                          <Box direction="vertical" gap="2px">
                            <Text weight="bold">{bid.bidderName}</Text>
                            <Text size="small" secondary>
                              {bid.bidderEmail}
                            </Text>
                          </Box>
                        </div>
                      ),
                    },
                    {
                      title: 'Phone',
                      render: ({ bid }) => (
                        <div
                          style={CLICKABLE_TABLE_CELL_STYLE}
                          onClick={() => toggleLeadSelection(bid.id)}
                        >
                          {bid.bidderPhone}
                        </div>
                      ),
                    },
                    {
                      title: 'Auction',
                      render: ({ auction, bid }) => (
                        <div
                          style={CLICKABLE_TABLE_CELL_STYLE}
                          onClick={() => toggleLeadSelection(bid.id)}
                        >
                          {auction.title}
                        </div>
                      ),
                    },
                    {
                      title: 'Bid Amount',
                      render: ({ bid }) => (
                        <div
                          style={CLICKABLE_TABLE_CELL_STYLE}
                          onClick={() => toggleLeadSelection(bid.id)}
                        >
                          {formatCurrency(bid.amount, payload.currency)}
                        </div>
                      ),
                    },
                    {
                      title: 'Date',
                      render: ({ bid }) => (
                        <div
                          style={CLICKABLE_TABLE_CELL_STYLE}
                          onClick={() => toggleLeadSelection(bid.id)}
                        >
                          {formatDateTime(bid.createdAt)}
                        </div>
                      ),
                    },
                    {
                      title: 'Contact',
                      width: '120px',
                      render: ({ auction, bid }) => {
                        const whatsappHref = createWhatsappHref(
                          bid.bidderPhone,
                          auction.title,
                          bid,
                        );

                        if (!whatsappHref) {
                          return '-';
                        }

                        return (
                          <PlanLock allowed={currentPlan.features.whatsapp} feature="whatsapp">
                            {currentPlan.features.whatsapp ? (
                              <a href={whatsappHref} target="_blank" rel="noreferrer">
                                <TextButton size="tiny">WhatsApp</TextButton>
                              </a>
                            ) : (
                              <TextButton size="tiny" disabled>
                                WhatsApp
                              </TextButton>
                            )}
                          </PlanLock>
                        );
                      },
                    },
                  ]}
                >
                  <Table.Content />
                </Table>
              ) : (
                <div style={EMPTY_STATE_STYLE}>
                  <Text secondary>
                    {debouncedLeadSearch || leadAuctionFilter !== 'all'
                      ? 'No leads match the current search and filters.'
                      : 'Leads will appear here after the first bids arrive.'}
                  </Text>
                </div>
              )}
            </div>
          </Card.Content>
        </Card>
      ) : null}

      {tab === 'settings' ? (
        <Card>
          <Card.Header
            title="App Settings"
            subtitle="Increment defaults, bid email automations, and contact defaults."
            suffix={
              <Tooltip content="Configure auction behavior defaults.">
                <Box padding="4px">
                  <Icons.InfoCircleSmall />
                </Box>
              </Tooltip>
            }
          />
          <Card.Content>
            {isLoadingSettings ? (
              <div style={EMPTY_STATE_STYLE}>
                <Loader size="small" />
              </div>
            ) : (
            <div style={{ display: 'grid', gap: 18 }}>
              <Text size="small">
                Current plan: <Text size="small" weight="bold">{currentPlan.name}</Text>
                {payload.installedPlan
                  ? ' · Set in the Wix App Market'
                  : null}
              </Text>
              <Layout cols={3} gap="18px">
                {PLAN_ORDER.map((tier: PlanTier) => {
                  const plan = PLANS[tier];
                  const selected = currentPlan.id === tier;
                  return (
                    <Cell key={tier}>
                      <Card>
                        <Card.Header
                          title={plan.name}
                          subtitle={formatPlanPrice(plan, payload.currency)}
                          suffix={
                            selected ? (
                              <Badge size="medium" skin="success" uppercase={false}>
                                Current
                              </Badge>
                            ) : plan.recommended ? (
                              <Badge size="medium" skin="standard">
                                Recommended
                              </Badge>
                            ) : undefined
                          }
                        />
                        <Card.Content>
                          <div style={{ display: 'grid', gap: 12 }}>
                            <Text size="small" secondary>
                              {plan.bestFor}
                            </Text>
                            {payload.installedPlan ? (
                              <Text size="tiny" secondary>
                                {selected
                                  ? 'This is the plan installed on this site.'
                                  : 'Upgrade or change plans in the Wix App Market.'}
                              </Text>
                            ) : (
                              <Button
                                size="small"
                                disabled={selected}
                                onClick={() =>
                                  setSettingsForm({
                                    ...settingsForm,
                                    planTier: tier,
                                  })
                                }
                              >
                                {selected ? 'Current plan' : 'Choose plan'}
                              </Button>
                            )}
                          </div>
                        </Card.Content>
                      </Card>
                    </Cell>
                  );
                })}
              </Layout>
              <Table
                data={PLAN_COMPARISON_ROWS}
                columns={[
                  { title: 'Feature', render: (row) => row.label },
                  { title: 'Basic', render: (row) => row.values.basic },
                  { title: 'Pro', render: (row) => row.values.pro },
                  { title: 'Business', render: (row) => row.values.business },
                ]}
              >
                <Table.Content />
              </Table>
              <Layout cols={2} gap="18px">
                <Cell>
                  <FormField label="Default Bid Increment">
                    <NumberInput
                      value={settingsForm.defaultMinIncrement}
                      onChange={(value) =>
                        setSettingsForm({
                          ...settingsForm,
                          defaultMinIncrement:
                            value ?? settingsForm.defaultMinIncrement,
                        })
                      }
                      min={1}
                      hideStepper
                      prefix={<Input.Affix>$</Input.Affix>}
                    />
                  </FormField>
                </Cell>
              </Layout>
              <Box direction="vertical" gap="12px">
                <Checkbox
                  checked={settingsForm.emailBiddingEnabled}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setSettingsForm({
                      ...settingsForm,
                      emailBiddingEnabled: event.target.checked,
                      emailWinnerPaymentLinkEnabled: event.target.checked
                        ? settingsForm.emailWinnerPaymentLinkEnabled
                        : false,
                    })
                  }
                  tooltipContent="Allow visitors to place bids using a name and email address without signing in. When off, a Wix member account is required."
                >
                  Allow bidding with email instead of a Wix member account
                </Checkbox>
                <Checkbox
                  checked={settingsForm.emailWinnerPaymentLinkEnabled}
                  disabled={!settingsForm.emailBiddingEnabled}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setSettingsForm({
                      ...settingsForm,
                      emailWinnerPaymentLinkEnabled: event.target.checked,
                    })
                  }
                  tooltipContent="When an email bidder wins, require a custom HTTPS payment URL and button label, then email the link to them."
                >
                  Email a custom payment link to email bidders selected as winners
                </Checkbox>
                <PlanLock
                  allowed={currentPlan.features.blockCartDuringLive}
                  feature="blockCartDuringLive"
                >
                <Checkbox
                  checked={settingsForm.blockCartAndCheckout}
                  disabled={!currentPlan.features.blockCartDuringLive}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setSettingsForm({
                      ...settingsForm,
                      blockCartAndCheckout: event.target.checked,
                    })
                  }
                  tooltipContent="When enabled, cart and checkout show an error on auction products so buyers must use the bidding flow. Turn this off to allow checkout for auction products."
                >
                  Block cart and checkout for auction products
                </Checkbox>
                </PlanLock>
                <PlanLock
                  allowed={currentPlan.features.blockAllCart}
                  feature="blockAllCart"
                >
                <Checkbox
                  checked={settingsForm.blockAllCartAndCheckout}
                  disabled={!currentPlan.features.blockAllCart}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setSettingsForm({
                      ...settingsForm,
                      blockAllCartAndCheckout: event.target.checked,
                    })
                  }
                  tooltipContent="When enabled, cart and checkout are blocked for every product in the store. Turn this off to allow normal checkout except where auction blocking still applies."
                >
                  Block cart and checkout for all products
                </Checkbox>
                </PlanLock>
                <PlanLock allowed={currentPlan.features.antiSniping} feature="antiSniping">
                <Checkbox
                  checked={settingsForm.antiSnipingEnabled}
                  disabled={!currentPlan.features.antiSniping}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setSettingsForm({
                      ...settingsForm,
                      antiSnipingEnabled: event.target.checked,
                    })
                  }
                >
                  Enable Anti-Sniping Defaults For New Auctions
                </Checkbox>
                </PlanLock>
                <PlanLock
                  allowed={currentPlan.features.bidConfirmationEmail}
                  feature="bidConfirmationEmail"
                >
                <Checkbox
                  checked={settingsForm.bidderConfirmationEnabled}
                  disabled={!currentPlan.features.bidConfirmationEmail}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setSettingsForm({
                      ...settingsForm,
                      bidderConfirmationEnabled: event.target.checked,
                    })
                  }
                >
                  Send Bidder Confirmation Email After A Bid Is Placed
                </Checkbox>
                </PlanLock>
                <PlanLock
                  allowed={currentPlan.features.outbidNotifications}
                  feature="outbidNotifications"
                >
                <Checkbox
                  checked={settingsForm.outbidNotificationEnabled}
                  disabled={!currentPlan.features.outbidNotifications}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setSettingsForm({
                      ...settingsForm,
                      outbidNotificationEnabled: event.target.checked,
                    })
                  }
                >
                  Send Outbid Notification Email To The Previous High Bidder
                </Checkbox>
                </PlanLock>
              </Box>

              <Box>
                <Button
                  onClick={() => void handleSaveSettings()}
                  disabled={isSaving}
                  prefixIcon={isSaving ? <Loader size="tiny" /> : undefined}
                >
                  Save settings
                </Button>
              </Box>
            </div>
            )}
          </Card.Content>
        </Card>
      ) : null}

      <Modal
        isOpen={isEmailComposerOpen}
        onRequestClose={() => setIsEmailComposerOpen(false)}
        shouldCloseOnOverlayClick
      >
        <CustomModalLayout
          title="Compose Email"
          subtitle={`Draft an email for ${selectedLeadIds.length} selected lead(s).`}
          primaryButtonText="Send Email"
          primaryButtonOnClick={() => {
            dashboard.showToast({
              message: 'Email sending is not connected yet. UI only.',
              type: 'success',
            });
          }}
          secondaryButtonText="Cancel"
          secondaryButtonOnClick={() => setIsEmailComposerOpen(false)}
          onCloseButtonClick={() => setIsEmailComposerOpen(false)}
        >
          <div
            style={{
              display: 'grid',
              gap: 18,
              padding: 24,
              maxHeight: '70vh',
              overflowY: 'auto',
            }}
          >
            <FormField label="Subject">
              <Input
                value={emailSubject}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setEmailSubject(event.target.value)
                }
                placeholder="Enter email subject"
              />
            </FormField>

            <FormField label="Message Content">
              <div
                className="email-editor-shell"
                style={{
                  border: '1px solid #d3dce6',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                <style>
                  {`
                    .email-editor-shell .quill {
                      display: flex;
                      flex-direction: column;
                      min-height: 320px;
                    }

                    .email-editor-shell .ql-toolbar.ql-snow {
                      border: 0 !important;
                      border-bottom: 1px solid #e6e4dc !important;
                      background: #faf9f6;
                      flex: 0 0 auto;
                    }

                    .email-editor-shell .ql-container.ql-snow {
                      border: 0 !important;
                      flex: 1 1 auto;
                      height: 260px !important;
                      min-height: 260px !important;
                    }

                    .email-editor-shell .ql-editor {
                      height: 260px !important;
                      min-height: 260px !important;
                      overflow-y: auto;
                      font-size: 14px;
                      line-height: 1.6;
                      white-space: pre-wrap;
                    }
                  `}
                </style>
                <ReactQuill
                  theme="snow"
                  className="email-editor"
                  value={emailBody}
                  onChange={setEmailBody}
                  modules={EMAIL_EDITOR_MODULES}
                  formats={EMAIL_EDITOR_FORMATS}
                  placeholder="Write your email message here..."
                />
              </div>
            </FormField>
          </div>
        </CustomModalLayout>
      </Modal>

      {viewingBidsAuction && (
        <Modal
          isOpen={true}
          onRequestClose={() => setViewingBidsAuctionId(null)}
          shouldCloseOnOverlayClick={true}
        >
          <CustomModalLayout
            wide
            title={`Bids For ${viewingBidsAuction.title}`}
            subtitle="Review bids, contact bidders, and choose a winner."
            primaryButtonText="Close"
            primaryButtonOnClick={() => setViewingBidsAuctionId(null)}
            content={
              <div className={styles.bidsPanel}>
                <div className={styles.bidsSummary}>
                  <div className={styles.bidsSummaryChip}>
                    <Text size="small" secondary>
                      Total Bids
                    </Text>
                    <Text size="small" weight="bold">
                      {viewingBidsAuction.bidCount}
                    </Text>
                  </div>
                  <div className={styles.bidsSummaryChip}>
                    <Text size="small" secondary>
                      Matching bids
                    </Text>
                    <Text size="small" weight="bold">
                      {bidTotal}
                    </Text>
                  </div>
                  <div className={styles.bidsSummaryChip}>
                    <Text size="small" secondary>
                      Current Bid
                    </Text>
                    <Text size="small" weight="bold">
                      {formatCurrency(
                        viewingBidsAuction.currentHighestBid ?? viewingBidsAuction.startingPrice,
                        payload.currency,
                      )}
                    </Text>
                  </div>
                  {viewingBidsAuction.winnerBidId ? (
                    <div className={styles.bidsSummaryChip}>
                      <span className={styles.winnerBadgeDot} />
                      <Text size="small" weight="bold">
                        Winner Selected
                      </Text>
                    </div>
                  ) : null}
                </div>

                <div className={styles.bidsFilters}>
                  <div className={styles.bidsFilterSearch}>
                    <FormField label="Search Bids">
                      <Input
                        value={bidsSearch}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                          setBidsSearch(event.target.value);
                          setBidPage(1);
                        }}
                        placeholder="Bidder, email, phone, amount, or bid ID"
                        prefix={<Icons.Search />}
                        clearButton
                        onClear={() => { setBidsSearch(''); setBidPage(1); }}
                      />
                    </FormField>
                  </div>
                  <div className={styles.bidsFilterSelect}>
                    <FormField label="Winner">
                      <Select
                        value={bidsWinnerFilter}
                        onChange={(event) => {
                          setBidsWinnerFilter(event.target.value as WinnerFilter);
                          setBidPage(1);
                        }}
                      >
                        <option value="all">All Bids</option>
                        <option value="winner">Selected Winner</option>
                        <option value="others">Non-Winners</option>
                      </Select>
                    </FormField>
                  </div>
                </div>

                <Pagination
                  currentPage={bidPage}
                  totalPages={Math.ceil(bidTotal / itemsPerPage) || 1}
                  onChange={(event) => setBidPage(event.page)}
                />

                {isBidsSearching ? (
                  <div className={styles.bidsEmpty}>
                    <Loader size="tiny" />
                  </div>
                ) : filteredBids.length > 0 ? (
                  <div className={styles.bidsTableWrap}>
                    <Table
                      data={filteredBids}
                      columns={[
                        {
                          title: 'Bidder',
                          render: (row) => (
                            <div className={styles.bidsBidder}>
                              <div className={styles.bidsBidderNameRow}>
                                <Text weight="bold">{row.bidderName}</Text>
                                {viewingBidsAuction.winnerBidId === row.id ? (
                                  <span className={styles.winnerBadge}>
                                    <span className={styles.winnerBadgeDot} />
                                    Winner
                                  </span>
                                ) : null}
                              </div>
                              <Text size="tiny" secondary>
                                {row.bidderEmail || 'No Email'}
                              </Text>
                            </div>
                          ),
                        },
                        {
                          title: 'Amount',
                          width: '110px',
                          render: (row) => (
                            <Text weight="bold">
                              {formatCurrency(row.amount, payload.currency)}
                            </Text>
                          ),
                        },
                        {
                          title: 'Date',
                          width: '180px',
                          render: (row) => (
                            <Text size="small" secondary>
                              {formatDateTime(row.createdAt)}
                            </Text>
                          ),
                        },
                        {
                          title: 'Contact',
                          width: '120px',
                          render: (row) => {
                            const href = createWhatsappHref(
                              row.bidderPhone,
                              viewingBidsAuction.title,
                              row,
                            );
                            if (!href) {
                              return (
                                <Text size="small" secondary>
                                  No Phone
                                </Text>
                              );
                            }

                            return (
                              <PlanLock allowed={currentPlan.features.whatsapp} feature="whatsapp">
                                {currentPlan.features.whatsapp ? (
                                  <a href={href} target="_blank" rel="noreferrer">
                                    <TextButton size="tiny">WhatsApp</TextButton>
                                  </a>
                                ) : (
                                  <TextButton size="tiny" disabled>
                                    WhatsApp
                                  </TextButton>
                                )}
                              </PlanLock>
                            );
                          },
                        },
                        {
                          title: 'Winner',
                          width: '140px',
                          render: (row) => {
                            const isWinner = viewingBidsAuction.winnerBidId === row.id;
                            const canResendPaymentEmail =
                              isWinner &&
                              payload.settings.emailBiddingEnabled &&
                              payload.settings.emailWinnerPaymentLinkEnabled &&
                              !row.bidderMemberId &&
                              Boolean(viewingBidsAuction.winnerPaymentUrl);

                            return (
                              <Button
                                size="tiny"
                                priority={isWinner ? 'secondary' : 'primary'}
                                disabled={resendingWinnerAuctionId === viewingBidsAuction.id}
                                onClick={() => {
                                  if (canResendPaymentEmail) {
                                    void handleResendWinnerPaymentEmail(viewingBidsAuction.id);
                                    return;
                                  }
                                  setPendingWinnerSelection({
                                    auctionId: viewingBidsAuction.id,
                                    auctionTitle: viewingBidsAuction.title,
                                    bid: row,
                                  });
                                  setWinnerPaymentUrl(viewingBidsAuction.winnerPaymentUrl ?? '');
                                  setWinnerPaymentButtonLabel(viewingBidsAuction.winnerPaymentButtonLabel ?? '');
                                  setWinnerPaymentFormError(null);
                                }}
                              >
                                {canResendPaymentEmail
                                  ? resendingWinnerAuctionId === viewingBidsAuction.id
                                    ? 'Sending...'
                                    : 'Resend email'
                                  : isWinner
                                    ? 'Selected'
                                    : 'Select Winner'}
                              </Button>
                            );
                          },
                        },
                        {
                          title: '',
                          width: '54px',
                          render: (row) => (
                            <TableActionCell
                              alwaysShowSecondaryActions
                              numOfVisibleSecondaryActions={1}
                              secondaryActions={[
                                {
                                  icon: <Icons.Delete />,
                                  text: 'Delete Bid',
                                  onClick: () =>
                                    setBidToDelete({
                                      auctionId: viewingBidsAuction.id,
                                      auctionTitle: viewingBidsAuction.title,
                                      bid: row,
                                      isWinner: viewingBidsAuction.winnerBidId === row.id,
                                    }),
                                },
                              ]}
                            />
                          ),
                        },
                      ]}
                    >
                      <Table.Content />
                    </Table>
                  </div>
                ) : (
                  <div className={styles.bidsEmpty}>
                    <Text secondary>
                      {viewingBidsAuction.recentBids.length > 0
                        ? 'No bids match the current search and filters.'
                        : 'No bids have been placed yet.'}
                    </Text>
                  </div>
                )}
              </div>
            }
          />
        </Modal>
      )}
      {pendingWinnerSelection ? (
        <Modal
          isOpen={true}
          onRequestClose={() => {
            if (!isConfirmingWinner) {
              setPendingWinnerSelection(null);
              setWinnerPaymentFormError(null);
            }
          }}
          shouldCloseOnOverlayClick={!isConfirmingWinner}
        >
          <CustomModalLayout
            title="Confirm Winner Selection"
            subtitle={`You're about to update the winner for ${pendingWinnerSelection.auctionTitle}.`}
            primaryButtonText={isConfirmingWinner ? 'Confirming...' : 'Confirm'}
            primaryButtonProps={{ disabled: isConfirmingWinner }}
            primaryButtonOnClick={() => {
              void handleConfirmWinnerSelection();
            }}
            secondaryButtonText="Cancel"
            secondaryButtonProps={{ disabled: isConfirmingWinner }}
            secondaryButtonOnClick={() => {
              setPendingWinnerSelection(null);
              setWinnerPaymentFormError(null);
            }}
            content={
              <Box direction="vertical" gap="SP3" padding="SP4">
                <Text>
                  Bidder: <strong>{pendingWinnerSelection.bid.bidderName}</strong>
                </Text>
                <Text>
                  Amount: <strong>{formatCurrency(pendingWinnerSelection.bid.amount, payload.currency)}</strong>
                </Text>
                {payload.settings.emailBiddingEnabled &&
                payload.settings.emailWinnerPaymentLinkEnabled &&
                !pendingWinnerSelection.bid.bidderMemberId ? (
                  <>
                    <FormField label="Payment URL" required>
                      <Input
                        type="url"
                        aria-label="Payment URL"
                        required
                        value={winnerPaymentUrl}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                          setWinnerPaymentUrl(event.target.value);
                          setWinnerPaymentFormError(null);
                        }}
                        placeholder="https://example.com/pay"
                      />
                    </FormField>
                    <FormField label="Button label" required>
                      <Input
                        aria-label="Button label"
                        required
                        maxLength={80}
                        value={winnerPaymentButtonLabel}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                          setWinnerPaymentButtonLabel(event.target.value);
                          setWinnerPaymentFormError(null);
                        }}
                        placeholder="Pay now"
                      />
                    </FormField>
                    {winnerPaymentFormError ? (
                      <span role="alert"><Text size="small">{winnerPaymentFormError}</Text></span>
                    ) : null}
                  </>
                ) : null}
                <Text size="small" secondary>
                  If anything goes wrong later, you can reopen the bids modal and select a
                  different winner.
                </Text>
              </Box>
            }
          />
        </Modal>
      ) : null}
      {auctionToDelete ? (
        <Modal
          isOpen={true}
          onRequestClose={() => {
            if (!isDeleting) {
              setAuctionToDelete(null);
            }
          }}
          shouldCloseOnOverlayClick={!isDeleting}
        >
          <CustomModalLayout
            title="Delete Auction"
            subtitle="Are you sure you want to delete this auction? This action cannot be undone."
            primaryButtonText={isDeleting ? 'Deleting...' : 'Delete'}
            primaryButtonOnClick={handleConfirmDelete}
            primaryButtonProps={{
              skin: 'destructive',
              disabled: isDeleting,
              prefixIcon: isDeleting ? <Loader size="tiny" /> : undefined,
            }}
            secondaryButtonText="Cancel"
            secondaryButtonOnClick={() => setAuctionToDelete(null)}
            onCloseButtonClick={() => setAuctionToDelete(null)}
          >
            <Box padding="24px">
              <Text>
                You are about to delete <strong>{auctionToDelete.title}</strong>.
                Any bids associated with this auction will also be removed from the dashboard views.
              </Text>
            </Box>
          </CustomModalLayout>
        </Modal>
      ) : null}

      {isBulkDeleteModalOpen ? (
        <Modal
          isOpen={true}
          onRequestClose={() => {
            if (!isBulkDeleting) {
              setIsBulkDeleteModalOpen(false);
            }
          }}
          shouldCloseOnOverlayClick={!isBulkDeleting}
        >
          <CustomModalLayout
            title={`Delete ${selectedAuctionIds.length} Auction${selectedAuctionIds.length === 1 ? '' : 's'}?`}
            subtitle="Are you sure you want to permanently delete the selected auctions? This action cannot be undone."
            primaryButtonText={
              isBulkDeleting
                ? 'Deleting...'
                : `Delete ${selectedAuctionIds.length} Auction${selectedAuctionIds.length === 1 ? '' : 's'}`
            }
            primaryButtonOnClick={handleConfirmBulkDelete}
            primaryButtonProps={{
              skin: 'destructive',
              disabled: isBulkDeleting,
              prefixIcon: isBulkDeleting ? <Loader size="tiny" /> : undefined,
            }}
            secondaryButtonText="Cancel"
            secondaryButtonOnClick={() => {
              if (!isBulkDeleting) {
                setIsBulkDeleteModalOpen(false);
              }
            }}
            onCloseButtonClick={() => {
              if (!isBulkDeleting) {
                setIsBulkDeleteModalOpen(false);
              }
            }}
          >
            <Box padding="24px">
              <Text>
                You are about to delete <strong>{selectedAuctionIds.length}</strong> auction{selectedAuctionIds.length === 1 ? '' : 's'}.
                Any bids associated with these auctions will also be permanently removed.
              </Text>
            </Box>
          </CustomModalLayout>
        </Modal>
      ) : null}

      {bidToDelete ? (
        <Modal
          isOpen={true}
          onRequestClose={() => {
            if (!isDeletingBid) {
              setBidToDelete(null);
            }
          }}
          shouldCloseOnOverlayClick={!isDeletingBid}
        >
          <CustomModalLayout
            title="Delete Bid"
            subtitle="This bid will be removed from the auction. This action cannot be undone."
            primaryButtonText={isDeletingBid ? 'Deleting...' : 'Delete Bid'}
            primaryButtonOnClick={() => {
              void handleConfirmDeleteBid();
            }}
            primaryButtonProps={{
              skin: 'destructive',
              disabled: isDeletingBid,
              prefixIcon: isDeletingBid ? <Loader size="tiny" /> : undefined,
            }}
            secondaryButtonText="Cancel"
            secondaryButtonProps={{ disabled: isDeletingBid }}
            secondaryButtonOnClick={() => setBidToDelete(null)}
            onCloseButtonClick={() => {
              if (!isDeletingBid) {
                setBidToDelete(null);
              }
            }}
          >
            <Box direction="vertical" gap="SP2" padding="24px">
              <Text>
                Bidder: <strong>{bidToDelete.bid.bidderName}</strong>
              </Text>
              <Text>
                Amount:{' '}
                <strong>
                  {formatCurrency(bidToDelete.bid.amount, payload.currency)}
                </strong>
              </Text>
              <Text size="small" secondary>
                {bidToDelete.isWinner
                  ? 'This is the selected winner. Deleting it will clear the winner and any generated checkout for this auction.'
                  : `This bid will also be removed from the leads list for ${bidToDelete.auctionTitle}.`}
              </Text>
            </Box>
          </CustomModalLayout>
        </Modal>
      ) : null}

      {actionToConfirm ? (
        <Modal
          isOpen={true}
          onRequestClose={() => {
            if (!isPerformingAction) {
              setActionToConfirm(null);
            }
          }}
          shouldCloseOnOverlayClick={!isPerformingAction}
        >
          <MessageModalLayout
            title={
              actionToConfirm.action === 'pause'
                ? 'Pause Auction'
                : actionToConfirm.action === 'resume'
                  ? 'Resume Auction'
                  : 'Restart Auction'
            }
            primaryButtonText={
              isPerformingAction
                ? actionToConfirm.action === 'pause'
                  ? 'Pausing...'
                  : actionToConfirm.action === 'resume'
                    ? 'Resuming...'
                    : 'Restarting...'
                : actionToConfirm.action === 'pause'
                  ? 'Pause Auction'
                  : actionToConfirm.action === 'resume'
                    ? 'Resume Auction'
                    : 'Restart Auction'
            }
            primaryButtonOnClick={handleConfirmAction}
            primaryButtonProps={{
              disabled: isPerformingAction,
              prefixIcon: isPerformingAction ? <Loader size="tiny" /> : undefined,
              skin: 'standard',
            }}
            secondaryButtonText="Cancel"
            secondaryButtonOnClick={() => setActionToConfirm(null)}
            onCloseButtonClick={() => setActionToConfirm(null)}
          >
            <Text>
              Are you sure you want to{' '}
              <strong>
                {actionToConfirm.action === 'pause'
                  ? 'pause'
                  : actionToConfirm.action === 'resume'
                    ? 'resume'
                    : 'restart'}
              </strong>{' '}
              the
              auction <strong>{actionToConfirm.title}</strong>?
              {actionToConfirm.action === 'pause'
                ? ' Bidding will be temporarily disabled until you resume.'
                : actionToConfirm.action === 'resume'
                  ? ' Bidding will be enabled again.'
                  : ' Previous bids and leads for this auction will be cleared before the new round begins.'}
            </Text>
          </MessageModalLayout>
        </Modal>
      ) : null}
        </div>
      </div>
    </div>
  );
};
