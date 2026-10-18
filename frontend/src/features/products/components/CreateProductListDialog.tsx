import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { productListSchema } from 'shared';
import SearchCombobox, { type ComboOption } from '@/components/ui/SearchCombobox';
import { useClients } from '@/features/clients/hooks/useClients';
import { useProductListMutations } from '@/features/invoices/hooks/useProductLists';
import type { ProductList } from '@/features/invoices/services/productListService';
import { getCurrencyOptions, toComboOption } from '@/lib/currencies';
import { useToast } from '@/components/ui/toast';

/** Pick an importer, a currency and (optionally) a landing location to start a new list of products. */
export default function CreateProductListDialog({ onClose, onCreated, existing }: { onClose: () => void; onCreated: (list: ProductList) => void; existing: ProductList[] }) {
  const { data: importersData } = useClients({ limit: 100, sort: 'name' });
  const { create } = useProductListMutations();
  const { showToast } = useToast();
  const importers = (importersData?.data ?? []).filter((i) => i.isActive !== false);
  const currencies = useMemo(() => getCurrencyOptions(), []);

  const [importerId, setImporterId] = useState('');
  const [currency, setCurrency] = useState('');
  const [locationName, setLocationName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const importer = importers.find((i) => i.id === importerId);
  const locationNames = [...new Set((importer?.landingLocations ?? []).map((l) => l.name || l.portOfDischarge).filter(Boolean))];
  const importerOptions: ComboOption[] = importers.map((i) => ({ value: i.id, label: i.name, description: i.currency }));
  const locationOptions: ComboOption[] = [{ value: '', label: 'All locations' }, ...locationNames.map((name) => ({ value: name, label: name }))];

  const chooseImporter = (id: string) => {
    setImporterId(id);
    setCurrency(importers.find((i) => i.id === id)?.currency ?? '');
    setLocationName('');
    setErrors({});
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = productListSchema.safeParse({ importerId, currency, ...(locationName ? { locationName } : {}) });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => { const k = String(issue.path[0]); if (!next[k]) next[k] = issue.message; });
      setErrors(next);
      return;
    }
    const twin = existing.find((l) => l.importerId === importerId && l.currency === parsed.data.currency && (l.locationName ?? '') === locationName);
    if (twin) { showToast('That list already exists', 'Opening it.', 'info'); onCreated(twin); return; }
    try {
      const { data } = await create.mutateAsync(parsed.data);
      showToast('List created', 'Now add its products.', 'success');
      if (data) onCreated(data);
    } catch (error) {
      showToast("Couldn't create the list", error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <form
        ref={panelRef as unknown as React.RefObject<HTMLFormElement>}
        role="dialog"
        aria-modal="true"
        aria-label="Create a product list"
        tabIndex={-1}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        noValidate
        className="w-full max-w-md rounded-t-2xl bg-background shadow-2xl outline-none sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b bg-gradient-to-r from-[hsl(var(--primary)/0.08)] to-[hsl(var(--brand-accent)/0.14)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Create a product list</h2>
            <p className="text-xs text-muted-foreground">For one importer and currency, and optionally one location.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="label">Importer</label>
            <SearchCombobox ariaLabel="Importer" value={importerId} onChange={chooseImporter} options={importerOptions} placeholder="Select an importer" searchPlaceholder="Search importers…" labelClassName="w-auto max-w-[70%] truncate" className="input" hasError={!!errors['importerId']} />
            {errors['importerId'] ? <p className="err">{errors['importerId']}</p> : null}
          </div>
          <div>
            <label className="label">Currency</label>
            <SearchCombobox ariaLabel="Currency" value={currency} onChange={setCurrency} options={currencies.all.map(toComboOption)} common={currencies.common.map(toComboOption)} placeholder="Select a currency" searchPlaceholder="Search currency, e.g. CAD" className="input" hasError={!!errors['currency']} />
            {errors['currency'] ? <p className="err">{errors['currency']}</p> : null}
          </div>
          <div>
            <label className="label">Location (optional)</label>
            <SearchCombobox ariaLabel="Location" value={locationName} onChange={setLocationName} options={locationOptions} placeholder={importerId ? 'All locations' : 'Choose an importer first'} display={locationName || (importerId ? 'All locations' : '')} disabled={!importerId} searchPlaceholder="Search locations…" labelClassName="w-auto max-w-[70%] truncate" className="input" />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t px-5 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={create.isPending} className="btn-brand disabled:opacity-50"><Plus className="h-4 w-4" /> {create.isPending ? 'Creating…' : 'Create list'}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
