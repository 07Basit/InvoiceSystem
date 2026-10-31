import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ReceiptText, Truck } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/toast';
import AddSupplierDialog from '../components/AddSupplierDialog';
import { useSuppliers } from '../hooks/usePurchases';
import { titleCase } from '../utils/format';

/**
 * Purchase invoices are kept per supplier: a card for all of them, and one for each supplier.
 * Click a card to see its invoices.
 */
export default function PurchaseCardsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: suppliers = [], isLoading } = useSuppliers();
  const [adding, setAdding] = useState(false);

  const shown = suppliers.filter((s) => s.isActive || (s._count?.purchases ?? 0) > 0);
  const total = suppliers.reduce((n, s) => n + (s._count?.purchases ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Purchase invoices</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Upload each supplier’s Excel invoice and check it before it is saved. Open a card to see that supplier’s invoices.</p>
        </div>
        <button type="button" onClick={() => setAdding(true)} className="btn-brand shrink-0"><Plus className="h-4 w-4" /> Add supplier</button>
      </div>

      {isLoading ? (
        <div className="py-16"><LoadingSpinner variant="invoices" size="sm" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PurchaseCard title="All Purchase Invoices" subtitle="Every supplier" count={total} icon={<ReceiptText className="h-5 w-5" />} onOpen={() => navigate('/purchases/list/all')} />
          {shown.map((s) => (
            <PurchaseCard key={s.id} title={`${titleCase(s.name)} Purchase Invoices`} subtitle={s.isActive ? 'Supplier' : 'Not needed'} count={s._count?.purchases ?? 0} icon={<Truck className="h-5 w-5" />} onOpen={() => navigate(`/purchases/list/${s.id}`)} />
          ))}
          <button type="button" onClick={() => setAdding(true)} className="flex min-h-[5.5rem] items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-[hsl(var(--brand-accent))]/50 hover:text-foreground">
            <Plus className="h-4 w-4" /> New supplier
          </button>
        </div>
      )}

      {!isLoading && suppliers.length === 0 && <p className="text-sm text-muted-foreground">No suppliers yet. Add one, or upload an invoice and add the supplier from there.</p>}

      {adding && <AddSupplierDialog onClose={() => setAdding(false)} onAdded={(s) => { setAdding(false); showToast('Supplier added', `${s.name} was added.`, 'success'); }} />}
    </div>
  );
}

function PurchaseCard({ title, subtitle, count, icon, onOpen }: { title: string; subtitle: string; count: number; icon: React.ReactNode; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-label={`${title}, ${subtitle}, ${count} invoice${count === 1 ? '' : 's'}`}
      className="group flex min-h-[5.5rem] items-center gap-4 rounded-xl border bg-card card-pattern p-4 text-left transition-all hover:border-[hsl(var(--brand-accent))]/40 hover:shadow-md">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-xl font-bold leading-none">{count}</span>
        <span className="block text-[11px] text-muted-foreground">invoice{count === 1 ? '' : 's'}</span>
      </span>
    </button>
  );
}
