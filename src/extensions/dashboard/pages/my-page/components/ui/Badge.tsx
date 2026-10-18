import React, { type FC, type ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeSkin =
  | 'standard'
  | 'general'
  | 'neutralStandard'
  | 'success'
  | 'warning'
  | 'danger'
  | 'destructive'
  | 'premium'
  | string;

export type BadgeSize = 'tiny' | 'small' | 'medium';

export interface BadgeProps {
  skin?: BadgeSkin;
  size?: BadgeSize;
  uppercase?: boolean;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: FC<BadgeProps> = ({
  skin = 'standard',
  size = 'small',
  uppercase = false,
  children,
  className,
  style,
}) => {
  const skinClass = styles[skin] ?? styles.standard;
  const sizeClass = styles[size] ?? styles.small;

  const cls = [
    styles.badge,
    skinClass,
    sizeClass,
    uppercase ? styles.uppercase : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={cls} style={style}>
      {children}
    </span>
  );
};
