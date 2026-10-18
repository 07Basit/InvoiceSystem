import { apiClient } from '@/services/api';
import type { ApiResponse, ProductDto } from 'shared';

export interface Product {
  id: string;
  name: string;
  /** Usual values (Decimals arrive as strings); null = none saved */
  nettWeightPerPackage: string | null;
  ratePerKg: string | null;
  hsCode: string | null;
  /** false = marked "not needed": kept, but not offered on invoices */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const productService = {
  async list() {
    const { data } = await apiClient.get<ApiResponse<Product[]>>('/products');
    return data;
  },

  async create(dto: ProductDto) {
    const { data } = await apiClient.post<ApiResponse<Product>>('/products', dto);
    return data;
  },

  async update(id: string, dto: ProductDto) {
    const { data } = await apiClient.put<ApiResponse<Product>>(`/products/${id}`, dto);
    return data;
  },

  async setActive(id: string, isActive: boolean) {
    const { data } = await apiClient.patch<ApiResponse<Product>>(`/products/${id}/active`, { isActive });
    return data;
  },

  async remove(id: string) {
    const { data } = await apiClient.delete<ApiResponse<null>>(`/products/${id}`);
    return data;
  },
};
