import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { site } from '@wix/site-site';
import { currentMember } from '@wix/site-members';
import { navigate as storesNavigate } from '@wix/site-stores';
import type { PublicAuctionSettings } from '../../../../lib/auction/types';
import { formatCurrency, formatDateTime, getAuctionCountdownMs, hasAuctionEndTime } from '../../../../lib/auction/utils';
import {
  attachBidNotificationUnlock,
  BID_NOTIFICATION_POLL_INTERVAL_MS,
  createAuctionBidSnapshot,
  createBidNotificationAudio,
  createLocalBidSuppression,
  playBidNotification,
  shouldNotifyOnRemoteBid,
} from '../../../../site/shared/bidNotifications';
import { useDetectedLanguage } from '../../../../site/shared/language';
import { useAuctionData } from './auction-data';
import type { AuctionProductsProps } from './auction-products.props';
import {
  EMAIL_PATTERN,
  formatAuctionTiming,
  formatCountdownCompact,
  getAuctionLabel,
  getBadgeState,
  mapProduct,
  resolveProductAuction,
  type AuctionFilterValue,
  type ProductCard,
  type TimerFilterValue,
  type Translations,
} from './auction-products.utils';
import {
  ARIA_LABELS,
  BIDDER_EMAIL_LABEL,
  CLOSE_AFTER_SUCCESS_MS,
  REMOTE_BID_NOTICE_MS,
  SEARCH_DEBOUNCE_MS,
  SKELETON_CARD_COUNT,
} from './constants';
import { getWidgetTranslations, interpolateTranslation } from './i18n';
import styles from './auction-products.module.css';

type ElementProps = NonNullable<AuctionProductsProps['elementProps']>;

