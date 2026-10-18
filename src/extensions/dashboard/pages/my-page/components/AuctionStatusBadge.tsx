import React, { type FC } from 'react';
import { Badge, type BadgeSkin } from './ui';
import type { AuctionStatus } from '../../../../../lib/auction/types';

const BADGE_SKINS: Record<AuctionStatus, BadgeSkin> = {
  draft: 'general',
  scheduled: 'general',
  live: 'success',
  endingSoon: 'warning',
  paused: 'warning',
  closed: 'standard',
  sold: 'success',
  reserveNotMet: 'danger',
};

const STATUS_LABELS: Record<AuctionStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  live: 'Live',
  endingSoon: 'Ending Soon',
  paused: 'Paused',
  closed: 'Closed',
  sold: 'Sold',
  reserveNotMet: 'Reserve Not Met',
};

interface AuctionStatusBadgeProps {
  status: AuctionStatus;
}

export const AuctionStatusBadge: FC<AuctionStatusBadgeProps> = ({ status }) => {
  const isLive = status === 'live';
  const isEndingSoon = status === 'endingSoon';

  return (
    <Badge skin={BADGE_SKINS[status]} size="small">
      {(isLive || isEndingSoon) && (
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: isLive ? '#10b981' : '#f59e0b',
            boxShadow: isLive ? '0 0 0 2px rgba(16, 185, 129, 0.2)' : '0 0 0 2px rgba(245, 158, 11, 0.2)',
          }}
        />
      )}
      {STATUS_LABELS[status]}
    </Badge>
  );
};
