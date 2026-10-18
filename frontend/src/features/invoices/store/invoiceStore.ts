import { create } from 'zustand';
import type { CreateInvoiceDto } from 'shared';

import { noFilters, type InvoiceFilterValues } from '../utils/invoiceFilters';

export type { InvoiceFilterValues };

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
  setFilter: <K extends keyof InvoiceFilterValues>(key: K, value: InvoiceFilterValues[K]) => void;
  /** Replaces all filters at once (a saved view, or a removed chip) */
  setFilters: (filters: InvoiceFilterValues) => void;
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
  setFilters: (filters) => set({ filters, page: 1, selectedIds: [] }),
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value }, page: 1, selectedIds: [] })),
  clearFilters: () => set({ filters: noFilters, search: '', page: 1, selectedIds: [] }),
  setPage: (page) => set({ page }),
  setSelectionMode: (on) => set(on ? { selectionMode: true } : { selectionMode: false, selectedIds: [] }),
  toggleSelected: (id) => set((state) => ({ selectedIds: state.selectedIds.includes(id) ? state.selectedIds.filter((x) => x !== id) : [...state.selectedIds, id] })),
  // sets make "page of p ids into k ticked" O(p + k) instead of O(p * k); the array keeps the order the user ticked them in
  setSelected: (ids, on) => set((state) => {
    if (on) {
      const have = new Set(state.selectedIds);
      return { selectedIds: [...state.selectedIds, ...ids.filter((id) => !have.has(id))] };
    }
    const drop = new Set(ids);
    return { selectedIds: state.selectedIds.filter((id) => !drop.has(id)) };
  }),
  clearSelection: () => set({ selectedIds: [] }),
}));
