import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    placeholderData: keepPreviousData,
    staleTime: 0, // always re-check when the list is opened, so the newest invoice is on top
  });
}

export function useInvoiceSummary() {
  return useQuery({
    queryKey: [...invoiceKeys.all, 'summary'] as const,
    queryFn: () => invoiceService.getSummary(),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => invoiceService.getById(id),
    enabled: !!id,
  });
}

/** Makes the "ACTUAL <number>" copy of an invoice. */
export function useCreateActualInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoiceService.createActual(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
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

function useRateMutation<T>(fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useSetManualRate() {
  return useRateMutation(({ id, rate }: { id: string; rate: number }) => invoiceService.setManualRate(id, rate));
}

export function useClearManualRate() {
  return useRateMutation((id: string) => invoiceService.clearManualRate(id));
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
