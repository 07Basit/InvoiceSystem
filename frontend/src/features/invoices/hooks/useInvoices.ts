import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoiceService } from '../services/invoiceService';
import type { CreateInvoiceDto, UpdateInvoiceDto, ListInvoicesQuery } from 'shared';

export const invoiceKeys = {
  all: ['invoices'] as const,
  list: (query: Partial<ListInvoicesQuery>) => ['invoices', 'list', query] as const,
  detail: (id: string) => ['invoices', 'detail', id] as const,
};

export function useInvoices(query: Partial<ListInvoicesQuery> = {}) {
  return useQuery({
    queryKey: invoiceKeys.list(query),
    queryFn: () => invoiceService.getAll(query),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => invoiceService.getById(id),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateInvoiceDto) => invoiceService.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateInvoiceDto }) =>
      invoiceService.update(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoiceService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      qc.invalidateQueries({ queryKey: ['recycle-bin'] });
    },
  });
}
