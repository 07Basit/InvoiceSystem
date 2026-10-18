import { useMemo } from 'react';
import SearchCombobox, { type ComboOption } from '@/components/ui/SearchCombobox';
import { useToast } from '@/components/ui/toast';
import { useProductMutations, useProducts } from '../hooks/useProducts';
import type { Product } from '../services/productService';
import { productDetails } from '@/features/auth/components/ProductsSection';

interface ProductPickerProps {
  /** The text on the invoice line (a saved product's name, or anything typed). */
  value: string;
  /** Called with the chosen or typed text, and the saved product when one was picked. */
  onSelect: (text: string, product: Product | undefined) => void;
  ariaLabel: string;
  hasError?: boolean;
  className?: string;
}

/** Description of Goods: pick from the saved products, or type something else and optionally save it for next time. */
export default function ProductPicker({ value, onSelect, ariaLabel, hasError, className }: ProductPickerProps) {
  const { data } = useProducts();
  const { create } = useProductMutations();
  const { showToast } = useToast();

  const products = useMemo(() => (data?.data ?? []).filter((p) => p.isActive), [data]);
  const options = useMemo<ComboOption[]>(
    () => products.map((p) => ({ value: p.name, label: p.name, description: productDetails(p) })),
    [products],
  );

  const addToProducts = async (name: string) => {
    try {
      await create.mutateAsync({ name });
      showToast('Product added', `${name} is now in your products.`, 'success');
    } catch (error) {
      showToast("Couldn't add the product", error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  return (
    <SearchCombobox
      value={value}
      display={value}
      onChange={(text) => onSelect(text, products.find((p) => p.name === text))}
      options={options}
      ariaLabel={ariaLabel}
      placeholder="Select or type a product"
      searchPlaceholder="Search products, or type a new one…"
      allowCustom
      onCreate={addToProducts}
      createTarget="products"
      labelClassName="max-w-[11rem] truncate"
      {...(hasError !== undefined ? { hasError } : {})}
      className={className ?? 'w-full rounded border bg-background px-2 py-1 text-xs'}
    />
  );
}
