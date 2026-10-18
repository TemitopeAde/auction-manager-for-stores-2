import React, { type FC, type ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

interface CardHeaderProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  suffix?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

interface CardContentProps {
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const CardHeader: FC<CardHeaderProps> = ({
  title,
  subtitle,
  suffix,
  className,
  style,
}) => {
  return (
    <div className={`${styles.header}${className ? ` ${className}` : ''}`} style={style}>
      <div className={styles.headerContent}>
        {title && <h3 className={styles.title}>{title}</h3>}
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {suffix && <div className={styles.suffix}>{suffix}</div>}
    </div>
  );
};

const CardContent: FC<CardContentProps> = ({ children, className, style }) => {
  return (
    <div className={`${styles.content}${className ? ` ${className}` : ''}`} style={style}>
      {children}
    </div>
  );
};

export const Card: FC<CardProps> & {
  Header: typeof CardHeader;
  Content: typeof CardContent;
} = ({ children, className, style }) => {
  return (
    <div className={`${styles.card}${className ? ` ${className}` : ''}`} style={style}>
      {children}
    </div>
  );
};

Card.Header = CardHeader;
Card.Content = CardContent;
