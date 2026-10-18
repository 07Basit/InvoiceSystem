import { apiClient } from '@/services/api';
import type { ApiResponse, DraftKind } from 'shared';

export interface Draft<T> {
  id: string;
  kind: DraftKind;
  /** the invoice number or importer name typed so far */
  title: string | null;
  data: T;
  createdAt: string;
  updatedAt: string;
}

export const draftService = {
  async list<T>(kind: DraftKind) {
    const { data } = await apiClient.get<ApiResponse<Draft<T>[]>>('/drafts', { params: { kind } });
    return data.data ?? [];
  },

  async create<T>(kind: DraftKind, values: T, createdAt?: string) {
    const { data } = await apiClient.post<ApiResponse<Draft<T>>>('/drafts', { kind, data: values, ...(createdAt ? { createdAt } : {}) });
    return data.data!;
  },

  async update<T>(id: string, values: T) {
    const { data } = await apiClient.put<ApiResponse<Draft<T>>>(`/drafts/${id}`, { data: values });
    return data.data!;
  },

  async remove(id: string) {
    await apiClient.delete(`/drafts/${id}`);
  },
};
