import { apiClient } from '@/services/api';
import type { ApiResponse, ExcelUpdateApplyDto, ExcelUpdatePreview, ExcelUpdateRecord } from 'shared';

const unwrap = <T,>(reply: ApiResponse<T>): T => {
  if (reply.data === null || reply.data === undefined) throw new Error('The server sent no data');
  return reply.data;
};

/** Update an invoice's product lines from the Excel that was downloaded from it and edited. */
export const excelUpdateService = {
  async preview(invoiceId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await apiClient.post<ApiResponse<ExcelUpdatePreview>>(`/invoices/${invoiceId}/excel-update/preview`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 });
    return unwrap(data);
  },
  async apply(invoiceId: string, dto: ExcelUpdateApplyDto) {
    const { data } = await apiClient.post<ApiResponse<ExcelUpdateRecord>>(`/invoices/${invoiceId}/excel-update/apply`, dto);
    return unwrap(data);
  },
  async latest(invoiceId: string) {
    const { data } = await apiClient.get<ApiResponse<ExcelUpdateRecord | null>>(`/invoices/${invoiceId}/excel-update/latest`);
    return data.data ?? null;
  },
  async undo(invoiceId: string) {
    await apiClient.post(`/invoices/${invoiceId}/excel-update/undo`);
  },
};
