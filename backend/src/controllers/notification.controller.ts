import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { notificationService } from '../services/notification.service';
import type { ListNotificationsQuery } from 'shared';

const me = (req: Request) => req.auth!.user.id;
const ok = (res: Response, data: unknown, meta: unknown = null) => res.json({ success: true, data, error: null, meta });

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const result = await notificationService.list(me(req), req.query as unknown as ListNotificationsQuery);
  ok(res, result.data, result.meta);
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  ok(res, { count: await notificationService.unreadCount(me(req)) });
});

export const getNotification = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await notificationService.getOne(me(req), String(req.params['id'])));
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await notificationService.setRead(me(req), String(req.params['id']), true));
});

export const markNotificationUnread = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await notificationService.setRead(me(req), String(req.params['id']), false));
});

export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  ok(res, { updated: await notificationService.markAllRead(me(req)) });
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.remove(me(req), String(req.params['id']));
  ok(res, null);
});

export const clearReadNotifications = asyncHandler(async (req: Request, res: Response) => {
  ok(res, { deleted: await notificationService.clearRead(me(req)) });
});
