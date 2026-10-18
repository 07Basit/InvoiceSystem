import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Layers, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClients } from '@/features/clients/hooks/useClients';
import { useProducts } from '@/features/invoices/hooks/useProducts';
import { useProductLists } from '@/features/invoices/hooks/useProductLists';
import type { ProductList } from '@/features/invoices/services/productListService';
import { inScope } from '../components/ProductsSection';
import CreateProductListDialog from '../components/CreateProductListDialog';

/** The scope (importer, currency, location) a list stands for. */
export const listScope = (list: Pick<ProductList, 'importerId' | 'currency' | 'locationName'>) => ({
  importerId: list.importerId,
  currency: list.currency,
  ...(list.locationName ? { locationName: list.locationName } : {}),
});

/**
 * Products are kept in lists: one general list, and a list for each importer, currency and landing location.
 * Each list is a card; click it to see and manage its products. Invoices offer the matching importer's list first.
 */
export default function ProductsPage() {
  const navigate = useNavigate();
  const { data: importersData } = useClients({ limit: 100, sort: 'name' });
  const { data: productData } = useProducts();
  const { data: listData, isLoading } = useProductLists();
  const [creating, setCreating] = useState(false);

  const importers = importersData?.data ?? [];
  const products = productData?.data ?? [];
  const lists = [...(listData?.data ?? [])]
    .map((list) => ({ list, importerName: importers.find((i) => i.id === list.importerId)?.name ?? 'Importer' }))
    .sort((a, b) => a.importerName.localeCompare(b.importerName) || a.list.currency.localeCompare(b.list.currency) || (a.list.locationName ?? '').localeCompare(b.list.locationName ?? ''));

  const generalCount = products.filter((p) => inScope(p, {})).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Keep a list of products for each importer, currency and location. Invoices offer the matching importer's list first, then the general list.
          </p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="btn-brand shrink-0"><Plus className="h-4 w-4" /> Create list</button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ListCard
          title="General list"
          subtitle="Offered on every invoice"
          count={generalCount}
          icon={<Layers className="h-5 w-5" />}
          onOpen={() => navigate('/products/general')}
        />
        {lists.map(({ list, importerName }) => (
          <ListCard
            key={list.id}
            title={importerName}
            subtitle={[list.currency, list.locationName || 'All locations'].join(' · ')}
            count={products.filter((p) => inScope(p, listScope(list))).length}
            icon={<Building2 className="h-5 w-5" />}
            onOpen={() => navigate(`/products/${list.id}`)}
          />
        ))}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-[5.5rem] items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-[hsl(var(--brand-accent))]/50 hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> New list for an importer
        </button>
      </div>

      {!isLoading && lists.length === 0 && (
        <p className="text-sm text-muted-foreground">No importer lists yet. Create one to give an importer its own products, rates and weights.</p>
      )}

      {creating && (
        <CreateProductListDialog
          existing={listData?.data ?? []}
          onClose={() => setCreating(false)}
          onCreated={(list) => { setCreating(false); navigate(`/products/${list.id}`); }}
        />
      )}
    </div>
  );
}

function ListCard({ title, subtitle, count, icon, onOpen }: { title: string; subtitle: string; count: number; icon: React.ReactNode; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${title}, ${subtitle}, ${count} product${count === 1 ? '' : 's'}`}
      className={cn('group flex min-h-[5.5rem] items-center gap-4 rounded-xl border bg-card card-pattern p-4 text-left transition-all hover:shadow-md hover:border-[hsl(var(--brand-accent))]/40')}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-xl font-bold leading-none">{count}</span>
        <span className="block text-[11px] text-muted-foreground">product{count === 1 ? '' : 's'}</span>
      </span>
    </button>
  );
}
