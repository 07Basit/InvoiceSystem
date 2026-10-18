import { useMemo } from 'react';
import SearchCombobox, { type ComboOption } from '@/components/ui/SearchCombobox';
import { useToast } from '@/components/ui/toast';
import { useProductMutations, useProducts } from '../hooks/useProducts';
import type { Product } from '../services/productService';
import { productDetails } from '@/features/products/components/ProductsSection';

/** What the invoice is for: its importer, currency and landing location decide which products are offered first. */
export interface ProductPickerScope {
  importerId?: string | undefined;
  currency?: string | undefined;
  locationName?: string | undefined;
}

interface ProductPickerProps {
  /** The text on the invoice line (a saved product's name, or anything typed). */
  value: string;
  /** Called with the chosen or typed text, and the saved product when one was picked. */
  onSelect: (text: string, product: Product | undefined) => void;
  ariaLabel: string;
  hasError?: boolean;
  className?: string;
  scope?: ProductPickerScope;
}

/** An importer's product is offered when it matches the invoice's currency and location (or doesn't name one). */
export function matchesScope(product: Product, scope: ProductPickerScope): boolean {
  return !!scope.importerId
    && product.importerId === scope.importerId
    && (!product.currency || product.currency === scope.currency)
    && (!product.locationName || product.locationName === scope.locationName);
}

/** Description of Goods: pick from this importer's products first, then the general list, or type something else and optionally save it. */
export default function ProductPicker({ value, onSelect, ariaLabel, hasError, className, scope = {} }: ProductPickerProps) {
  const { data } = useProducts();
  const { create } = useProductMutations();
  const { showToast } = useToast();
  const { importerId, currency, locationName } = scope;

  const { forImporter, general } = useMemo(() => {
    const active = (data?.data ?? []).filter((p) => p.isActive);
    const mine = active.filter((p) => matchesScope(p, { importerId, currency, locationName }));
    const taken = new Set(mine.map((p) => p.name.toLowerCase()));
    // the more specific entry wins when the same name is saved twice
    mine.sort((a, b) => Number(!!b.locationName) - Number(!!a.locationName) || Number(!!b.currency) - Number(!!a.currency));
    const unique = mine.filter((p, i) => mine.findIndex((q) => q.name.toLowerCase() === p.name.toLowerCase()) === i);
    return { forImporter: unique, general: active.filter((p) => !p.importerId && !taken.has(p.name.toLowerCase())) };
  }, [data, importerId, currency, locationName]);

  const toOption = (p: Product): ComboOption => ({ value: p.name, label: p.name, description: productDetails(p) });
  const common = useMemo(() => forImporter.map(toOption), [forImporter]);
  const options = useMemo(() => [...common, ...general.map(toOption)], [common, general]);

  const addToProducts = async (name: string) => {
    try {
      // saved to this importer's list when there is one, otherwise to the general list
      await create.mutateAsync({ name, ...(importerId ? { importerId } : {}), ...(importerId && currency ? { currency } : {}), ...(importerId && currency && locationName ? { locationName } : {}) });
      showToast('Product added', `${name} is now in ${importerId ? "this importer's" : 'your'} products.`, 'success');
    } catch (error) {
      showToast("Couldn't add the product", error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  return (
    <SearchCombobox
      value={value}
      display={value}
      onChange={(text) => onSelect(text, forImporter.find((p) => p.name === text) ?? general.find((p) => p.name === text))}
      options={options}
      common={common}
      commonLabel="For this importer"
      ariaLabel={ariaLabel}
      placeholder="Select or type a product"
      searchPlaceholder="Search products, or type a new one…"
      allowCustom
      onCreate={addToProducts}
      createTarget={importerId ? "this importer's products" : 'products'}
      labelClassName="max-w-[11rem] truncate"
      {...(hasError !== undefined ? { hasError } : {})}
      className={className ?? 'w-full rounded border bg-background px-2 py-1 text-xs'}
    />
  );
}
