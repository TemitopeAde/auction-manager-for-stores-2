import React, { type FC, type ReactNode } from 'react';
import styles from './Layout.module.css';

export interface LayoutProps {
  cols?: number;
  gap?: string | number;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export interface CellProps {
  span?: number;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Cell: FC<CellProps> = ({ span = 1, children, className, style }) => {
  return (
    <div
      className={`${styles.cell}${className ? ` ${className}` : ''}`}
      style={{
        gridColumn: `span ${span}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Layout: FC<LayoutProps> = ({
  cols = 12,
  gap = '24px',
  children,
  className,
  style,
}) => {
  const gapValue = typeof gap === 'number' ? `${gap}px` : gap;

  return (
    <div
      className={`${styles.layout}${className ? ` ${className}` : ''}`}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: gapValue,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

