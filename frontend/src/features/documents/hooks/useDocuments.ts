import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentService, type Document } from '../services/documentService';
import type { CreateDocumentDto, DocumentType, UpdateDocumentDto, ListDocumentsQuery } from 'shared';

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

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: documentKeys.detail(id ?? ''),
    queryFn: () => documentService.getById(id!),
    enabled: Boolean(id),
    // the editors keep their own copy while open; refetching on focus would only replace it
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDocumentDto) => documentService.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

export function useImportDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, title }: { file: File; title?: string }) => documentService.importFile(file, title),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

/** After a save the open document is updated in place (an editor must not be given a fresh copy while it is being typed in) and only the lists are refreshed. */
function afterSave(qc: ReturnType<typeof useQueryClient>, saved: Document) {
  qc.setQueryData(documentKeys.detail(saved.id), saved);
  return qc.invalidateQueries({ queryKey: [...documentKeys.all, 'list'] });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateDocumentDto }) => documentService.update(id, dto),
    onSuccess: (saved) => afterSave(qc, saved),
  });
}

export function useSaveDocumentFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file, filename }: { id: string; file: Blob; filename: string }) => documentService.saveFile(id, file, filename),
    onSuccess: (saved) => afterSave(qc, saved),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

/** How many documents there are of one kind, starred, or in all, for the numbers beside the side menu. */
export function useDocumentCount(filter: { type?: DocumentType; starred?: boolean } = {}) {
  const query: Partial<ListDocumentsQuery> = { limit: 1, ...(filter.type ? { type: filter.type } : {}), ...(filter.starred ? { starred: 'true' as const } : {}) };
  return useQuery({
    queryKey: documentKeys.list(query),
    queryFn: () => documentService.getAll(query),
    select: (res) => res.meta?.total ?? 0,
  });
}