const AuctionProducts: React.FC<AuctionProductsProps> = (props) => {
  const {
    id,
    className,
    direction,
    headerTitle,
    headerSubtitle,
    layout,
    language,
    autoDetectLanguage,
    pageSize,
    auctionFilter: initialAuctionFilter = 'active',
    elementProps,
  } = props;

  const data = useAuctionData();
  const resolvedLanguage = useDetectedLanguage(language, autoDetectLanguage);
  const translations = useMemo(() => getWidgetTranslations(resolvedLanguage), [resolvedLanguage]);
  const isCarousel = layout === 'carousel';

  // `now` stays null until mount so server and first client render match.
  const [now, setNow] = useState<number | null>(null);
  const [siteCurrency, setSiteCurrency] = useState('');
  const [products, setProducts] = useState<Array<ProductCard>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [auctionFilter, setAuctionFilter] = useState<AuctionFilterValue>(
    initialAuctionFilter ?? 'active',
  );
  const [timerFilter, setTimerFilter] = useState<TimerFilterValue>('all');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [publicSettings, setPublicSettings] = useState<PublicAuctionSettings | null>(null);
  const [hasCurrentMember, setHasCurrentMember] = useState(false);
  const [memberCheckComplete, setMemberCheckComplete] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductCard | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidderEmail, setBidderEmail] = useState('');
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState<string | null>(null);
  const [remoteBidNotice, setRemoteBidNotice] = useState<string | null>(null);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const selectedSnapshotRef = useRef(createAuctionBidSnapshot(null));
  const localBidSuppressionRef = useRef<ReturnType<typeof createLocalBidSuppression> | null>(null);

  const emailBiddingEnabled = Boolean(publicSettings?.emailBiddingEnabled);
  const titleId = `${id}-title`;
  const dialogTitleId = `${id}-bid-title`;

  useEffect(() => {
    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (initialAuctionFilter) {
      setAuctionFilter(initialAuctionFilter);
    }
  }, [initialAuctionFilter]);

  useEffect(() => {
    let active = true;
    data
      .getPublicAuctionSettings()
      .then((settings) => active && setPublicSettings(settings))
      .catch(() => active && setPublicSettings(null));
    return () => {
      active = false;
    };
  }, [data]);

  useEffect(() => {
    if (!data.live) {
      return;
    }

    let active = true;
    site
      .currency()
      .then((currency) => active && currency && setSiteCurrency(currency))
      .catch((error: unknown) => console.warn('[auction-products] failed to read site currency', error));

    currentMember
      .getMember()
      .then((member) => active && setHasCurrentMember(Boolean(member?._id)))
      .catch(() => active && setHasCurrentMember(false))
      .finally(() => active && setMemberCheckComplete(true));

    const audio = createBidNotificationAudio();
    notificationAudioRef.current = audio;
    const detachUnlock = attachBidNotificationUnlock(audio);

    return () => {
      active = false;
      detachUnlock?.();
    };
  }, [data]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const loadProductPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      setIsLoading(true);
      if (!append) {
        setIsRefreshing(true);
      }

      try {
        const page = await data.listPublicAuctionProducts({
          search: debouncedSearchQuery,
          auctionFilter,
          timerFilter,
          cursor,
          pageSize,
        });
        const nextProducts = (page.products ?? []).map(mapProduct);
        setProducts((current) => (append ? [...current, ...nextProducts] : nextProducts));
        setNextCursor(page.nextCursor);
        setHasNextPage(page.hasNextPage);
        setLoadError(false);
      } catch (error) {
        console.error('[auction-products] failed to load products', error);
        if (!append) {
          setProducts([]);
        }
        setNextCursor(null);
        setHasNextPage(false);
        setLoadError(true);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [auctionFilter, data, debouncedSearchQuery, pageSize, timerFilter],
  );

  useEffect(() => {
    void loadProductPage(null, false);
  }, [loadProductPage]);

  const showSkeleton = isRefreshing || searchQuery !== debouncedSearchQuery;

  const updateScrollButtons = useCallback(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const scrolled = Math.abs(track.scrollLeft);
    setCanScrollPrev(scrolled > 1);
    setCanScrollNext(scrolled + track.clientWidth < track.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!isCarousel || !track) {
      return;
    }

    updateScrollButtons();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateScrollButtons);
    observer.observe(track);
    return () => observer.disconnect();
  }, [isCarousel, products, showSkeleton, updateScrollButtons]);

  const scrollByPage = useCallback((step: 1 | -1) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    // scrollLeft runs negative in RTL, so flip the step to keep "next" moving forward.
    const isRtl = getComputedStyle(track).direction === 'rtl';
    track.scrollBy({ left: step * (isRtl ? -1 : 1) * track.clientWidth * 0.9, behavior: 'smooth' });
  }, []);

  const selectedAuction = selectedProduct?.auction ?? null;
  const selectedAuctionHasBids = Boolean(selectedAuction && selectedAuction.bidCount > 0);
  const canPlaceSelectedBid =
    selectedAuction?.status === 'live' || selectedAuction?.status === 'endingSoon';
  const isBidSubmitDisabled =
    (!emailBiddingEnabled && (!memberCheckComplete || !hasCurrentMember)) ||
    submittingBid ||
    Boolean(bidSuccess) ||
    !data.live;

  const openBidDialog = useCallback((product: ProductCard) => {
    setSelectedProduct(product);
    setBidAmount(product.auction ? String(product.auction.minimumNextBid) : '');
    setBidError(null);
    setBidSuccess(null);
  }, []);

  const closeBidDialog = useCallback(() => {
    if (submittingBid) {
      return;
    }
    setSelectedProduct(null);
    setBidAmount('');
    setBidderEmail('');
    setBidError(null);
    setBidSuccess(null);
  }, [submittingBid]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || typeof dialog.showModal !== 'function') {
      return;
    }
    if (selectedProduct && !dialog.open) {
      dialog.showModal();
    } else if (!selectedProduct && dialog.open) {
      dialog.close();
    }
  }, [selectedProduct]);

  useEffect(() => {
    selectedSnapshotRef.current = createAuctionBidSnapshot(selectedAuction);
  }, [selectedAuction]);

  // While a live auction's bid form is open, poll for competing bids.
  useEffect(() => {
    if (!data.live || !selectedProduct || !canPlaceSelectedBid) {
      return;
    }

    let active = true;
    let polling = false;
    const productId = selectedProduct.id;

    const poll = async () => {
      if (polling) {
        return;
      }
      polling = true;
      try {
        const auctions = await data.listPublicAuctions();
        if (!active) {
          return;
        }
        const refreshed = resolveProductAuction(auctions, productId);
        if (
          shouldNotifyOnRemoteBid(
            selectedSnapshotRef.current,
            createAuctionBidSnapshot(refreshed),
            localBidSuppressionRef.current,
          )
        ) {
          setRemoteBidNotice('New highest bid placed.');
          void playBidNotification(notificationAudioRef.current);
        }
        setProducts((current) =>
          current.map((product) => (product.id === productId ? { ...product, auction: refreshed } : product)),
        );
        setSelectedProduct((current) =>
          current && current.id === productId ? { ...current, auction: refreshed } : current,
        );
      } catch (error) {
        console.warn('[auction-products] failed to refresh selected auction', error);
      } finally {
        polling = false;
      }
    };

    const intervalId = window.setInterval(() => void poll(), BID_NOTIFICATION_POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
    // Re-subscribe only when a different product is opened or its biddability changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, selectedProduct?.id, canPlaceSelectedBid]);

  useEffect(() => {
    if (!remoteBidNotice) {
      return;
    }
    const timer = window.setTimeout(() => setRemoteBidNotice(null), REMOTE_BID_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [remoteBidNotice]);

  const handleBidSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setBidError(null);
      setBidSuccess(null);

      if (!selectedAuction || !selectedProduct || !canPlaceSelectedBid) {
        setBidError(translations.biddingEndedMessage);
        return;
      }
      if (publicSettings?.canSubmitBid === false) {
        setBidError('Bidding is unavailable on this site.');
        return;
      }
      if (hasAuctionEndTime(selectedAuction.endTime) && Date.now() >= new Date(selectedAuction.endTime).getTime()) {
        setBidError('This auction has already ended and is no longer accepting bids.');
        return;
      }
      if (!emailBiddingEnabled && !hasCurrentMember) {
        setBidError('Please sign in to your member account to place a bid.');
        return;
      }

      const email = bidderEmail.trim();
      if (emailBiddingEnabled && !EMAIL_PATTERN.test(email)) {
        setBidError(email ? 'Enter a valid email address.' : 'Enter your email address.');
        return;
      }

      const amount = Number(bidAmount);
      if (!bidAmount.trim() || Number.isNaN(amount)) {
        setBidError('Enter a valid bid amount.');
        return;
      }
      if (amount < selectedAuction.minimumNextBid) {
        setBidError(`Your bid must be at least ${formatCurrency(selectedAuction.minimumNextBid, siteCurrency)}.`);
        return;
      }

      setSubmittingBid(true);
      try {
        const result = await data.placeBid(selectedAuction.id, emailBiddingEnabled ? 'email' : 'member', {
          bidderEmail: emailBiddingEnabled ? email : '',
          bidderName: emailBiddingEnabled ? email.split('@')[0] : undefined,
          amount,
          productId: selectedProduct.id,
        });

        localBidSuppressionRef.current = createLocalBidSuppression(result.auction);
        setProducts((current) =>
          current.map((product) =>
            product.id === selectedProduct.id ? { ...product, auction: result.auction } : product,
          ),
        );
        setSelectedProduct((current) => (current ? { ...current, auction: result.auction } : current));
        setBidAmount('');
        setBidderEmail('');
        setBidSuccess(
          interpolateTranslation(translations.bidSuccessMessage, {
            value: formatCurrency(amount, siteCurrency),
          }),
        );
        window.setTimeout(() => setSelectedProduct(null), CLOSE_AFTER_SUCCESS_MS);
      } catch (error) {
        setBidError(error instanceof Error ? error.message : 'Unable to place bid right now.');
      } finally {
        setSubmittingBid(false);
      }
    },
    [
      bidAmount,
      bidderEmail,
      canPlaceSelectedBid,
      data,
      emailBiddingEnabled,
      hasCurrentMember,
      publicSettings,
      selectedAuction,
      selectedProduct,
      siteCurrency,
      translations,
    ],
  );

  const viewProduct = useCallback(
    (productId: string) => {
      if (data.live) {
        void storesNavigate.toProduct(productId);
      }
    },
    [data],
  );

  const skeletonCount = isCarousel ? 4 : Math.min(Math.max(pageSize ?? 4, 4), 8);
  const cards: Array<ProductCard | null> = showSkeleton
    ? Array.from({ length: skeletonCount }, () => null)
    : isLoading && !isRefreshing && products.length > 0
      ? [...products, ...Array.from({ length: Math.min(4, pageSize ?? 4) }, () => null)]
      : products;

  return (
    <section
      id={id}
      dir={direction}
      aria-labelledby={titleId}
      aria-busy={showSkeleton || isLoading}
      className={classNames('auction-products', styles.root, styles.fallbackDirection, className)}
    >
      {remoteBidNotice ? (
        <div className={styles.toast} role="status" aria-live="polite">
          {remoteBidNotice}
        </div>
      ) : null}

      <header
        {...elementProps?.header}
        className={classNames('auction-products-header', styles.header, elementProps?.header?.className)}
      >
        <h2
          {...elementProps?.title}
          id={titleId}
          className={classNames('auction-products-title', styles.title, elementProps?.title?.className)}
        >
          {headerTitle || translations.browseTitle}
        </h2>
        <p
          {...elementProps?.subtitle}
          className={classNames('auction-products-subtitle', styles.subtitle, elementProps?.subtitle?.className)}
        >
          {headerSubtitle}
        </p>
        <div className={styles.controls}>
          <label className={styles.visuallyHidden} htmlFor={`${id}-search`}>
            {translations.searchLabel}
          </label>
          <input
            {...elementProps?.search}
            id={`${id}-search`}
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={translations.searchPlaceholder}
            className={classNames('auction-products-search', styles.search, elementProps?.search?.className)}
          />
          <label className={styles.visuallyHidden} htmlFor={`${id}-auction-filter`}>
            {translations.auctionStatusLabel}
          </label>
          <select
            {...elementProps?.auctionFilter}
            id={`${id}-auction-filter`}
            value={auctionFilter}
            onChange={(event) => setAuctionFilter(event.target.value as AuctionFilterValue)}
            className={classNames(
              'auction-products-auction-filter',
              styles.filter,
              elementProps?.auctionFilter?.className,
            )}
          >
            <option value="all">{translations.allProducts}</option>
            <option value="active">{translations.activeProducts}</option>
            <option value="inactive">{translations.inactiveProducts}</option>
          </select>
          <label className={styles.visuallyHidden} htmlFor={`${id}-timer-filter`}>
            {translations.timerLabel}
          </label>
          <select
            {...elementProps?.timerFilter}
            id={`${id}-timer-filter`}
            value={timerFilter}
            onChange={(event) => setTimerFilter(event.target.value as TimerFilterValue)}
            className={classNames(
              'auction-products-timer-filter',
              styles.filter,
              elementProps?.timerFilter?.className,
            )}
          >
            <option value="all">{translations.anyTime}</option>
            <option value="ending-1h">{translations.ending1Hour}</option>
            <option value="ending-24h">{translations.ending24Hours}</option>
            <option value="ending-7d">{translations.ending7Days}</option>
            <option value="scheduled">{translations.startsLater}</option>
            <option value="paused">{translations.pausedTimer}</option>
            <option value="ended">{translations.alreadyEnded}</option>
          </select>
        </div>
      </header>

      {loadError && !showSkeleton ? (
        <div className={styles.errorBanner} role="alert">
          <p className={styles.errorTitle}>{translations.loadErrorTitle}</p>
          <p className={styles.errorCopy}>{translations.loadErrorDescription}</p>
        </div>
      ) : null}

      <div className={styles.listArea} data-layout={layout}>
        <CarouselArrow
          step={-1}
          hidden={!isCarousel || !canScrollPrev}
          label={ARIA_LABELS.previousProducts}
          elementProps={elementProps}
          onClick={scrollByPage}
        />
        <div
          ref={trackRef}
          className={isCarousel ? styles.track : styles.grid}
          onScroll={isCarousel ? updateScrollButtons : undefined}
        >
          {cards.map((product, index) => (
            <AuctionCard
              key={product?.id ?? `skeleton-${index}`}
              product={product}
              index={index}
              now={now}
              currency={siteCurrency}
              translations={translations}
              elementProps={elementProps}
              onView={viewProduct}
              onBid={openBidDialog}
            />
          ))}
        </div>
        <CarouselArrow
          step={1}
          hidden={!isCarousel || !canScrollNext}
          label={ARIA_LABELS.nextProducts}
          elementProps={elementProps}
          onClick={scrollByPage}
        />
      </div>

      <div className={styles.emptyState} hidden={showSkeleton || Boolean(loadError) || products.length > 0}>
        <p
          {...elementProps?.emptyTitle}
          className={classNames('auction-products-empty-title', styles.emptyTitle, elementProps?.emptyTitle?.className)}
        >
          {translations.emptyTitle}
        </p>
        <p
          {...elementProps?.emptyDescription}
          className={classNames(
            'auction-products-empty-description',
            styles.emptyCopy,
            elementProps?.emptyDescription?.className,
          )}
        >
          {translations.emptyDescription}
        </p>
      </div>

      <div className={styles.loadMoreRow}>
        <button
          type="button"
          {...elementProps?.loadMoreButton}
          hidden={showSkeleton || !hasNextPage}
          disabled={isLoading}
          onClick={() => nextCursor && void loadProductPage(nextCursor, true)}
          className={classNames(
            'auction-products-load-more-button',
            styles.loadMoreButton,
            elementProps?.loadMoreButton?.className,
          )}
        >
          {isLoading ? translations.loading : translations.loadMore}
        </button>
      </div>

      <dialog
        {...elementProps?.bidDialog}
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        onClose={closeBidDialog}
        onCancel={(event) => {
          if (submittingBid) {
            event.preventDefault();
          }
        }}
        className={classNames('auction-products-bid-dialog', styles.bidDialog, elementProps?.bidDialog?.className)}
      >
        <div className={styles.dialogHeader}>
          <div>
            <p
              {...elementProps?.dialogProductName}
              className={classNames(
                'auction-products-dialog-product-name',
                styles.dialogEyebrow,
                elementProps?.dialogProductName?.className,
              )}
            >
              {selectedProduct?.name}
            </p>
            <h3
              {...elementProps?.dialogTitle}
              id={dialogTitleId}
              className={classNames(
                'auction-products-dialog-title',
                styles.dialogTitle,
                elementProps?.dialogTitle?.className,
              )}
            >
              {canPlaceSelectedBid
                ? selectedAuctionHasBids
                  ? translations.placeBidTitle
                  : translations.placeFirstBidTitle
                : selectedAuction
                  ? translations.biddingUnavailableTitle
                  : translations.auctionUnavailableTitle}
            </h3>
          </div>
          <button
            type="button"
            {...elementProps?.closeButton}
            className={classNames('auction-products-close-button', styles.closeButton, elementProps?.closeButton?.className)}
            onClick={closeBidDialog}
            aria-label={ARIA_LABELS.closeBidDialog}
            disabled={submittingBid}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {selectedAuction && !canPlaceSelectedBid ? (
          <BidUnavailable auction={selectedAuction} now={now} translations={translations} />
        ) : !selectedAuction && selectedProduct ? (
          <p className={styles.dialogHelper}>{translations.productNotLinkedMessage}</p>
        ) : (
          <form className={styles.bidForm} onSubmit={handleBidSubmit} noValidate>
            {emailBiddingEnabled ? (
              <>
                <label
                  {...elementProps?.fieldLabel}
                  className={classNames('auction-products-field-label', styles.fieldLabel, elementProps?.fieldLabel?.className)}
                  htmlFor={`${id}-bidder-email`}
                >
                  {BIDDER_EMAIL_LABEL}
                </label>
                <input
                  {...elementProps?.dialogInput}
                  id={`${id}-bidder-email`}
                  type="email"
                  autoComplete="email"
                  required
                  value={bidderEmail}
                  onChange={(event) => setBidderEmail(event.target.value)}
                  className={classNames(
                    'auction-products-dialog-input',
                    styles.dialogInput,
                    elementProps?.dialogInput?.className,
                  )}
                />
              </>
            ) : null}
            <label
              {...elementProps?.fieldLabel}
              className={classNames('auction-products-field-label', styles.fieldLabel, elementProps?.fieldLabel?.className)}
              htmlFor={`${id}-bid-amount`}
            >
              {translations.bidAmountLabel}
            </label>
            <input
              {...elementProps?.dialogInput}
              id={`${id}-bid-amount`}
              type="number"
              min={selectedAuction?.minimumNextBid ?? 0}
              step="1"
              inputMode="decimal"
              value={bidAmount}
              onChange={(event) => {
                setBidAmount(event.target.value);
                setBidError(null);
                setBidSuccess(null);
              }}
              onWheel={(event) => event.currentTarget.blur()}
              placeholder={selectedAuction ? String(selectedAuction.minimumNextBid) : undefined}
              aria-describedby={`${id}-bid-helper`}
              className={classNames(
                'auction-products-dialog-input',
                styles.dialogInput,
                elementProps?.dialogInput?.className,
              )}
            />
            <p
              {...elementProps?.helperText}
              id={`${id}-bid-helper`}
              className={classNames('auction-products-helper-text', styles.dialogHelper, elementProps?.helperText?.className)}
            >
              {selectedAuction
                ? `${selectedAuctionHasBids ? translations.minimumNextBidLabel : translations.startingBidLabel}: ${formatCurrency(
                    selectedAuctionHasBids ? selectedAuction.minimumNextBid : selectedAuction.startingPrice,
                    siteCurrency,
                  )}`
                : null}
            </p>
            {!emailBiddingEnabled && data.live && !memberCheckComplete ? (
              <p className={styles.dialogHelper}>{translations.checkingMemberSession}</p>
            ) : null}
            <div aria-live="assertive">
              {bidError ? <p className={styles.bidError}>{bidError}</p> : null}
              {bidSuccess ? <p className={styles.bidSuccess}>{bidSuccess}</p> : null}
            </div>
            <button
              type="submit"
              {...elementProps?.submitButton}
              disabled={isBidSubmitDisabled}
              className={classNames(
                'auction-products-submit-button',
                styles.submitButton,
                elementProps?.submitButton?.className,
              )}
            >
              {submittingBid ? <span className={styles.spinner} aria-hidden="true" /> : null}
              <span>{translations.submitBidButton}</span>
            </button>
          </form>
        )}
      </dialog>
    </section>
  );
};

type AuctionCardProps = {
  /** Null renders a loading placeholder with the same parts, so the editor can always select them. */
  product: ProductCard | null;
  index: number;
  now: number | null;
  currency: string;
  translations: Translations;
  elementProps?: ElementProps;
  onView: (productId: string) => void;
  onBid: (product: ProductCard) => void;
};

const AuctionCard: React.FC<AuctionCardProps> = (props) => {
  const { product, index, now, currency, translations, elementProps, onView, onBid } = props;
  const auction = product?.auction ?? null;
  const isPlaceholder = product === null;
  const badgeState = getBadgeState(auction);
  const openProduct = () => product && onView(product.id);

  return (
    <article
      {...elementProps?.card}
      aria-hidden={isPlaceholder || undefined}
      onClick={isPlaceholder ? undefined : openProduct}
      className={classNames(
        'auction-products-card',
        styles.card,
        isPlaceholder && styles.placeholder,
        elementProps?.card?.className,
      )}
    >
      <div className={styles.imageFrame}>
        {product ? (
          <img className={styles.image} src={product.image} alt={product.name || ARIA_LABELS.productImage(index)} />
        ) : (
          <div className={styles.skeletonShimmer} aria-hidden="true" />
        )}
        <span
          {...elementProps?.statusBadge}
          className={classNames(
            'auction-products-status-badge',
            `auction-products-status-badge--${badgeState}`,
            styles.statusBadge,
            isPlaceholder && styles.skeletonBadge,
            elementProps?.statusBadge?.className,
          )}
        >
          {auction ? getAuctionLabel(auction, translations) : isPlaceholder ? '' : translations.noActiveAuction}
        </span>
      </div>
      <div className={styles.cardBody}>
        <h3
          {...elementProps?.productName}
          className={classNames(
            'auction-products-product-name',
            styles.productName,
            isPlaceholder && styles.skeletonTitle,
            elementProps?.productName?.className,
          )}
        >
          {isPlaceholder ? (
            <>
              <span className={styles.skeletonLine} style={{ width: '85%' }} aria-hidden="true" />
              <span className={styles.skeletonLine} style={{ width: '55%' }} aria-hidden="true" />
            </>
          ) : (
            <span
              role="link"
              tabIndex={0}
              className={styles.productLink}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  openProduct();
                }
              }}
            >
              {product?.name}
            </span>
          )}
        </h3>
        <div className={styles.metaRow}>
          <span
            {...elementProps?.metaLabel}
            className={classNames(
              'auction-products-meta-label',
              styles.metaLabel,
              isPlaceholder && styles.skeletonMetaLabel,
              elementProps?.metaLabel?.className,
            )}
          >
            {isPlaceholder ? (
              <span className={styles.skeletonLine} style={{ width: '64px' }} aria-hidden="true" />
            ) : auction ? (
              auction.currentHighestBid !== null ? translations.currentBid : translations.startsAt
            ) : (
              ''
            )}
          </span>
          <span
            {...elementProps?.metaValue}
            className={classNames(
              'auction-products-meta-value',
              styles.metaValue,
              isPlaceholder && styles.skeletonMetaValue,
              elementProps?.metaValue?.className,
            )}
          >
            {isPlaceholder ? (
              <span className={styles.skeletonLine} style={{ width: '74px' }} aria-hidden="true" />
            ) : auction ? (
              formatCurrency(auction.currentHighestBid ?? auction.startingPrice, currency)
            ) : (
              ''
            )}
          </span>
        </div>
        <p
          {...elementProps?.timing}
          className={classNames(
            'auction-products-timing',
            styles.timing,
            isPlaceholder && styles.skeletonTiming,
            elementProps?.timing?.className,
          )}
        >
          {isPlaceholder ? (
            <span className={styles.skeletonLine} style={{ width: '110px' }} aria-hidden="true" />
          ) : auction ? (
            formatAuctionTiming(auction, now, translations)
          ) : (
            ''
          )}
        </p>
        <div className={styles.cardActions}>
          <button
            type="button"
            {...elementProps?.bidButton}
            disabled={isPlaceholder}
            onClick={(event) => {
              event.stopPropagation();
              if (product) {
                onBid(product);
              }
            }}
            aria-label={ARIA_LABELS.placeBidOn(product?.name ?? '')}
            className={classNames(
              'auction-products-bid-button',
              styles.bidButton,
              isPlaceholder && styles.skeletonButton,
              elementProps?.bidButton?.className,
            )}
          >
            {isPlaceholder ? (
              <span className={styles.skeletonLine} style={{ width: '75px', height: '14px', margin: '0 auto' }} aria-hidden="true" />
            ) : null}
            <span hidden={isPlaceholder}>{translations.placeBidButton}</span>
          </button>
        </div>
      </div>
    </article>
  );
};

