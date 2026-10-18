import { useState, type ReactNode } from 'react';
import FilterBar from '@/components/ui/FilterBar';
import type { InvoiceFilterOptions } from '../services/invoiceService';
import { countActive, noFilters, type InvoiceFilterValues } from '../utils/invoiceFilters';
import InvoiceFilterPanel from './InvoiceFilterPanel';

interface InvoiceFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: InvoiceFilterValues;
  onFiltersChange: (filters: InvoiceFilterValues) => void;
  options: InvoiceFilterOptions | undefined;
  importers: Array<{ id: string; name: string; isActive?: boolean }>;
  /** Invoices matching the current search and filters */
  matching: number | undefined;
  /** Shown to the right of the Filters button */
  trailing?: ReactNode;
}

/** The search box and the Filters button; the filters themselves open in a side panel (a bottom sheet on phones). */
export default function InvoiceFilters({ search, onSearchChange, filters, onFiltersChange, options, importers, matching, trailing }: InvoiceFiltersProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search invoices…"
        searchLabel="Search invoices"
        activeCount={countActive(filters)}
        onClear={() => { onSearchChange(''); onFiltersChange(noFilters); }}
        onOpenFilters={() => setOpen(true)}
        trailing={trailing}
      />
      <InvoiceFilterPanel open={open} onClose={() => setOpen(false)} filters={filters} onChange={onFiltersChange} options={options} importers={importers} matching={matching} />
    </>
  );
}
