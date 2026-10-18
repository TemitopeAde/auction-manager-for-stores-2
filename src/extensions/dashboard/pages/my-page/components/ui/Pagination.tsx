import React, { type FC } from 'react';
import styles from './Pagination.module.css';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onChange: (event: { page: number }) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const Pagination: FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onChange,
  className,
  style,
}) => {
  const safeTotal = Math.max(1, totalPages);
  const safeCurrent = Math.min(Math.max(1, currentPage), safeTotal);

  return (
    <div className={`${styles.container}${className ? ` ${className}` : ''}`} style={style}>
      <button
        type="button"
        className={styles.button}
        disabled={safeCurrent <= 1}
        onClick={() => onChange({ page: safeCurrent - 1 })}
      >
        Previous
      </button>

      <span className={styles.pageInfo}>
        Page {safeCurrent} of {safeTotal}
      </span>

      <button
        type="button"
        className={styles.button}
        disabled={safeCurrent >= safeTotal}
        onClick={() => onChange({ page: safeCurrent + 1 })}
      >
        Next
      </button>
    </div>
  );
};

