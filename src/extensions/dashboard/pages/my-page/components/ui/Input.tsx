import React, {
  type FC,
  type InputHTMLAttributes,
  type ReactNode,
  forwardRef,
} from 'react';
import styles from './Input.module.css';

const InputAffix: FC<{ children: ReactNode }> = ({ children }) => {
  return <span className={styles.affix}>{children}</span>;
};

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  clearButton?: boolean;
  onClear?: () => void;
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      prefix,
      suffix,
      clearButton,
      onClear,
      disabled,
      className,
      wrapperClassName,
      wrapperStyle,
      value,
      ...rest
    },
    ref,
  ) => {
    return (
      <div
        className={`${styles.inputWrapper}${disabled ? ` ${styles.disabled}` : ''}${
          wrapperClassName ? ` ${wrapperClassName}` : ''
        }`}
        style={wrapperStyle}
      >
        {prefix ? <span className={styles.prefix}>{prefix}</span> : null}
        <input
          ref={ref}
          disabled={disabled}
          value={value}
          className={`${styles.input}${className ? ` ${className}` : ''}`}
          {...rest}
        />
        {clearButton && value && onClear && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={onClear}
            title="Clear input"
          >
            ✕
          </button>
        )}
        {suffix}
      </div>
    );
  },
) as React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>> & {
  Affix: typeof InputAffix;
};

Input.Affix = InputAffix;

/* ─── NumberInput ─────────────────────────────────────────────────── */
export interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'prefix'> {
  value?: number | null;
  onChange?: (val: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  hideStepper?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  wrapperStyle?: React.CSSProperties;
}

export const NumberInput: FC<NumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  hideStepper,
  prefix,
  suffix,
  disabled,
  className,
  wrapperStyle,
  ...rest
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange?.(undefined);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) {
      onChange?.(parsed);
    }
  };

  return (
    <Input
      type="number"
      value={value ?? ''}
      onChange={handleChange}
      onWheel={(e) => {
        e.currentTarget.blur();
        rest.onWheel?.(e);
      }}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      prefix={prefix}
      suffix={suffix}
      className={[className, hideStepper ? styles.hideStepper : undefined].filter(Boolean).join(' ')}
      wrapperStyle={wrapperStyle}
      {...rest}
    />
  );
};
