import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InvoicePayments, PaymentDto, StatementQuery } from 'shared';
import { paymentService } from '../services/paymentService';

export const paymentKeys = {
  invoice: (invoiceId: string) => ['payments', 'invoice', invoiceId] as const,
  methods: ['payments', 'methods'] as const,
  statement: (importerId: string, query: StatementQuery) => ['payments', 'statement', importerId, query] as const,
};

export function useInvoicePayments(invoiceId: string | undefined, enabled = true) {
  return useQuery({ queryKey: paymentKeys.invoice(invoiceId ?? ''), queryFn: () => paymentService.forInvoice(invoiceId!), enabled: enabled && Boolean(invoiceId) });
}

/** The payment methods used so far, for the method dropdown. */
export function usePaymentMethods() {
  return useQuery({ queryKey: paymentKeys.methods, queryFn: () => paymentService.methods(), staleTime: 60_000 });
}

/** Add, change and delete the payments of one invoice. Each answers with the invoice's new position. */
export function usePaymentMutations(invoiceId: string) {
  const qc = useQueryClient();
  const done = (result: InvoicePayments) => {
    qc.setQueryData(paymentKeys.invoice(invoiceId), result);
    // the invoice list shows each actual invoice's status, and statements add up the payments
    void qc.invalidateQueries({ queryKey: ['invoices'] });
    void qc.invalidateQueries({ queryKey: ['payments', 'statement'] });
    void qc.invalidateQueries({ queryKey: paymentKeys.methods });
  };
  return {
    create: useMutation({ mutationFn: (dto: PaymentDto) => paymentService.create(invoiceId, dto), onSuccess: done }),
    update: useMutation({ mutationFn: ({ id, dto }: { id: string; dto: PaymentDto }) => paymentService.update(id, dto), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => paymentService.remove(id), onSuccess: done }),
  };
}

export function useStatement(importerId: string | undefined, query: StatementQuery, enabled = true) {
  return useQuery({ queryKey: paymentKeys.statement(importerId ?? '', query), queryFn: () => paymentService.statement(importerId!, query), enabled: enabled && Boolean(importerId) });
}
