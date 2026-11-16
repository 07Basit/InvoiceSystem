import { useEffect, useMemo, useState } from 'react';
import type { PriceOverviewItem } from 'shared';
import FilterBar from '@/components/ui/FilterBar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils';
import { usePriceOverview } from '../hooks/usePurchases';
import { countActive, noPurchaseFilters, type PurchaseFilterValues } from '../utils/purchaseFilters';
import ProductPriceCard from './ProductPriceCard';

type View = 'all' | 'up' | 'down' | 'sold';
type Sort = 'name' | 'rise' | 'fall' | 'recent';

interface PriceOverviewProps {
  filters: PurchaseFilterValues;
  onFiltersChange: (filters: PurchaseFilterValues) => void;
  onOpenFilters: () => void;
  onOpenProduct: (product: string) => void;
  /** Tells the page how many products match, for the filter panel's button */
  onCount: (count: number | undefined) => void;
}

const SORTS: { id: Sort; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'rise', label: 'Biggest rise' },
  { id: 'fall', label: 'Biggest fall' },
  { id: 'recent', label: 'Latest purchase' },
];

const sorters: Record<Sort, (a: PriceOverviewItem, b: PriceOverviewItem) => number> = {
  name: (a, b) => a.product.localeCompare(b.product),
  rise: (a, b) => (b.changePercent ?? -Infinity) - (a.changePercent ?? -Infinity) || a.product.localeCompare(b.product),
  fall: (a, b) => (a.changePercent ?? Infinity) - (b.changePercent ?? Infinity) || a.product.localeCompare(b.product),
  recent: (a, b) => b.latest.date.localeCompare(a.latest.date) || a.product.localeCompare(b.product),
};

/** Every product bought, as a card: latest rate, how it moved, a small trend. Click one for its full story. */
const PriceOverview: React.FC<PriceOverviewProps> = ({ filters, onFiltersChange, onOpenFilters, onOpenProduct, onCount }) => {
  const { dateFrom, dateTo, supplierId } = filters;
  const { data: items = [], isLoading, isError, refetch } = usePriceOverview({ ...(supplierId ? { supplierId } : {}), ...(dateFrom ? { from: dateFrom } : {}), ...(dateTo ? { to: dateTo } : {}) });
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('all');
  const [sort, setSort] = useState<Sort>('name');

  const searched = useMemo(() => items.filter((i) => i.product.toLowerCase().includes(search.trim().toLowerCase())), [items, search]);
  const counts = useMemo(() => ({
    all: searched.length,
    up: searched.filter((i) => (i.changePercent ?? 0) > 0).length,
    down: searched.filter((i) => (i.changePercent ?? 0) < 0).length,
    sold: searched.filter((i) => i.sale).length,
  }), [searched]);
  const shown = useMemo(() => searched.filter((i) => view === 'all' || (view === 'up' && (i.changePercent ?? 0) > 0) || (view === 'down' && (i.changePercent ?? 0) < 0) || (view === 'sold' && i.sale)).sort(sorters[sort]), [searched, view, sort]);
  useEffect(() => { onCount(isLoading ? undefined : searched.length); }, [isLoading, searched.length, onCount]);

  const tabs: { id: View; label: string }[] = [
    { id: 'all', label: 'All products' },
    { id: 'up', label: 'Getting dearer' },
    { id: 'down', label: 'Getting cheaper' },
    { id: 'sold', label: 'Sold on an invoice' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Price tracker</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Every product you buy, with its latest rate per kg and how it is moving. Open one to compare suppliers and what you charged.</p>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search a product…"
        searchLabel="Search a product"
        activeCount={countActive({ ...filters, product: '' })}
        onClear={() => { setSearch(''); onFiltersChange(noPurchaseFilters); }}
        onOpenFilters={onOpenFilters}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Show" className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={view === t.id} onClick={() => setView(t.id)}
              className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors', view === t.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground')}>
              {t.label} <span className={cn('ml-1 text-xs tabular-nums', view === t.id ? 'opacity-80' : 'opacity-60')}>{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Sort by
          <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input !w-auto !py-1.5">
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="py-16"><LoadingSpinner variant="invoices" size="sm" /></div>
      ) : isError ? (
        <div className="card-enterprise px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">The prices could not be loaded.</p>
          <button type="button" onClick={() => void refetch()} className="btn-ghost mt-3">Try again</button>
        </div>
      ) : shown.length === 0 ? (
        <div className="card-enterprise px-6 py-14 text-center">
          <h3 className="text-base font-semibold">{items.length === 0 ? 'No purchases yet' : 'No products match'}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{items.length === 0 ? 'Products appear here once purchase invoices have been saved.' : 'Try another search, view or filter.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((item) => <ProductPriceCard key={item.product} item={item} onOpen={() => onOpenProduct(item.product)} />)}
        </div>
      )}
    </div>
  );
};

export default PriceOverview;
