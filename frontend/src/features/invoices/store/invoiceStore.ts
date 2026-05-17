import { create } from 'zustand';

interface InvoiceUIState {
  isFormOpen: boolean;
  editingId: string | null;
  search: string;
  page: number;
  openCreateForm: () => void;
  openEditForm: (id: string) => void;
  closeForm: () => void;
  setSearch: (s: string) => void;
  setPage: (p: number) => void;
}

export const useInvoiceStore = create<InvoiceUIState>((set) => ({
  isFormOpen: false,
  editingId: null,
  search: '',
  page: 1,
  openCreateForm: () => set({ isFormOpen: true, editingId: null }),
  openEditForm: (id) => set({ isFormOpen: true, editingId: id }),
  closeForm: () => set({ isFormOpen: false, editingId: null }),
  setSearch: (search) => set({ search, page: 1 }),
  setPage: (page) => set({ page }),
}));
