import React, { useCallback, useEffect, useState } from 'react';
import classNames from 'classnames';
import type { MemberWonItemsResult } from '../../../../lib/auction/types';
import { formatCurrency } from '../../../../lib/auction/utils';
import type { AuctionDataSource } from './auction-data';
import type { Translations } from './auction-products.utils';
import { interpolateTranslation } from './i18n';
import styles from './auction-products.module.css';

const WON_ITEMS_REFRESH_MS = 60 * 1000;

type WonItemsPanelProps = {
  data: AuctionDataSource;
  currency: string;
  translations: Translations;
};

/**
 * Lists the signed-in member's ended, unpaid winning items and opens one
 * checkout for all of them. Renders nothing until there is something to pay.
 */
export const WonItemsPanel: React.FC<WonItemsPanelProps> = ({ data, currency, translations }) => {
  const [result, setResult] = useState<MemberWonItemsResult | null>(null);
  const [openingCheckout, setOpeningCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setResult(await data.listMemberWonItems());
    } catch (error) {
      console.warn('[auction-products] failed to load won items', error);
    }
  }, [data]);

  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(() => void refresh(), WON_ITEMS_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [refresh]);

  const payForAll = useCallback(async () => {
    setOpeningCheckout(true);
    setCheckoutError(false);
    try {
      const { checkoutUrl } = await data.createMemberCombinedCheckout();
      window.location.assign(checkoutUrl);
    } catch (error) {
      console.error('[auction-products] failed to open combined checkout', error);
      setCheckoutError(true);
      setOpeningCheckout(false);
      void refresh();
    }
  }, [data, refresh]);

  if (!result || result.items.length === 0) {
    return null;
  }

  const count = result.items.length;

  return (
    <section
      className={classNames('auction-products-won-items', styles.wonItems)}
      aria-label={translations.wonItemsTitle}
    >
      <div className={styles.wonItemsHeader}>
        <h3 className={styles.wonItemsTitle}>{translations.wonItemsTitle}</h3>
        <p className={styles.wonItemsCopy}>{translations.wonItemsDescription}</p>
      </div>

      <ul className={styles.wonItemsList}>
        {result.items.map((item) => (
          <li key={item.auctionId} className={styles.wonItem}>
            {item.imageUrl ? (
              <img className={styles.wonItemImage} src={item.imageUrl} alt="" loading="lazy" />
            ) : null}
            <span className={styles.wonItemName}>
              {item.title}
              {item.variantLabel ? (
                <span className={styles.wonItemVariant}>{item.variantLabel}</span>
              ) : null}
            </span>
            <span className={styles.wonItemPrice}>{formatCurrency(item.amount, currency)}</span>
          </li>
        ))}
      </ul>

      <div className={styles.wonItemsTotal}>
        <span>{translations.wonItemsTotal}</span>
        <strong>{formatCurrency(result.total, currency)}</strong>
      </div>

      {result.stillLeadingCount > 0 ? (
        <p className={styles.wonItemsCopy}>
          {interpolateTranslation(translations.wonItemsStillLeading, {
            count: result.stillLeadingCount,
          })}
        </p>
      ) : null}

      {checkoutError ? (
        <p className={styles.wonItemsError} role="alert">
          {translations.payAllError}
        </p>
      ) : null}

      <button
        type="button"
        disabled={openingCheckout}
        onClick={() => void payForAll()}
        className={classNames('auction-products-pay-all-button', styles.payAllButton)}
      >
        {openingCheckout
          ? translations.payAllOpening
          : interpolateTranslation(translations.payAllButton, { count })}
      </button>
    </section>
  );
};
