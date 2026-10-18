import React, { type FC, type SelectHTMLAttributes } from 'react';
import styles from './Select.module.css';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
}

export const Select: FC<SelectProps> = ({
  children,
  className,
  wrapperClassName,
  wrapperStyle,
  ...rest
}) => {
  return (
    <div
      className={`${styles.selectWrapper}${wrapperClassName ? ` ${wrapperClassName}` : ''}`}
      style={wrapperStyle}
    >
      <select className={`${styles.select}${className ? ` ${className}` : ''}`} {...rest}>
        {children}
      </select>
      <div className={styles.chevron}>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1L5 5L9 1" />
        </svg>
      </div>
    </div>
  );
};

