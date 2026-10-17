import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientService } from '../services/clientService';
import type { CreateImporterDto, UpdateImporterDto, ListImportersQuery } from 'shared';

export const clientKeys = {
  all: ['importers'] as const,
  list: (q: Partial<ListImportersQuery>) => ['importers', 'list', q] as const,
  detail: (id: string) => ['importers', 'detail', id] as const,
};

export function useClients(query: Partial<ListImportersQuery> = {}) {
  return useQuery({
    queryKey: clientKeys.list(query),
    queryFn: () => clientService.getAll(query),
    // keep the current page on screen while the next one loads, so the list doesn't flash or jump
    placeholderData: keepPreviousData,
  });
}

export function useImporterSummary() {
  return useQuery({
    queryKey: [...clientKeys.all, 'summary'] as const,
    queryFn: () => clientService.getSummary(),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => clientService.getById(id),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateImporterDto) => clientService.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.all }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateImporterDto }) => clientService.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.all }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.all }),
  });
}
