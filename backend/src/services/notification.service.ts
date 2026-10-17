import type { Notification, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';
import type {
  ListNotificationsQuery, NotificationCategory, NotificationDetail, NotificationDto, NotificationType, PaginationMeta,
} from 'shared';

const RETENTION_DAYS = 90;

export interface NewNotification {
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message?: string;
  details?: NotificationDetail[];
  link?: string;
  linkLabel?: string;
}

export function toDto(row: Notification): NotificationDto {
  let details: NotificationDetail[] = [];
  if (row.details) {
    try {
      const parsed: unknown = JSON.parse(row.details);
      if (Array.isArray(parsed)) details = parsed as NotificationDetail[];
    } catch {
      details = [];
    }
  }
  return {
    id: row.id,
    type: row.type as NotificationType,
    category: row.category as NotificationCategory,
    title: row.title,
    message: row.message,
    details,
    link: row.link,
    linkLabel: row.linkLabel,
    actorName: row.actorName,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export const notificationService = {
  /**
   * Tells every user about something that happened. A failure here is logged and swallowed: a missing
   * notification must never make the real action (saving an invoice, say) fail.
   */
  async notifyAll(actorName: string | null, input: NewNotification): Promise<void> {
    try {
      const users = await prisma.user.findMany({ select: { id: true } });
      if (users.length === 0) return;

      await prisma.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          type: input.type,
          category: input.category,
          title: input.title,
          message: input.message ?? null,
          details: input.details?.length ? JSON.stringify(input.details) : null,
          link: input.link ?? null,
          linkLabel: input.linkLabel ?? null,
          actorName,
        })),
      });

      // keep the table small: drop anything older than the retention window
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff } } });
    } catch (error) {
      logger.warn('Could not create notification', { error: (error as Error).message, title: input.title });
    }
  },

  async list(userId: string, query: ListNotificationsQuery): Promise<{ data: NotificationDto[]; meta: PaginationMeta }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.status === 'unread' ? { readAt: null } : {}),
      ...(query.category ? { category: query.category } : {}),
    };

    const [rows, total] = await prisma.$transaction([
      prisma.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
      prisma.notification.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: rows.map(toDto),
      meta: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  },

  async unreadCount(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, readAt: null } });
  },

  async getOne(userId: string, id: string): Promise<NotificationDto> {
    const row = await prisma.notification.findFirst({ where: { id, userId } });
    if (!row) throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    return toDto(row);
  },

  /** `read: false` puts it back to unread. Only the owner can change it. */
  async setRead(userId: string, id: string, read: boolean): Promise<NotificationDto> {
    const row = await prisma.notification.findFirst({ where: { id, userId } });
    if (!row) throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    const updated = await prisma.notification.update({ where: { id }, data: { readAt: read ? (row.readAt ?? new Date()) : null } });
    return toDto(updated);
  },

  async markAllRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return result.count;
  },

  async remove(userId: string, id: string): Promise<void> {
    const result = await prisma.notification.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
  },

  /** Deletes everything that has been read; unread ones are kept. */
  async clearRead(userId: string): Promise<number> {
    const result = await prisma.notification.deleteMany({ where: { userId, readAt: { not: null } } });
    return result.count;
  },
};
