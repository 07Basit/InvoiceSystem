import { useMemo, useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff, Package, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { productSchema } from 'shared';
import { useProductMutations, useProducts } from '@/features/invoices/hooks/useProducts';
import type { Product } from '@/features/invoices/services/productService';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm';
import Tooltip from '@/components/ui/Tooltip';
import SearchCombobox from '@/components/ui/SearchCombobox';
import { cn } from '@/lib/utils';

interface FormState { name: string; nettWeightPerPackage: string; ratePerKg: string; hsCode: string }
const empty: FormState = { name: '', nettWeightPerPackage: '', ratePerKg: '', hsCode: '' };

/** "12" -> 12, "" -> undefined, "abc" -> NaN (the schema then reports it). */
const toNumber = (text: string) => (text.trim() === '' ? undefined : Number(text.trim().replace(/,/g, '')));
const plain = (value: string | null) => (value === null ? '' : String(Number(value)));

/** The usual weight and rate of a product, as a short line ("10 kg · 6.50 per kg"). */
export function productDetails(product: Pick<Product, 'nettWeightPerPackage' | 'ratePerKg' | 'hsCode'>): string {
  return [
    product.nettWeightPerPackage !== null ? `${Number(product.nettWeightPerPackage)} kg` : '',
    product.ratePerKg !== null ? `${Number(product.ratePerKg)} per kg` : '',
    product.hsCode ? `HS ${product.hsCode}` : '',
  ].filter(Boolean).join(' · ');
}

/** Which list is being managed: the general list (nothing set), or one importer, optionally with a currency and a landing location. */
export interface ProductScope {
  importerId?: string | undefined;
  currency?: string | undefined;
  locationName?: string | undefined;
}

/** Does this product belong to exactly this list? */
export const inScope = (product: Pick<Product, 'importerId' | 'currency' | 'locationName'>, scope: ProductScope) =>
  (product.importerId ?? undefined) === scope.importerId
  && (product.currency ?? undefined) === scope.currency
  && (product.locationName ?? undefined) === scope.locationName;

const scopeFields = (scope: ProductScope) => ({
  ...(scope.importerId ? { importerId: scope.importerId } : {}),
  ...(scope.currency ? { currency: scope.currency } : {}),
  ...(scope.locationName ? { locationName: scope.locationName } : {}),
});

/** The products of one list (see ProductScope): add, edit, hide and delete them. */
export default function ProductsSection({ scope = {}, scopeLabel = 'General list' }: { scope?: ProductScope; scopeLabel?: string }) {
  const { data, isLoading, isError } = useProducts();
  const { create, update, setActive, remove } = useProductMutations();
  const { showToast } = useToast();
  const confirm = useConfirm();

  // null = form closed, 'new' = adding, otherwise the id being edited
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  const products = (data?.data ?? []).filter((p) => inScope(p, scope));
  // An importer's list is built from the general list: its product names come from there
  const fromGeneral = !!scope.importerId;
  const generalOptions = useMemo(() => {
    const taken = new Set(products.filter((p) => p.id !== editing).map((p) => p.name.toLowerCase()));
    return (data?.data ?? [])
      .filter((p) => inScope(p, {}) && p.isActive && !taken.has(p.name.toLowerCase()))
      .map((p) => ({ value: p.name, label: p.name, description: productDetails(p) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, products.length, editing]);

  /** Choosing a general product also brings its usual weight, rate and HS code, where those boxes are still empty. */
  const chooseGeneral = (name: string) => {
    const general = (data?.data ?? []).find((p) => inScope(p, {}) && p.name === name);
    setForm((f) => ({
      ...f,
      name,
      nettWeightPerPackage: f.nettWeightPerPackage || plain(general?.nettWeightPerPackage ?? null),
      ratePerKg: f.ratePerKg || plain(general?.ratePerKg ?? null),
      hsCode: f.hsCode || (general?.hsCode ?? ''),
    }));
    setErrors((e) => ({ ...e, name: '' }));
  };
  const saving = create.isPending || update.isPending;
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
  }, [products, search]);

  const open = (product?: Product) => {
    setErrors({});
    setForm(product ? { name: product.name, nettWeightPerPackage: plain(product.nettWeightPerPackage), ratePerKg: plain(product.ratePerKg), hsCode: product.hsCode ?? '' } : empty);
    setEditing(product ? product.id : 'new');
  };
  const close = () => { setEditing(null); setErrors({}); };
  const set = (field: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // an edited product keeps the list it is in
    const editedProduct = editing && editing !== 'new' ? (data?.data ?? []).find((p) => p.id === editing) : undefined;
    const parsed = productSchema.safeParse({
      ...scopeFields(editedProduct ? { importerId: editedProduct.importerId ?? undefined, currency: editedProduct.currency ?? undefined, locationName: editedProduct.locationName ?? undefined } : scope),
      name: form.name,
      nettWeightPerPackage: toNumber(form.nettWeightPerPackage),
      ratePerKg: toNumber(form.ratePerKg),
      hsCode: form.hsCode.trim() || undefined,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => { const k = String(issue.path[0]); if (!next[k]) next[k] = issue.message; });
      setErrors(next);
      return;
    }
    try {
      if (editing === 'new') await create.mutateAsync(parsed.data);
      else if (editing) await update.mutateAsync({ id: editing, dto: parsed.data });
      showToast(editing === 'new' ? 'Product added' : 'Product updated', parsed.data.name, 'success');
      close();
    } catch (err) {
      showToast('Unable to save product', err instanceof Error ? err.message : 'Please try again.', 'error');
    }
  };

  const toggleActive = async (product: Product) => {
    const makeInactive = product.isActive;
    try {
      await setActive.mutateAsync({ id: product.id, isActive: !makeInactive });
      showToast(makeInactive ? 'Marked as not needed' : 'Product is active again', makeInactive ? `${product.name} won't be offered on invoices.` : `${product.name} can be picked on invoices again.`, 'success');
    } catch {
      showToast('Unable to update product', 'Please try again.', 'error');
    }
  };

  const askRemove = async (product: Product) => {
    const ok = await confirm({
      title: `Delete ${product.name}?`,
      message: 'Existing invoices keep their own copy of the product name. Only the saved product is removed.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(product.id);
      showToast('Product deleted', product.name, 'success');
    } catch {
      showToast('Unable to delete product', 'Please try again.', 'error');
    }
  };

  return (
    <section className="card-enterprise">
      <div className="px-5 py-4 border-b flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{scopeLabel}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {scope.importerId
              ? 'Invoices for this importer offer these first. The usual weight and rate are filled in when a product is picked, and you can still change them on the invoice.'
              : 'Offered on every invoice after the importer\'s own products. The usual weight and rate are filled in when a product is picked.'}
          </p>
        </div>
        {editing === null && (
          <button type="button" onClick={() => open()} className="btn-brand shrink-0"><Plus className="h-4 w-4" /> Add product</button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {editing !== null && (
          <form onSubmit={submit} className="rounded-lg border p-4 space-y-4" aria-label={editing === 'new' ? 'New product' : 'Edit product'} noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                {fromGeneral ? (
                  <>
                    <label className="label">Product name</label>
                    <SearchCombobox
                      ariaLabel="Product name"
                      value={form.name}
                      onChange={chooseGeneral}
                      options={generalOptions}
                      placeholder={generalOptions.length ? 'Select a product from the general list' : 'Every general product is already in this list'}
                      searchPlaceholder="Search the general list…"
                      labelClassName="w-auto max-w-[70%] truncate"
                      className="input"
                      hasError={!!errors['name']}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">Products come from the General list. To use a new name, add it to the General list first.</p>
                    {errors['name'] ? <p className="err">{errors['name']}</p> : null}
                  </>
                ) : (
                  <Field id="pr-name" label="Product name" value={form.name} onChange={set('name')} error={errors['name']} />
                )}
              </div>
              <Field id="pr-weight" label="Usual nett weight per package, kg (optional)" value={form.nettWeightPerPackage} onChange={set('nettWeightPerPackage')} error={errors['nettWeightPerPackage']} numeric />
              <Field id="pr-rate" label="Usual rate per kg (optional)" value={form.ratePerKg} onChange={set('ratePerKg')} error={errors['ratePerKg']} numeric />
              <Field id="pr-hs" label="HS code (optional)" value={form.hsCode} onChange={set('hsCode')} error={errors['hsCode']} />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50"><Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save product'}</button>
              <button type="button" onClick={close} className="btn-ghost"><X className="h-4 w-4" /> Cancel</button>
            </div>
          </form>
        )}

        {products.length > 8 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Search products" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9" />
          </div>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Loading products…</p>}
        {isError && <p className="text-sm text-destructive">Failed to load products.</p>}
        {!isLoading && !isError && products.length === 0 && editing === null && (
          <div className="text-center py-6">
            <Package className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-semibold mt-2">No products here yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add the goods you export to this list so they can be picked on an invoice.</p>
          </div>
        )}
        {products.length > 0 && shown.length === 0 && <p className="text-sm text-muted-foreground">No product matches “{search}”.</p>}

        <ul className="max-h-[28rem] divide-y overflow-y-auto rounded-lg border">
          {shown.map((product) => (
            <li key={product.id} className={cn('flex items-center justify-between gap-3 px-4 py-2.5', !product.isActive && 'bg-muted/40')}>
              <div className={cn('min-w-0 text-sm', !product.isActive && 'opacity-60')}>
                <p className="font-medium truncate">{product.name}</p>
                {productDetails(product) ? <p className="text-xs text-muted-foreground truncate">{productDetails(product)}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!product.isActive && <span className="mr-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">Not needed</span>}
                <Tooltip label={product.isActive ? 'Mark as not needed (hide from invoice dropdown)' : 'Inactive. Click to make active again'}>
                  <button type="button" aria-label={product.isActive ? `Mark ${product.name} as not needed` : `Make ${product.name} active again`} onClick={() => toggleActive(product)} className="btn-ghost !p-2">
                    {product.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-emerald-600" />}
                  </button>
                </Tooltip>
                <Tooltip label="Edit"><button type="button" aria-label={`Edit ${product.name}`} onClick={() => open(product)} className="btn-ghost !p-2"><Pencil className="h-4 w-4" /></button></Tooltip>
                <Tooltip label="Delete"><button type="button" aria-label={`Delete ${product.name}`} onClick={() => askRemove(product)} className="btn-ghost !p-2 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></button></Tooltip>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Field({ id, label, value, onChange, error, numeric }: { id: string; label: string; value: string; onChange: (v: string) => void; error: string | undefined; numeric?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} value={value} inputMode={numeric ? 'decimal' : undefined} onChange={(e) => onChange(e.target.value)} className="input" aria-invalid={error ? true : undefined} />
      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}
