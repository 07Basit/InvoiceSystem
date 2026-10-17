import { apiClient } from '@/services/api';
import type { ApiResponse, ExporterProfileDto } from 'shared';

export interface ExporterProfile {
  id: string;
  name: string;
  address: string;
  contact: string;
  email: string | null;
  isDefault: boolean;
  /** false = marked "not needed": kept, but not offered on new invoices */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const exporterService = {
  async list() {
    const { data } = await apiClient.get<ApiResponse<ExporterProfile[]>>('/exporter-profiles');
    return data;
  },

  async create(dto: ExporterProfileDto) {
    const { data } = await apiClient.post<ApiResponse<ExporterProfile>>('/exporter-profiles', dto);
    return data;
  },

  async update(id: string, dto: ExporterProfileDto) {
    const { data } = await apiClient.put<ApiResponse<ExporterProfile>>(`/exporter-profiles/${id}`, dto);
    return data;
  },

  async setDefault(id: string) {
    const { data } = await apiClient.patch<ApiResponse<ExporterProfile>>(`/exporter-profiles/${id}/default`);
    return data;
  },

  async setActive(id: string, isActive: boolean) {
    const { data } = await apiClient.patch<ApiResponse<ExporterProfile>>(`/exporter-profiles/${id}/active`, { isActive });
    return data;
  },

  async remove(id: string) {
    const { data } = await apiClient.delete<ApiResponse<null>>(`/exporter-profiles/${id}`);
    return data;
  },
};
