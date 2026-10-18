import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '../hooks/useInvoices';
import { useInvoiceStore } from '../store/invoiceStore';
import { useInvoiceDocuments } from '../hooks/useInvoiceDocuments';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { FileDown } from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import { INVOICES_TWO_COLUMNS_FROM, scrollMainToTop, usePageSize } from '@/lib/pagination';
import InvoiceCard from './InvoiceCard';
import ShareInvoiceDialog, { toShareable, type ShareableInvoice } from './ShareInvoiceDialog';
import ShareInvoicesDialog from './ShareInvoicesDialog';
import InvoiceSelectionStrip from './InvoiceSelectionStrip';
import InvoiceSelectionBar, { type DownloadFormat } from './InvoiceSelectionBar';
import { invoiceService } from '../services/invoiceService';
import { saveBlob } from '@/lib/share';
import { useBulkDeleteInvoices, useCreateActualInvoice, useDeleteInvoice } from '../hooks/useInvoices';
import { useConfirm } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';

export default function InvoiceTable() {
  const { search, filters, page, setPage, openEditForm, clearFilters, selectionMode, selectedIds, toggleSelected, setSelected, clearSelection } = useInvoiceStore();
  const pageSize = usePageSize(INVOICES_TWO_COLUMNS_FROM);
  const matching = {
    ...(search ? { search } : {}),
    ...(filters.year ? { year: Number(filters.year) } : {}),
    ...(filters.month ? { month: Number(filters.month) } : {}),
    ...(filters.importerId ? { importerId: filters.importerId } : {}),
    ...(filters.currency ? { currency: filters.currency } : {}),
  };
  const { data, isLoading, isError } = useInvoices({ ...matching, page, limit: pageSize });

  // A different screen size means different page boundaries, so start again from page 1.
  const lastPageSize = useRef(pageSize);
  useEffect(() => {
    if (lastPageSize.current !== pageSize) {
      lastPageSize.current = pageSize;
      setPage(1);
    }
  }, [pageSize, setPage]);

  // If the last card on the last page was just deleted, step back to the new last page.
  const totalPages = data?.meta?.totalPages ?? 0;
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);

  const changePage = (next: number) => {
    setPage(next);
    scrollMainToTop();
  };
  const isFiltering = search !== '' || Object.values(filters).some((v) => v !== '');
  const deleteMutation = useDeleteInvoice();
  const navigate = useNavigate();
  const documents = useInvoiceDocuments();
  const [sharing, setSharing] = useState<ShareableInvoice | null>(null);
  const confirm = useConfirm();
  const createActualMutation = useCreateActualInvoice();
  const { showToast } = useToast();
  const askCreateActual = async (id: string, invoiceNumber: string) => {
    const ok = await confirm({
      title: `Create the actual invoice for ${invoiceNumber}?`,
      message: `A full copy named ACTUAL ${invoiceNumber} is created with all the same details. Only one actual invoice can be made from an invoice.`,
      confirmLabel: 'Create actual invoice',
    });
    if (!ok) return;
    try {
      await createActualMutation.mutateAsync(id);
      showToast('Actual invoice created', `ACTUAL ${invoiceNumber} is ready.`, 'success');
    } catch (error) {
      showToast("Couldn't create the actual invoice", error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };
  const askDelete = async (id: string, invoiceNumber: string) => {
    const ok = await confirm({
      title: `Delete invoice ${invoiceNumber}?`,
      message: 'The invoice moves to the Recycle Bin, where you can restore it.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) deleteMutation.mutate(id);
  };
  const openInvoice = (id: string) => navigate(`/invoices/${id}`);

  // --- selection mode: several invoices at once ---
  const bulkDelete = useBulkDeleteInvoices();
  const [sharingMany, setSharingMany] = useState<string[] | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const selectAllMatching = async () => {
    setSelectingAll(true);
    try {
      const { ids, truncated } = await invoiceService.listIds(matching);
      setSelected(ids, true);
      if (truncated) showToast('Selection limit reached', `The first ${ids.length} matching invoices were selected.`, 'info');
    } catch (error) {
      showToast("Couldn't select all", error instanceof Error ? error.message : 'Please try again.', 'error');
    } finally {
      setSelectingAll(false);
    }
  };

  const downloadSelected = async (formats: DownloadFormat[]) => {
    setBulkBusy(true);
    try {
      if (selectedIds.length === 1 && formats.length === 1) {
        const id = selectedIds[0]!;
        await (formats[0] === 'pdf' ? invoiceService.downloadPdf(id) : invoiceService.downloadExcel(id));
        showToast(formats[0] === 'pdf' ? 'PDF ready' : 'Excel ready', 'The invoice was downloaded.', 'success');
      } else {
        const { blob, filename } = await invoiceService.getZip(selectedIds, formats);
        saveBlob(blob, filename);
        showToast('ZIP ready', `${selectedIds.length} invoices were downloaded in ${filename}.`, 'success');
      }
    } catch (error) {
      showToast("Couldn't download", error instanceof Error ? error.message : 'Please try again.', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const deleteSelected = async () => {
    const count = selectedIds.length;
    const ok = await confirm({
      title: `Delete ${count} invoice${count === 1 ? '' : 's'}?`,
      message: 'The invoices move to the Recycle Bin, where you can restore them.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      const result = await bulkDelete.mutateAsync(selectedIds);
      if (result.failed.length === 0) showToast('Invoices deleted', `${result.deleted.length} moved to the Recycle Bin.`, 'success');
      else showToast(`${result.deleted.length} deleted, ${result.failed.length} couldn't be deleted`, result.failed[0]!.message, 'error');
      // keep only what is still there (the ones that failed) ticked
      setSelected(result.deleted, false);
    } catch (error) {
      showToast("Couldn't delete the invoices", error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (isError) return <div className="text-center py-16 text-destructive">Failed to load invoices.</div>;

  const invoices = data?.data ?? [];
  const meta = data?.meta;
  const pageIds = invoices.map((i) => i.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
          <FileDown className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-semibold text-foreground">{isFiltering ? 'No invoices match your search or filters' : 'No invoices found'}</p>
        <p className="text-xs text-muted-foreground mt-1">{isFiltering ? 'Try a different year, month, importer or currency.' : 'Create your first invoice to get started.'}</p>
        {isFiltering && <button onClick={clearFilters} className="mt-3 text-sm font-semibold underline">Clear search and filters</button>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selectionMode && (
        <InvoiceSelectionStrip
          selected={selectedIds.length}
          pageCount={pageIds.length}
          pageSelected={pageIds.filter((id) => selectedIds.includes(id)).length}
          totalMatching={meta?.total ?? 0}
          onSelectPage={() => setSelected(pageIds, !allOnPage)}
          onSelectAllMatching={selectAllMatching}
          onClear={clearSelection}
          selectingAll={selectingAll}
        />
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {invoices.map((invoice) => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
            deleting={deleteMutation.isPending}
            onOpen={() => openInvoice(invoice.id)}
            documentsBusy={documents.isBusy}
            onPrint={() => documents.print(invoice.id)}
            onShare={() => setSharing(toShareable(invoice))}
            onCreateActual={() => askCreateActual(invoice.id, invoice.invoiceNumber)}
            creatingActual={createActualMutation.isPending}
            onPdf={() => documents.downloadPdf(invoice.id)}
            onExcel={() => documents.downloadExcel(invoice.id)}
            onEdit={() => openEditForm(invoice.id)}
            onDelete={() => askDelete(invoice.id, invoice.invoiceNumber)}
            selectionMode={selectionMode}
            selected={selectedIds.includes(invoice.id)}
            onToggleSelect={() => toggleSelected(invoice.id)}
          />
        ))}
      </div>

      {meta && (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.limit} onPageChange={changePage} noun="invoices" />
      )}
      {selectionMode && selectedIds.length > 0 && (
        <InvoiceSelectionBar
          count={selectedIds.length}
          onClear={clearSelection}
          onDownload={downloadSelected}
          onShare={() => setSharingMany([...selectedIds])}
          onDelete={deleteSelected}
          busy={bulkBusy || bulkDelete.isPending}
        />
      )}
      {sharing && <ShareInvoiceDialog invoice={sharing} onClose={() => setSharing(null)} />}
      {sharingMany && <ShareInvoicesDialog ids={sharingMany} onClose={() => setSharingMany(null)} />}
    </div>
  );
}
