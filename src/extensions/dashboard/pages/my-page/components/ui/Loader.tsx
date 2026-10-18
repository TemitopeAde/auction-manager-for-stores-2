import React, { type FC } from 'react';
import styles from './Loader.module.css';

export interface LoaderProps {
  size?: 'tiny' | 'small' | 'medium' | 'large';
  className?: string;
  style?: React.CSSProperties;
}

export const Loader: FC<LoaderProps> = ({
  size = 'medium',
  className,
  style,
}) => {
  return (
    <div
      className={`${styles.container}${className ? ` ${className}` : ''}`}
      style={style}
      role="status"
      aria-label="Loading"
    >
      <div className={`${styles.spinner} ${styles[size]}`} />
    </div>
  );
};

