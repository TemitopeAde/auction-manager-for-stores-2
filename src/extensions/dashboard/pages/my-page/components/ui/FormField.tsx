import React, { type FC, type ReactNode } from 'react';
import styles from './FormField.module.css';

export interface FormFieldProps {
  label?: ReactNode;
  required?: boolean;
  infoContent?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const FormField: FC<FormFieldProps> = ({
  label,
  required,
  infoContent,
  children,
  className,
  style,
}) => {
  return (
    <div className={`${styles.field}${className ? ` ${className}` : ''}`} style={style}>
      {label && (
        <div className={styles.labelRow}>
          <label className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
          {infoContent && (
            <span
              className={styles.infoIcon}
              title={typeof infoContent === 'string' ? infoContent : undefined}
            >
              ?
            </span>
          )}
        </div>
      )}
      <div className={styles.content}>{children}</div>
    </div>
  );
};

