import { apiClient } from '@/services/api';
import { saveBlob } from '@/lib/share';
import type { ApiResponse, CreateDocumentDto, DocumentType, UpdateDocumentDto, ListDocumentsQuery } from 'shared';

export interface Document {
  id: string;
  title: string;
  type: DocumentType;
  /** Word: the text as HTML. Excel: the sheets as JSON. Only present when one document is opened. */
  content?: string | null;
  size: number;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FetchedDocumentFile {
  blob: Blob;
  filename: string;
}

/** The document inside an API reply (a successful reply for one document always carries it). */
function unwrap(reply: ApiResponse<Document>): Document {
  if (!reply.data) throw new Error('The server sent no document');
  return reply.data;
}

async function fetchFile(id: string, inline: boolean): Promise<FetchedDocumentFile> {
  const response = await apiClient.get<Blob>(`/documents/${id}/file`, { params: inline ? { disposition: 'inline' } : {}, responseType: 'blob' });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return { blob: response.data, filename: match?.[1] ? decodeURIComponent(match[1]) : 'document' };
}

export const documentService = {
  async getAll(query: Partial<ListDocumentsQuery> = {}) {
    const { data } = await apiClient.get<ApiResponse<Document[]>>('/documents', { params: query });
    return data;
  },

  async getById(id: string) {
    const { data } = await apiClient.get<ApiResponse<Document>>(`/documents/${id}`);
    return unwrap(data);
  },

  async create(dto: CreateDocumentDto) {
    const { data } = await apiClient.post<ApiResponse<Document>>('/documents', dto);
    return unwrap(data);
  },

  /** Adds a .docx, .xlsx or .pdf from the computer. */
  async importFile(file: File, title?: string) {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    const { data } = await apiClient.post<ApiResponse<Document>>('/documents/import', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 });
    return unwrap(data);
  },

  async update(id: string, dto: UpdateDocumentDto) {
    const { data } = await apiClient.put<ApiResponse<Document>>(`/documents/${id}`, dto);
    return unwrap(data);
  },

  /** Replaces the saved file (the PDF after an edit, or the .xlsx made by the spreadsheet editor). */
  async saveFile(id: string, file: Blob, filename: string) {
    const form = new FormData();
    form.append('file', file, filename);
    const { data } = await apiClient.put<ApiResponse<Document>>(`/documents/${id}/file`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 });
    return unwrap(data);
  },

  async delete(id: string) {
    const { data } = await apiClient.delete<ApiResponse<null>>(`/documents/${id}`);
    return data;
  },

  /** The stored file (for the editors to open). */
  getFile(id: string) {
    return fetchFile(id, true);
  },

  async download(id: string) {
    const { blob, filename } = await fetchFile(id, false);
    saveBlob(blob, filename);
  },
};
