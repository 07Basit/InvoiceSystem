import { create } from 'zustand';
import type { CreateInvoiceDto } from 'shared';

export interface InvoiceFilterValues {
  year: string;
  month: string;
  importerId: string;
  currency: string;
}

const noFilters: InvoiceFilterValues = { year: '', month: '', importerId: '', currency: '' };

interface InvoiceUIState {
  isFormOpen: boolean;
  editingId: string | null;
  draftId: string | null;
  draftData: CreateInvoiceDto | null;
  search: string;
  filters: InvoiceFilterValues;
  page: number;
  openCreateForm: () => void;
  openEditForm: (id: string) => void;
  openDraftForm: (draftId: string, draftData: CreateInvoiceDto) => void;
  closeForm: () => void;
  setSearch: (s: string) => void;
  setFilter: (key: keyof InvoiceFilterValues, value: string) => void;
  clearFilters: () => void;
  setPage: (p: number) => void;
}

export const useInvoiceStore = create<InvoiceUIState>((set) => ({
  isFormOpen: false,
  editingId: null,
  draftId: null,
  draftData: null,
  search: '',
  filters: noFilters,
  page: 1,
  openCreateForm: () => set({ isFormOpen: true, editingId: null, draftId: null, draftData: null }),
  openEditForm: (id) => set({ isFormOpen: true, editingId: id, draftId: null, draftData: null }),
  openDraftForm: (draftId, draftData) => set({ isFormOpen: true, editingId: null, draftId, draftData }),
  closeForm: () => set({ isFormOpen: false, editingId: null, draftId: null, draftData: null }),
  setSearch: (search) => set({ search, page: 1 }),
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value }, page: 1 })),
  clearFilters: () => set({ filters: noFilters, search: '', page: 1 }),
  setPage: (page) => set({ page }),
}));
