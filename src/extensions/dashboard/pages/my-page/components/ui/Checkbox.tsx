import React, { type FC, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  tooltipContent?: ReactNode;
  children?: ReactNode;
}

export const Checkbox: FC<CheckboxProps> = ({
  checked,
  onChange,
  disabled,
  tooltipContent,
  children,
  className,
  title,
  ...rest
}) => {
  return (
    <label
      className={`${styles.label}${disabled ? ` ${styles.disabled}` : ''}${
        className ? ` ${className}` : ''
      }`}
      title={typeof tooltipContent === 'string' ? tooltipContent : title}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={styles.checkbox}
        {...rest}
      />
      {children && <span>{children}</span>}
    </label>
  );
};
