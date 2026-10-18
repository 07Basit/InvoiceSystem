import { useMemo } from 'react';
import SearchCombobox, { type ComboOption } from '@/components/ui/SearchCombobox';
import { useToast } from '@/components/ui/toast';
import { useProductMutations, useProducts } from '../hooks/useProducts';
import type { Product } from '../services/productService';
import { productDetails, inScope } from '@/features/products/components/ProductsSection';

/** The list the products come from: nothing = the general list; otherwise one importer, currency and (optionally) location. */
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
  /** The list chosen on the invoice (see ProductPickerScope) */
  scope?: ProductPickerScope;
}

/** Description of Goods: pick from the chosen product list, or type something else and optionally save it to that list. */
export default function ProductPicker({ value, onSelect, ariaLabel, hasError, className, scope = {} }: ProductPickerProps) {
  const { data } = useProducts();
  const { create } = useProductMutations();
  const { showToast } = useToast();
  const { importerId, currency, locationName } = scope;

  const inList = useMemo(
    () => (data?.data ?? []).filter((p) => p.isActive && inScope(p, { importerId, currency, locationName })),
    [data, importerId, currency, locationName],
  );
  const options = useMemo<ComboOption[]>(
    () => inList.map((p) => ({ value: p.name, label: p.name, description: productDetails(p) })),
    [inList],
  );

  const addToList = async (name: string) => {
    try {
      await create.mutateAsync({ name, ...(importerId ? { importerId } : {}), ...(importerId && currency ? { currency } : {}), ...(importerId && currency && locationName ? { locationName } : {}) });
      showToast('Product added', `${name} is now in ${importerId ? "this importer's list" : 'the general list'}.`, 'success');
    } catch (error) {
      showToast("Couldn't add the product", error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  return (
    <SearchCombobox
      value={value}
      display={value}
      onChange={(text) => onSelect(text, inList.find((p) => p.name === text))}
      options={options}
      ariaLabel={ariaLabel}
      placeholder="Select or type a product"
      searchPlaceholder="Search this list, or type a new product…"
      allowCustom
      onCreate={addToList}
      createTarget={importerId ? "this importer's list" : 'the general list'}
      labelClassName="max-w-[11rem] truncate"
      {...(hasError !== undefined ? { hasError } : {})}
      className={className ?? 'w-full rounded border bg-background px-2 py-1 text-xs'}
    />
  );
}
