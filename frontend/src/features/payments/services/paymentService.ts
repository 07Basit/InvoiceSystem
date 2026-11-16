import { apiClient } from '@/services/api';
import { downloadFile } from '@/features/invoices/services/invoiceService';
import type { ApiResponse, InvoicePayments, PaymentDto, Statement, StatementQuery } from 'shared';

const unwrap = <T,>(reply: ApiResponse<T>): T => {
  if (reply.data === null || reply.data === undefined) throw new Error('The server sent no data');
  return reply.data;
};

const queryString = (query: StatementQuery) => {
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  const text = params.toString();
  return text ? `?${text}` : '';
};

export const paymentService = {
  async forInvoice(invoiceId: string) {
    const { data } = await apiClient.get<ApiResponse<InvoicePayments>>(`/invoices/${invoiceId}/payments`);
    return unwrap(data);
  },
  async methods() {
    const { data } = await apiClient.get<ApiResponse<string[]>>('/payments/methods');
    return unwrap(data);
  },
  async create(invoiceId: string, dto: PaymentDto) {
    const { data } = await apiClient.post<ApiResponse<InvoicePayments>>(`/invoices/${invoiceId}/payments`, dto);
    return unwrap(data);
  },
  async update(paymentId: string, dto: PaymentDto) {
    const { data } = await apiClient.put<ApiResponse<InvoicePayments>>(`/payments/${paymentId}`, dto);
    return unwrap(data);
  },
  async remove(paymentId: string) {
    const { data } = await apiClient.delete<ApiResponse<InvoicePayments>>(`/payments/${paymentId}`);
    return unwrap(data);
  },
  async statement(importerId: string, query: StatementQuery) {
    const { data } = await apiClient.get<ApiResponse<Statement>>(`/importers/${importerId}/statement${queryString(query)}`);
    return unwrap(data);
  },
  downloadStatementPdf(importerId: string, query: StatementQuery) {
    return downloadFile(`/importers/${importerId}/statement/pdf${queryString(query)}`, 'statement.pdf');
  },
  downloadStatementExcel(importerId: string, query: StatementQuery) {
    return downloadFile(`/importers/${importerId}/statement/excel${queryString(query)}`, 'statement.xlsx');
  },
};