type CarouselArrowProps = {
  step: 1 | -1;
  hidden: boolean;
  label: string;
  elementProps?: ElementProps;
  onClick: (step: 1 | -1) => void;
};

const CarouselArrow: React.FC<CarouselArrowProps> = (props) => {
  const { step, hidden, label, elementProps, onClick } = props;

  return (
    <button
      type="button"
      {...elementProps?.carouselArrow}
      hidden={hidden}
      aria-label={label}
      onClick={() => onClick(step)}
      data-step={step}
      className={classNames(
        'auction-products-carousel-arrow',
        styles.carouselArrow,
        step === 1 ? styles.arrowNext : styles.arrowPrev,
        elementProps?.carouselArrow?.className,
      )}
    >
      <span className={styles.arrowGlyph} aria-hidden="true">
        ‹
      </span>
    </button>
  );
};

type BidUnavailableProps = {
  auction: NonNullable<ProductCard['auction']>;
  now: number | null;
  translations: Translations;
};

const BidUnavailable: React.FC<BidUnavailableProps> = (props) => {
  const { auction, now, translations } = props;
  const isPaused = auction.status === 'paused';

  return (
    <div className={styles.bidUnavailable}>
      <p className={styles.dialogHelper}>
        {isPaused
          ? interpolateTranslation(translations.biddingPausedMessage, {
              value: getAuctionLabel(auction, translations),
            })
          : translations.biddingEndedMessage}
      </p>
      <p className={styles.dialogHelper}>
        {isPaused
          ? now === null
            ? ''
            : interpolateTranslation(translations.timeLeftOnResume, {
                value: formatCountdownCompact(getAuctionCountdownMs(auction, now)),
              })
          : interpolateTranslation(translations.endedAtMessage, { value: formatDateTime(auction.endTime) })}
      </p>
    </div>
  );
};

export default AuctionProducts;
