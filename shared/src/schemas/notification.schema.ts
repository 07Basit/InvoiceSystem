import { z } from 'zod';

export const notificationTypeSchema = z.enum(['success', 'info', 'warning', 'error']);
export const notificationCategorySchema = z.enum(['invoice', 'importer', 'currency', 'system']);

export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type NotificationCategory = z.infer<typeof notificationCategorySchema>;

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(['all', 'unread']).default('all'),
  category: notificationCategorySchema.optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export interface NotificationDetail {
  label: string;
  value: string;
}

/** A notification as the API returns it (details already parsed from JSON). */
export interface NotificationDto {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string | null;
  details: NotificationDetail[];
  link: string | null;
  linkLabel: string | null;
  actorName: string | null;
  readAt: string | null;
  createdAt: string;
}
