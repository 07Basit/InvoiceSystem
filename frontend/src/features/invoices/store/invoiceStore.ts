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
  /** Selection mode: cards show a checkbox and a bar offers Download, Share and Delete for the ticked invoices. */
  selectionMode: boolean;
  selectedIds: string[];
  openCreateForm: () => void;
  openEditForm: (id: string) => void;
  openDraftForm: (draftId: string, draftData: CreateInvoiceDto) => void;
  closeForm: () => void;
  setSearch: (s: string) => void;
  setFilter: (key: keyof InvoiceFilterValues, value: string) => void;
  clearFilters: () => void;
  setPage: (p: number) => void;
  setSelectionMode: (on: boolean) => void;
  toggleSelected: (id: string) => void;
  /** Adds these ids to the selection (or removes them when `on` is false). */
  setSelected: (ids: string[], on: boolean) => void;
  clearSelection: () => void;
}

export const useInvoiceStore = create<InvoiceUIState>((set) => ({
  isFormOpen: false,
  editingId: null,
  draftId: null,
  draftData: null,
  search: '',
  filters: noFilters,
  page: 1,
  selectionMode: false,
  selectedIds: [],
  openCreateForm: () => set({ isFormOpen: true, editingId: null, draftId: null, draftData: null }),
  openEditForm: (id) => set({ isFormOpen: true, editingId: id, draftId: null, draftData: null }),
  openDraftForm: (draftId, draftData) => set({ isFormOpen: true, editingId: null, draftId, draftData }),
  closeForm: () => set({ isFormOpen: false, editingId: null, draftId: null, draftData: null }),
  // a new search or filter means a different set of invoices, so the old ticks are dropped
  setSearch: (search) => set({ search, page: 1, selectedIds: [] }),
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value }, page: 1, selectedIds: [] })),
  clearFilters: () => set({ filters: noFilters, search: '', page: 1, selectedIds: [] }),
  setPage: (page) => set({ page }),
  setSelectionMode: (on) => set(on ? { selectionMode: true } : { selectionMode: false, selectedIds: [] }),
  toggleSelected: (id) => set((state) => ({ selectedIds: state.selectedIds.includes(id) ? state.selectedIds.filter((x) => x !== id) : [...state.selectedIds, id] })),
  setSelected: (ids, on) => set((state) => ({
    selectedIds: on ? [...state.selectedIds, ...ids.filter((id) => !state.selectedIds.includes(id))] : state.selectedIds.filter((id) => !ids.includes(id)),
  })),
  clearSelection: () => set({ selectedIds: [] }),
}));
