import React, { type FC, type ReactNode, type ButtonHTMLAttributes } from 'react';
import styles from './Text.module.css';

/* ─── Text ─────────────────────────────────────────────────────────── */
type TextSize = 'tiny' | 'small' | 'medium' | 'large';
type TextWeight = 'thin' | 'normal' | 'bold';

interface TextProps {
  size?: TextSize;
  weight?: TextWeight;
  secondary?: boolean;
  light?: boolean;
  ellipsis?: boolean;
  children?: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const Text: FC<TextProps> = ({
  size = 'medium',
  weight = 'normal',
  secondary,
  light,
  ellipsis,
  children,
  style,
  className,
}) => {
  const cls = [
    styles.base,
    styles[size],
    styles[weight],
    secondary ? styles.secondary : '',
    light     ? styles.light : '',
    ellipsis  ? styles.ellipsis : '',
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

/* ─── Heading ───────────────────────────────────────────────────────── */
type HeadingSize = 'tiny' | 'small' | 'medium' | 'large' | 'xlarge';

interface HeadingProps {
  size?: HeadingSize;
  light?: boolean;
  children?: ReactNode;
  style?: React.CSSProperties;
}

const HEADING_ELEMENT: Record<HeadingSize, keyof JSX.IntrinsicElements> = {
  tiny:   'h5',
  small:  'h4',
  medium: 'h3',
  large:  'h2',
  xlarge: 'h1',
};

const HEADING_CLASS: Record<HeadingSize, string> = {
  tiny:   styles.h4,
  small:  styles.h4,
  medium: styles.h3,
  large:  styles.h2,
  xlarge: styles.h1,
};

export const Heading: FC<HeadingProps> = ({ size = 'medium', light, children, style }) => {
  const Tag = HEADING_ELEMENT[size];
  const cls = [
    HEADING_CLASS[size],
    light ? styles.light : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={cls} style={style}>
      {children}
    </Tag>
  );
};

/* ─── TextButton ────────────────────────────────────────────────────── */
interface TextButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'tiny' | 'small' | 'medium';
  prefixIcon?: ReactNode;
  suffixIcon?: ReactNode;
}

export const TextButton: FC<TextButtonProps> = ({
  size = 'small',
  prefixIcon,
  suffixIcon,
  children,
  className,
  ...rest
}) => {
  const cls = [
    styles.textBtn,
    size === 'tiny' ? styles.textBtnTiny : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={cls} type="button" {...rest}>
      {prefixIcon && <span style={{ display: 'inline-flex' }}>{prefixIcon}</span>}
      {children}
      {suffixIcon && <span style={{ display: 'inline-flex' }}>{suffixIcon}</span>}
    </button>
  );
};

