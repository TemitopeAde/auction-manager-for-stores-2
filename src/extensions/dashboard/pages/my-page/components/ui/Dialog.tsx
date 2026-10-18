import React, {
  type FC,
  type ReactNode,
  useEffect,
  useRef,
} from 'react';
import { Button } from './Button';
import styles from './Dialog.module.css';

export interface ModalProps {
  isOpen: boolean;
  onRequestClose?: () => void;
  shouldCloseOnOverlayClick?: boolean;
  children?: ReactNode;
}

export const Modal: FC<ModalProps> = ({
  isOpen,
  onRequestClose,
  shouldCloseOnOverlayClick = true,
  children,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onRequestClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onRequestClose]);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldCloseOnOverlayClick && e.target === overlayRef.current) {
      onRequestClose?.();
    }
  };

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  );
};

export interface CustomModalLayoutProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  primaryButtonText?: string;
  primaryButtonOnClick?: () => void;
  primaryButtonProps?: {
    disabled?: boolean;
    prefixIcon?: ReactNode;
    skin?: string;
  };
  secondaryButtonText?: string;
  secondaryButtonOnClick?: () => void;
  secondaryButtonProps?: {
    disabled?: boolean;
  };
  onCloseButtonClick?: () => void;
  content?: ReactNode;
  children?: ReactNode;
  wide?: boolean;
}

export const CustomModalLayout: FC<CustomModalLayoutProps> = ({
  title,
  subtitle,
  primaryButtonText,
  primaryButtonOnClick,
  primaryButtonProps,
  secondaryButtonText,
  secondaryButtonOnClick,
  secondaryButtonProps,
  onCloseButtonClick,
  content,
  children,
  wide = false,
}) => {
  return (
    <div className={`${styles.dialog}${wide ? ` ${styles.dialogWide}` : ''}`}>
      {(title || subtitle || onCloseButtonClick) && (
        <div className={styles.header}>
          <div className={styles.headerText}>
            {title && <h3 className={styles.title}>{title}</h3>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {onCloseButtonClick && (
            <button
              type="button"
              className={styles.closeButton}
              onClick={onCloseButtonClick}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      )}

      <div className={styles.body}>{content ?? children}</div>

      {(primaryButtonText || secondaryButtonText) && (
        <div className={styles.footer}>
          {secondaryButtonText && (
            <Button
              priority="secondary"
              onClick={secondaryButtonOnClick}
              disabled={secondaryButtonProps?.disabled}
            >
              {secondaryButtonText}
            </Button>
          )}
          {primaryButtonText && (
            <Button
              variant={primaryButtonProps?.skin === 'destructive' ? 'destructive' : 'default'}
              onClick={primaryButtonOnClick}
              disabled={primaryButtonProps?.disabled}
              prefixIcon={primaryButtonProps?.prefixIcon}
            >
              {primaryButtonText}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export interface MessageModalLayoutProps {
  title: ReactNode;
  primaryButtonText?: string;
  primaryButtonOnClick?: () => void;
  primaryButtonProps?: {
    disabled?: boolean;
    prefixIcon?: ReactNode;
    skin?: string;
  };
  secondaryButtonText?: string;
  secondaryButtonOnClick?: () => void;
  onCloseButtonClick?: () => void;
  children?: ReactNode;
}

export const MessageModalLayout: FC<MessageModalLayoutProps> = ({
  title,
  primaryButtonText,
  primaryButtonOnClick,
  primaryButtonProps,
  secondaryButtonText,
  secondaryButtonOnClick,
  onCloseButtonClick,
  children,
}) => {
  return (
    <CustomModalLayout
      title={title}
      primaryButtonText={primaryButtonText}
      primaryButtonOnClick={primaryButtonOnClick}
      primaryButtonProps={primaryButtonProps}
      secondaryButtonText={secondaryButtonText}
      secondaryButtonOnClick={secondaryButtonOnClick}
      onCloseButtonClick={onCloseButtonClick}
    >
      {children}
    </CustomModalLayout>
  );
};

