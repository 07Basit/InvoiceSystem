import { apiClient } from '@/services/api';
import type { ApiResponse } from 'shared';

export interface DeletedInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  currency: string;
  deletedAt: string;
  createdAt: string;
  importer: { name: string };
}

export interface DeletedImporter {
  id: string;
  name: string;
  buyerName: string;
  contact: string;
  email?: string | null;
  currency: string;
  deletedAt: string;
  createdAt: string;
}

export interface DeletedItems {
  invoices: DeletedInvoice[];
  importers: DeletedImporter[];
}

export const recycleBinService = {
  async getDeleted() {
    const { data } = await apiClient.get<ApiResponse<DeletedItems>>('/recycle');
    return data;
  },

  async restore(type: 'invoice' | 'importer', id: string) {
    const { data } = await apiClient.patch<ApiResponse<unknown>>(`/recycle/${type}/${id}/restore`);
    return data;
  },

  async permanentDelete(type: 'invoice' | 'importer', id: string) {
    const { data } = await apiClient.delete<ApiResponse<null>>(`/recycle/${type}/${id}`);
    return data;
  },
};
