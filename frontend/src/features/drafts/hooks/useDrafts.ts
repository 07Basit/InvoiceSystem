import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DraftKind } from 'shared';
import { draftService, type Draft } from '../services/draftService';

const key = (kind: DraftKind) => ['drafts', kind] as const;

/** The signed-in person's saved drafts of one kind, from the database (newest first). */
export function useDrafts<T>(kind: DraftKind) {
  return useQuery({ queryKey: key(kind), queryFn: () => draftService.list<T>(kind) });
}

/** Saves a draft: updates it when an id is given, otherwise creates a new one. */
export function useSaveDraft<T>(kind: DraftKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string | null; data: T }): Promise<Draft<T>> => (id ? draftService.update<T>(id, data) : draftService.create<T>(kind, data)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(kind) }),
  });
}

export function useDeleteDraft(kind: DraftKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => draftService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(kind) }),
  });
}
