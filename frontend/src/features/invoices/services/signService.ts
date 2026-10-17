import { apiClient } from '@/services/api';
import type { ApiResponse, SignProfileDto } from 'shared';

export interface SignProfile {
  id: string;
  name: string;
  /** PNG/JPEG data URL */
  image: string;
  isDefault: boolean;
  /** false = marked "not needed": kept, but not offered on new invoices */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const signService = {
  async list() {
    const { data } = await apiClient.get<ApiResponse<SignProfile[]>>('/sign-profiles');
    return data;
  },

  async create(dto: SignProfileDto) {
    const { data } = await apiClient.post<ApiResponse<SignProfile>>('/sign-profiles', dto);
    return data;
  },

  async update(id: string, dto: SignProfileDto) {
    const { data } = await apiClient.put<ApiResponse<SignProfile>>(`/sign-profiles/${id}`, dto);
    return data;
  },

  async setDefault(id: string) {
    const { data } = await apiClient.patch<ApiResponse<SignProfile>>(`/sign-profiles/${id}/default`);
    return data;
  },

  async setActive(id: string, isActive: boolean) {
    const { data } = await apiClient.patch<ApiResponse<SignProfile>>(`/sign-profiles/${id}/active`, { isActive });
    return data;
  },

  async remove(id: string) {
    const { data } = await apiClient.delete<ApiResponse<null>>(`/sign-profiles/${id}`);
    return data;
  },
};
