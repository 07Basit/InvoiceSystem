import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PriceOverview from '../components/PriceOverview';
import ProductPriceDetail from '../components/ProductPriceDetail';
import PurchaseFilterPanel from '../components/PurchaseFilterPanel';
import { useSuppliers } from '../hooks/usePurchases';
import { noPurchaseFilters, type PurchaseFilterValues } from '../utils/purchaseFilters';

/**
 * Price tracker: every product as a card (latest rate, trend, cheapest supplier); open one to see supplier against supplier,
 * what it was sold for and every purchase. The date and supplier filters stay while moving between the two.
 */
export default function PriceTrackerPage() {
  const [params, setParams] = useSearchParams();
  const product = params.get('product') ?? '';
  const { data: suppliers = [] } = useSuppliers();
  const [filters, setFilters] = useState<PurchaseFilterValues>(noPurchaseFilters);
  const [panelOpen, setPanelOpen] = useState(false);
  const [count, setCount] = useState<number | undefined>();

  return (
    <>
      {product ? (
        <ProductPriceDetail product={product} filters={filters} onOpenFilters={() => setPanelOpen(true)} />
      ) : (
        <PriceOverview filters={filters} onFiltersChange={setFilters} onOpenFilters={() => setPanelOpen(true)} onOpenProduct={(name) => setParams({ product: name })} onCount={setCount} />
      )}
      <PurchaseFilterPanel open={panelOpen} onClose={() => setPanelOpen(false)} filters={filters} onChange={setFilters} suppliers={suppliers} show={{ supplier: true }} matching={product ? undefined : count} noun="product" />
    </>
  );
}
