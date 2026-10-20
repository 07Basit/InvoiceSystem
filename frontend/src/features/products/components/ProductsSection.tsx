import { Fragment, useMemo, useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff, Package, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { productSchema } from 'shared';
import { useProductMutations, useProducts } from '@/features/invoices/hooks/useProducts';
import type { Product } from '@/features/invoices/services/productService';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm';
import Tooltip from '@/components/ui/Tooltip';
import SearchCombobox from '@/components/ui/SearchCombobox';
import { cn } from '@/lib/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface FormState { name: string; ratePerKg: string }
const empty: FormState = { name: '', ratePerKg: '' };

/** "12" -> 12, "" -> undefined, "abc" -> NaN (the schema then reports it). */
const toNumber = (text: string) => (text.trim() === '' ? undefined : Number(text.trim().replace(/,/g, '')));
const plain = (value: string | null) => (value === null ? '' : String(Number(value)));

/** The price of a product as a short line ("6.5 per kg"), or nothing when the list has no price for it. */
export function productDetails(product: Pick<Product, 'ratePerKg'>): string {
  return product.ratePerKg !== null ? `${Number(product.ratePerKg)} per kg` : '';
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
  const [status, setStatus] = useState<'all' | 'active' | 'hidden'>('all');

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

  /** Choosing a general product also brings its price, when that box is still empty. */
  const chooseGeneral = (name: string) => {
    const general = (data?.data ?? []).find((p) => inScope(p, {}) && p.name === name);
    setForm((f) => ({ ...f, name, ratePerKg: f.ratePerKg || plain(general?.ratePerKg ?? null) }));
    setErrors((e) => ({ ...e, name: '' }));
  };
  const saving = create.isPending || update.isPending;
  const hiddenCount = products.filter((p) => !p.isActive).length;
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    // the product being edited always stays in view, even if the search or filter would hide it
    return products.filter((p) => p.id === editing || ((!q || p.name.toLowerCase().includes(q)) && (status === 'all' || (status === 'active') === p.isActive)));
  }, [products, search, status, editing]);

  const open = (product?: Product) => {
    setErrors({});
    setForm(product ? { name: product.name, ratePerKg: plain(product.ratePerKg) } : empty);
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
      ratePerKg: toNumber(form.ratePerKg),
      // weight and HS code are no longer shown here, but an edited product keeps the ones it already has
      ...(editedProduct?.nettWeightPerPackage != null ? { nettWeightPerPackage: Number(editedProduct.nettWeightPerPackage) } : {}),
      ...(editedProduct?.hsCode ? { hsCode: editedProduct.hsCode } : {}),
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

  // a long list gets a letter heading for each first letter (A, B, C ...) so it is easy to scan
  const letterOf = (p: Product | undefined) => (p ? (p.name.trim()[0] ?? '#').toUpperCase() : '');
  const groupByLetter = shown.length > 20;

  /** The add / edit form. A new product's form sits above the list; an edited product's form replaces its row. */
  const formEl = (
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
            <div className="sm:col-span-2"><Field id="pr-rate" label="Price per kg (optional)" value={form.ratePerKg} onChange={set('ratePerKg')} error={errors['ratePerKg']} numeric /></div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50"><Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save product'}</button>
            <button type="button" onClick={close} className="btn-ghost"><X className="h-4 w-4" /> Cancel</button>
          </div>
        </form>
  );

  return (
    <section className="card-enterprise">
      <div className="px-5 py-4 border-b flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{scopeLabel}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {scope.importerId
              ? 'Invoices for this importer offer these first. The price is filled in when a product is picked, and you can still change it on the invoice.'
              : 'Offered on every invoice after the importer\'s own products. The price is filled in when a product is picked.'}
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Stays at the top while the list scrolls, so searching and adding are always one click away */}
        <div className="sticky -top-4 z-10 -mx-5 -mt-5 border-b bg-card px-5 py-3 sm:-top-6">
          <div className="flex flex-wrap items-center gap-2">
            {products.length > 8 && (
              <div className="relative min-w-[10rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input aria-label="Search products" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9 pr-9" />
                {search && (
                  <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
                )}
              </div>
            )}
            {hiddenCount > 0 && (
              <div role="group" aria-label="Show" className="flex items-center gap-1">
                {([['all', `All (${products.length})`], ['active', `Active (${products.length - hiddenCount})`], ['hidden', `Not needed (${hiddenCount})`]] as const).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={cn('rounded-full border px-3 py-1.5 text-xs transition-colors', status === value ? 'border-[hsl(var(--brand-accent))]/60 bg-[hsl(var(--brand-accent))]/10 font-semibold text-[hsl(var(--brand-accent))]' : 'bg-background hover:bg-accent')}>{label}</button>
                ))}
              </div>
            )}
            {editing === null && (
              <button type="button" onClick={() => open()} className="btn-brand ml-auto shrink-0"><Plus className="h-4 w-4" /> Add product</button>
            )}
          </div>
          {products.length > 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground" aria-live="polite">
              {shown.length === products.length ? `${products.length} product${products.length === 1 ? '' : 's'}` : `Showing ${shown.length} of ${products.length}`}
            </p>
          )}
        </div>

        {editing === 'new' && formEl}

        {isLoading && <div className="flex justify-center py-8"><LoadingSpinner variant="products" message="Loading products…" /></div>}
        {isError && <p className="text-sm text-destructive">Failed to load products.</p>}
        {!isLoading && !isError && products.length === 0 && editing === null && (
          <div className="text-center py-6">
            <Package className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-semibold mt-2">No products here yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add the goods you export to this list so they can be picked on an invoice.</p>
          </div>
        )}
        {products.length > 0 && shown.length === 0 && <p className="text-sm text-muted-foreground">{search ? `No product matches “${search}”.` : 'Nothing to show with this filter.'}</p>}

        <ul className="divide-y rounded-lg border">
          {shown.map((product, index) => (
            <Fragment key={product.id}>
              {groupByLetter && letterOf(product) !== letterOf(shown[index - 1]) && (
                <li role="presentation" className="bg-muted/50 px-4 py-1 text-xs font-semibold text-muted-foreground">{letterOf(product)}</li>
              )}
              {editing === product.id ? (
                <li className="bg-muted/20 p-3">{formEl}</li>
              ) : (
                <li className={cn('flex items-center justify-between gap-3 px-4 py-2.5', !product.isActive && 'bg-muted/40')}>
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
              )}
            </Fragment>
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
