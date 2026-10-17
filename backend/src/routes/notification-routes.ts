import { Router } from 'express';
import { validate } from '../middleware/validate';
import { listNotificationsQuerySchema } from 'shared';
import {
  clearReadNotifications,
  deleteNotification,
  getNotification,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from '../controllers/notification.controller';

const router = Router();

router.get('/', validate(listNotificationsQuerySchema, 'query'), listNotifications);
router.get('/unread-count', getUnreadCount);
router.post('/read-all', markAllNotificationsRead);
router.delete('/', clearReadNotifications); // removes read notifications only
router.get('/:id', getNotification);
router.post('/:id/read', markNotificationRead);
router.post('/:id/unread', markNotificationUnread);
router.delete('/:id', deleteNotification);

export default router;
