import { apiClient } from '@/services/api';
import type { ApiResponse, CreateImporterDto, ListImportersQuery, UpdateImporterDto } from 'shared';

export interface LandingLocation {
  id: string;
  name: string;
  portOfDischarge: string;
  finalDestination: string;
  countryOfDestination: string;
}

export interface LoadingLocation {
  id: string;
  name: string;
  portOfLoading: string;
  countryOfOrigin: string;
}

export interface Importer {
  id: string;
  name: string;
  address: string;
  contact?: string | null;
  email?: string | null;
  buyerName?: string | null;
  currency: string;
  /** false = marked "not needed": still listed, but not offered when creating invoices */
  isActive: boolean;
  landingLocations: LandingLocation[];
  loadingLocations: LoadingLocation[];
  createdAt: string;
  _count?: { invoices: number };
}

export interface ImporterSummary {
  total: number;
  active: number;
  inactive: number;
}

export const clientService = {
  async getAll(query: Partial<ListImportersQuery> = {}) {
    const { data } = await apiClient.get<ApiResponse<Importer[]>>('/importers', { params: query });
    return data;
  },

  async getSummary() {
    const { data } = await apiClient.get<ApiResponse<ImporterSummary>>('/importers/summary');
    return data;
  },

  async getById(id: string) {
    const { data } = await apiClient.get<ApiResponse<Importer>>(`/importers/${id}`);
    return data;
  },

  async create(dto: CreateImporterDto) {
    const { data } = await apiClient.post<ApiResponse<Importer>>('/importers', dto);
    return data;
  },

  async update(id: string, dto: UpdateImporterDto) {
    const { data } = await apiClient.put<ApiResponse<Importer>>(`/importers/${id}`, dto);
    return data;
  },

  async delete(id: string) {
    const { data } = await apiClient.delete<ApiResponse<null>>(`/importers/${id}`);
    return data;
  },
};
