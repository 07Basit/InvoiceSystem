import { apiClient } from '@/services/api';
import type { ApiResponse, UpsertExporterProfileDto } from 'shared';

export interface ExporterProfile extends UpsertExporterProfileDto {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export const exporterService = {
  async getProfile() {
    const { data } = await apiClient.get<ApiResponse<ExporterProfile | null>>('/exporter-profile');
    return data;
  },

  async saveProfile(dto: UpsertExporterProfileDto) {
    const { data } = await apiClient.put<ApiResponse<ExporterProfile>>('/exporter-profile', dto);
    return data;
  },
};
