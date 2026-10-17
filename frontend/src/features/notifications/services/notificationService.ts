import { apiClient } from '@/services/api';
import type { ApiResponse, ListNotificationsQuery, NotificationDto } from 'shared';

export const notificationService = {
  async list(query: Partial<ListNotificationsQuery> = {}) {
    const { data } = await apiClient.get<ApiResponse<NotificationDto[]>>('/notifications', { params: query });
    return data;
  },

  async unreadCount() {
    const { data } = await apiClient.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
    return data.data?.count ?? 0;
  },

  async getOne(id: string) {
    const { data } = await apiClient.get<ApiResponse<NotificationDto>>(`/notifications/${id}`);
    return data.data!;
  },

  async markRead(id: string) {
    const { data } = await apiClient.post<ApiResponse<NotificationDto>>(`/notifications/${id}/read`);
    return data.data!;
  },

  async markUnread(id: string) {
    const { data } = await apiClient.post<ApiResponse<NotificationDto>>(`/notifications/${id}/unread`);
    return data.data!;
  },

  async markAllRead() {
    await apiClient.post('/notifications/read-all');
  },

  async remove(id: string) {
    await apiClient.delete(`/notifications/${id}`);
  },

  /** Deletes the notifications that have already been read. */
  async clearRead() {
    const { data } = await apiClient.delete<ApiResponse<{ deleted: number }>>('/notifications');
    return data.data?.deleted ?? 0;
  },
};
