import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useSupplierMutations } from '../hooks/usePurchases';
import type { Supplier } from '../services/purchaseService';
import { titleCase } from '../utils/format';

interface AddSupplierDialogProps {
  onClose: () => void;
  onAdded: (supplier: Supplier) => void;
}

/** Add a supplier by name. */
const AddSupplierDialog: React.FC<AddSupplierDialogProps> = ({ onClose, onAdded }) => {
  const { create } = useSupplierMutations();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    create.mutate({ name: titleCase(name) }, { onSuccess: onAdded, onError: (err) => setError(err.message) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Add supplier">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">Add supplier</h2>
          <button type="button" onClick={onClose} className="btn-icon -mr-2 -mt-1" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <label className="label" htmlFor="new-supplier-name">Supplier name</label>
        <input id="new-supplier-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className="input" placeholder="e.g. Sunil" autoFocus />
        {error && <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2.5 text-sm text-red-900">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={!name.trim() || create.isPending} className="btn-brand disabled:opacity-50">{create.isPending ? 'Adding…' : 'Add supplier'}</button>
        </div>
      </form>
    </div>
  );
};

export default AddSupplierDialog;
