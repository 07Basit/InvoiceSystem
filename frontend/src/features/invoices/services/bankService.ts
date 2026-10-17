import { apiClient } from '@/services/api';
import type { ApiResponse, BankProfileDto } from 'shared';

export interface BankProfile {
  id: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string | null;
  swiftCode: string | null;
  isDefault: boolean;
  /** false = marked "not needed": kept, but not offered on new invoices */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const bankService = {
  async list() {
    const { data } = await apiClient.get<ApiResponse<BankProfile[]>>('/bank-profiles');
    return data;
  },

  async create(dto: BankProfileDto) {
    const { data } = await apiClient.post<ApiResponse<BankProfile>>('/bank-profiles', dto);
    return data;
  },

  async update(id: string, dto: BankProfileDto) {
    const { data } = await apiClient.put<ApiResponse<BankProfile>>(`/bank-profiles/${id}`, dto);
    return data;
  },

  async setDefault(id: string) {
    const { data } = await apiClient.patch<ApiResponse<BankProfile>>(`/bank-profiles/${id}/default`);
    return data;
  },

  async setActive(id: string, isActive: boolean) {
    const { data } = await apiClient.patch<ApiResponse<BankProfile>>(`/bank-profiles/${id}/active`, { isActive });
    return data;
  },

  async remove(id: string) {
    const { data } = await apiClient.delete<ApiResponse<null>>(`/bank-profiles/${id}`);
    return data;
  },
};
