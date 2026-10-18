import React, { type FC, type ReactNode } from 'react';
import styles from './Box.module.css';

type BoxAlign =
  | 'left' | 'right' | 'center'
  | 'space-between' | 'space-around'
  | 'flex-start' | 'flex-end';

type BoxVerticalAlign = 'top' | 'middle' | 'bottom' | 'baseline';

interface BoxProps {
  direction?: 'horizontal' | 'vertical';
  gap?: string | number;
  align?: BoxAlign;
  verticalAlign?: BoxVerticalAlign;
  padding?: string | number;
  children?: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

const ALIGN_MAP: Record<string, string> = {
  left:          'flex-start',
  right:         'flex-end',
  center:        'center',
  'space-between': 'space-between',
  'space-around':  'space-around',
  'flex-start':  'flex-start',
  'flex-end':    'flex-end',
};

const V_ALIGN_MAP: Record<string, string> = {
  top:      'flex-start',
  middle:   'center',
  bottom:   'flex-end',
  baseline: 'baseline',
};

export const Box: FC<BoxProps> = ({
  direction = 'horizontal',
  gap,
  align,
  verticalAlign,
  padding,
  children,
  style,
  className,
}) => {
  const isVertical = direction === 'vertical';

  const computedStyle: React.CSSProperties = {
    flexDirection:   isVertical ? 'column' : 'row',
    justifyContent:  align     ? ALIGN_MAP[align]     : undefined,
    alignItems:      verticalAlign ? V_ALIGN_MAP[verticalAlign] : (align && !isVertical ? undefined : undefined),
    gap:             gap !== undefined ? (typeof gap === 'number' ? `${gap}px` : gap) : undefined,
    padding:         padding !== undefined ? (typeof padding === 'number' ? `${padding}px` : padding) : undefined,
    ...style,
  };

  // When horizontal, align maps to justifyContent; verticalAlign to alignItems
  // When vertical, align maps to alignItems; verticalAlign to justifyContent
  if (align) {
    if (isVertical) {
      computedStyle.alignItems = ALIGN_MAP[align];
      computedStyle.justifyContent = undefined;
    } else {
      computedStyle.justifyContent = ALIGN_MAP[align];
    }
  }
  if (verticalAlign) {
    if (isVertical) {
      computedStyle.justifyContent = V_ALIGN_MAP[verticalAlign];
    } else {
      computedStyle.alignItems = V_ALIGN_MAP[verticalAlign];
    }
  }

  return (
    <div className={`${styles.box}${className ? ` ${className}` : ''}`} style={computedStyle}>
      {children}
    </div>
  );
};

