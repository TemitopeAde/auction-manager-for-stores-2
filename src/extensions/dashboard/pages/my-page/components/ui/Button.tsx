import React, { type FC, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './Button.module.css';

type ButtonPriority = 'primary' | 'secondary' | 'basic-destructive';
type ButtonVariant  = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
type ButtonSize     = 'tiny' | 'small' | 'medium' | 'large';
type ButtonSkin     = 'standard' | 'destructive' | 'premium' | 'success' | string;

const PRIORITY_TO_VARIANT: Record<ButtonPriority, ButtonVariant> = {
  primary:             'default',
  secondary:           'secondary',
  'basic-destructive': 'destructive',
};

const SIZE_MAP: Record<ButtonSize, string> = {
  tiny:   styles.xs,
  small:  styles.sm,
  medium: styles.md,
  large:  styles.lg,
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** WDS-compatible priority prop */
  priority?: ButtonPriority;
  /** shadcn-style variant prop */
  variant?: ButtonVariant;
  /** WDS size names */
  size?: ButtonSize;
  /** WDS skin (maps destructive → destructive variant) */
  skin?: ButtonSkin;
  prefixIcon?: ReactNode;
  suffixIcon?: ReactNode;
  children?: ReactNode;
}

export const Button: FC<ButtonProps> = ({
  priority,
  variant: variantProp,
  size = 'medium',
  skin,
  prefixIcon,
  suffixIcon,
  children,
  className,
  type = 'button',
  ...rest
}) => {
  let variant: ButtonVariant = variantProp ?? (priority ? PRIORITY_TO_VARIANT[priority] : 'default');
  if (skin === 'destructive') variant = 'destructive';

  const cls = [
    styles.btn,
    styles[variant] ?? styles.default,
    SIZE_MAP[size] ?? styles.md,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={cls} type={type} {...rest}>
      {prefixIcon && <span className={styles.iconWrap}>{prefixIcon}</span>}
      {children}
      {suffixIcon && <span className={styles.iconWrap}>{suffixIcon}</span>}
    </button>
  );
};

