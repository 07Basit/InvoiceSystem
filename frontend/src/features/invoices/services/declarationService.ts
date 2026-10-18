import { apiClient } from '@/services/api';
import type { ApiResponse, DeclarationProfileDto } from 'shared';

export interface DeclarationProfile {
  id: string;
  name: string;
  /** The wording printed on the invoice */
  text: string;
  isDefault: boolean;
  /** false = marked "not needed": kept, but not offered on new invoices */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const declarationService = {
  async list() {
    const { data } = await apiClient.get<ApiResponse<DeclarationProfile[]>>('/declaration-profiles');
    return data;
  },

  async create(dto: DeclarationProfileDto) {
    const { data } = await apiClient.post<ApiResponse<DeclarationProfile>>('/declaration-profiles', dto);
    return data;
  },

  async update(id: string, dto: DeclarationProfileDto) {
    const { data } = await apiClient.put<ApiResponse<DeclarationProfile>>(`/declaration-profiles/${id}`, dto);
    return data;
  },

  async setDefault(id: string) {
    const { data } = await apiClient.patch<ApiResponse<DeclarationProfile>>(`/declaration-profiles/${id}/default`);
    return data;
  },

  async setActive(id: string, isActive: boolean) {
    const { data } = await apiClient.patch<ApiResponse<DeclarationProfile>>(`/declaration-profiles/${id}/active`, { isActive });
    return data;
  },

  async remove(id: string) {
    const { data } = await apiClient.delete<ApiResponse<null>>(`/declaration-profiles/${id}`);
    return data;
  },
};
