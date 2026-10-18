import { items } from '@wix/data';
import { queryAll } from './wix-data-utils';
import type { NotificationRecord } from '../auction/types';

export const NOTIFICATIONS_COLLECTION_ID = '@hi-konsult/smart-auction-manager/Notifications';

interface NotificationCollectionItem {
  _id: string;
  auctionId: string;
  audience: 'owner' | 'bidder' | 'winner';
  channel: 'dashboard' | 'whatsapp';
  message: string;
  createdAt: string;
}

function normalizeNotification(item: any): NotificationRecord {
  return {
    id: item._id,
    auctionId: item.auctionId,
    audience: item.audience,
    channel: item.channel,
    message: item.message,
    createdAt: item.createdAt,
  };
}

export async function listNotifications(): Promise<NotificationRecord[]> {
  const allItems = await queryAll<NotificationCollectionItem>(() =>
    items.query(NOTIFICATIONS_COLLECTION_ID),
  );

  return allItems
    .map(normalizeNotification)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function insertNotification(
  auctionId: string,
  audience: NotificationRecord['audience'],
  channel: NotificationRecord['channel'],
  message: string
): Promise<NotificationRecord> {
  const notification: Omit<NotificationCollectionItem, '_id'> = {
    auctionId,
    audience,
    channel,
    message,
    createdAt: new Date().toISOString(),
  };

  const created = await items.insert(NOTIFICATIONS_COLLECTION_ID, notification);
  return normalizeNotification(created);
}
