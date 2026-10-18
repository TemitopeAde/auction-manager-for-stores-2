import React, { type FC } from 'react';
import { Card, Tooltip } from './ui';

interface MetricCardProps {
  label: string;
  value: string;
  hint: string;
}

export const MetricCard: FC<MetricCardProps> = ({ label, value, hint }) => {
  return (
    <Tooltip content={hint}>
      <Card style={{ height: '100%' }}>
        <Card.Content style={{ padding: '20px', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#64748b',
              }}
            >
              {label}
            </span>
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              color: '#0f172a',
              lineHeight: 1.2,
            }}
          >
            {value}
          </div>
          <div
            style={{
              fontSize: '0.8125rem',
              color: '#64748b',
              lineHeight: 1.3,
            }}
          >
            {hint}
          </div>
        </Card.Content>
      </Card>
    </Tooltip>
  );
};
