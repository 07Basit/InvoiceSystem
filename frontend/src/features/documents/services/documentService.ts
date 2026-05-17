import { apiClient } from '@/services/api';
import type { ApiResponse, CreateDocumentDto, UpdateDocumentDto, ListDocumentsQuery } from 'shared';

export interface Document {
  id: string;
  title: string;
  type: 'WORD' | 'PDF';
  content?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const documentService = {
  async getAll(query: Partial<ListDocumentsQuery> = {}) {
    const { data } = await apiClient.get<ApiResponse<Document[]>>('/documents', { params: query });
    return data;
  },

  async getById(id: string) {
    const { data } = await apiClient.get<ApiResponse<Document>>(`/documents/${id}`);
    return data;
  },

  async create(dto: CreateDocumentDto) {
    const { data } = await apiClient.post<ApiResponse<Document>>('/documents', dto);
    return data;
  },

  async update(id: string, dto: UpdateDocumentDto) {
    const { data } = await apiClient.put<ApiResponse<Document>>(`/documents/${id}`, dto);
    return data;
  },

  async delete(id: string) {
    const { data } = await apiClient.delete<ApiResponse<null>>(`/documents/${id}`);
    return data;
  },
};
