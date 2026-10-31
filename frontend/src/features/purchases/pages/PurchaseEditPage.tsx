import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import PurchaseForm from '../components/PurchaseForm';
import { usePurchase, usePurchaseMutations, usePurchasedProducts, useSuppliers } from '../hooks/usePurchases';
import { emptyPurchase, fromSaved, toDto } from '../utils/purchaseForm';
import { useState } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useConfirm } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';

/** A saved purchase invoice to view and edit, or (at /purchases/new) a blank one to enter by hand. */
export default function PurchaseEditPage({ mode }: { mode: 'edit' | 'new' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { data: purchase, isLoading, isError } = usePurchase(mode === 'edit' ? id : undefined);
  const { data: suppliers = [] } = useSuppliers();
  const { data: purchased = [] } = usePurchasedProducts();
  const { create, update, remove } = usePurchaseMutations();
  const [error, setError] = useState<string | null>(null);

  if (mode === 'edit' && isLoading) return <div className="py-20"><LoadingSpinner variant="invoice" size="sm" message="Opening the purchase…" /></div>;
  if (mode === 'edit' && (isError || !purchase)) return <p className="py-20 text-center text-sm text-muted-foreground">This purchase invoice could not be found.</p>;

  const onSave = (values: Parameters<typeof toDto>[0]) => {
    setError(null);
    const done = () => { showToast('Saved', 'The purchase invoice was saved.', 'success'); navigate('/purchases'); };
    if (mode === 'new') create.mutate(toDto(values), { onSuccess: done, onError: (e) => setError(e.message) });
    else update.mutate({ id: id!, dto: toDto(values) }, { onSuccess: done, onError: (e) => setError(e.message) });
  };

  const onDelete = async () => {
    if (!purchase) return;
    const ok = await confirm({ title: `Delete ${purchase.supplierName} · ${purchase.invoiceNumber}?`, message: 'It is removed from reports and the price tracker. You can enter it again afterwards.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    remove.mutate(purchase.id, {
      onSuccess: () => { showToast('Deleted', 'The purchase invoice was removed.', 'success'); navigate('/purchases'); },
      onError: (e) => showToast('Could not delete', e.message, 'error'),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link to="/purchases" className="btn-icon" aria-label="Back to purchase invoices"><ArrowLeft className="h-4 w-4" /></Link>
          <h2 className="text-lg font-semibold">{mode === 'new' ? 'New purchase invoice' : `${purchase!.supplierName} · ${purchase!.invoiceNumber}`}</h2>
        </div>
        {mode === 'edit' && <button type="button" onClick={() => void onDelete()} className="btn-ghost text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /> Delete</button>}
      </div>
      <PurchaseForm
        key={purchase?.id ?? 'new'}
        initial={purchase ? fromSaved(purchase) : emptyPurchase()}
        suppliers={suppliers}
        productSuggestions={purchased.map((p) => p.product)}
        saving={create.isPending || update.isPending}
        error={error}
        saveLabel={mode === 'new' ? 'Save purchase' : 'Save changes'}
        onSave={onSave}
        onCancel={() => navigate('/purchases')}
      />
    </div>
  );
}
