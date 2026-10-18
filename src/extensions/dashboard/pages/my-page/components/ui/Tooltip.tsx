import React, { type FC, type ReactNode } from 'react';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  content?: ReactNode;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Tooltip: FC<TooltipProps> = ({
  content,
  disabled = false,
  children,
  className,
  style,
}) => {
  if (!content) {
    return <>{children}</>;
  }

  return (
    <div className={`${styles.wrapper}${className ? ` ${className}` : ''}`} style={style}>
      {children}
      <div className={`${styles.content}${disabled ? ` ${styles.disabled}` : ''}`}>
        {content}
      </div>
    </div>
  );
};

