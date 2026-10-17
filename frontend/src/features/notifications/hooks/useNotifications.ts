import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListNotificationsQuery } from 'shared';
import { notificationService } from '../services/notificationService';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (q: Partial<ListNotificationsQuery>) => ['notifications', 'list', q] as const,
  unread: ['notifications', 'unread-count'] as const,
  detail: (id: string) => ['notifications', 'detail', id] as const,
};

/** The unread badge: re-checked every minute and whenever the window regains focus. */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: () => notificationService.unreadCount(),
    staleTime: 0,
    refetchInterval: 60_000,
  });
}

export function useNotifications(query: Partial<ListNotificationsQuery>, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.list(query),
    queryFn: () => notificationService.list(query),
    enabled,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
}

export function useNotification(id: string) {
  return useQuery({
    queryKey: notificationKeys.detail(id),
    queryFn: () => notificationService.getOne(id),
    enabled: !!id,
    staleTime: 0,
    retry: false,
  });
}

function useNotificationMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export const useMarkRead = () => useNotificationMutation((id: string) => notificationService.markRead(id));
export const useMarkUnread = () => useNotificationMutation((id: string) => notificationService.markUnread(id));
export const useMarkAllRead = () => useNotificationMutation(() => notificationService.markAllRead());
export const useDeleteNotification = () => useNotificationMutation((id: string) => notificationService.remove(id));
export const useClearRead = () => useNotificationMutation(() => notificationService.clearRead());
