import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentService } from '../services/documentService';
import type { CreateDocumentDto, UpdateDocumentDto, ListDocumentsQuery } from 'shared';

export const documentKeys = {
  all: ['documents'] as const,
  list: (q: Partial<ListDocumentsQuery>) => ['documents', 'list', q] as const,
  detail: (id: string) => ['documents', 'detail', id] as const,
};

export function useDocuments(query: Partial<ListDocumentsQuery> = {}) {
  return useQuery({
    queryKey: documentKeys.list(query),
    queryFn: () => documentService.getAll(query),
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDocumentDto) => documentService.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateDocumentDto }) => documentService.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}
