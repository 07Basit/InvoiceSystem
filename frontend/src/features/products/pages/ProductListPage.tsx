import { useNavigate, useParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useClients } from '@/features/clients/hooks/useClients';
import { useProducts } from '@/features/invoices/hooks/useProducts';
import { useProductListMutations, useProductLists } from '@/features/invoices/hooks/useProductLists';
import { useConfirm } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import ProductsSection, { inScope } from '../components/ProductsSection';
import { listScope } from './ProductsPage';

/** One list in detail: its products, with add, edit, hide and delete. */
export default function ProductListPage() {
  const { listId = '' } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { data: importersData } = useClients({ limit: 100, sort: 'name' });
  const { data: listData, isLoading } = useProductLists();
  const { data: productData } = useProducts();
  const { remove } = useProductListMutations();

  const isGeneral = listId === 'general';
  const list = (listData?.data ?? []).find((l) => l.id === listId);
  const importer = list ? (importersData?.data ?? []).find((i) => i.id === list.importerId) : undefined;

  if (!isGeneral && isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (!isGeneral && !list) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Breadcrumbs items={[{ label: 'Products', to: '/products' }, { label: 'List not found' }]} />
        <p className="py-12 text-center text-sm text-muted-foreground">This list was not found. It may have been deleted.</p>
      </div>
    );
  }

  const title = isGeneral ? 'General list' : importer?.name ?? 'Importer';
  const subtitle = isGeneral ? 'Offered on every invoice, after the importer\'s own products.' : [list!.currency, list!.locationName || 'All locations'].join(' · ');
  const scope = isGeneral ? {} : listScope(list!);
  const count = (productData?.data ?? []).filter((p) => inScope(p, scope)).length;

  const askDelete = async () => {
    if (!list) return;
    const ok = await confirm({
      title: `Delete the list for ${title}?`,
      message: `${subtitle}. Its ${count} product${count === 1 ? '' : 's'} will be deleted too. Invoices keep their own copy of product names.`,
      confirmLabel: 'Delete list',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(list.id);
      showToast('List deleted', title, 'success');
      navigate('/products');
    } catch (error) {
      showToast("Couldn't delete the list", error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Breadcrumbs items={[{ label: 'Products', to: '/products' }, { label: isGeneral ? 'General list' : [title, subtitle].join(' · ') }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">{title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        {!isGeneral && (
          <button type="button" onClick={askDelete} disabled={remove.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> Delete list
          </button>
        )}
      </div>

      <ProductsSection key={listId} scope={scope} scopeLabel="Products" />
    </div>
  );
}
