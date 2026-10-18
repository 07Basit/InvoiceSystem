import { apiClient } from '@/services/api';
import type { ApiResponse, ProductListDto } from 'shared';

/** A list of products for one importer in one currency, optionally one landing location. Its products are the ones with the same three values. */
export interface ProductList {
  id: string;
  importerId: string;
  currency: string;
  locationName: string | null;
  createdAt: string;
}

export const productListService = {
  async list() {
    const { data } = await apiClient.get<ApiResponse<ProductList[]>>('/product-lists');
    return data;
  },

  async create(dto: ProductListDto) {
    const { data } = await apiClient.post<ApiResponse<ProductList>>('/product-lists', dto);
    return data;
  },

  async remove(id: string) {
    const { data } = await apiClient.delete<ApiResponse<null>>(`/product-lists/${id}`);
    return data;
  },
};
