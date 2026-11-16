import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Loader2, Plus, UploadCloud } from 'lucide-react';
import type { ParsedPurchase } from 'shared';
import AddSupplierDialog from '../components/AddSupplierDialog';
import PurchaseForm from '../components/PurchaseForm';
import { usePurchaseMutations, usePurchasedProducts, useSupplierMutations, useSuppliers } from '../hooks/usePurchases';
import { fromParsed, toDto, type PurchaseFormValues } from '../utils/purchaseForm';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const isExcel = (file: File) => /\.(xlsx|xls)$/i.test(file.name);

/** Upload an Excel invoice, check what was read from it, then approve and save. */
export default function PurchaseUploadPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: suppliers = [] } = useSuppliers();
  const { data: purchased = [] } = usePurchasedProducts();
  const { preview, create } = usePurchaseMutations();
  const { create: createSupplier } = useSupplierMutations();
  const [supplierId, setSupplierId] = useState('');
  const [parsed, setParsed] = useState<ParsedPurchase | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const readFile = (file: File | undefined) => {
    if (!file) return;
    if (!isExcel(file)) return showToast('Not an Excel file', 'Choose the invoice as a .xlsx or .xls file.', 'error');
    setSaveError(null);
    preview.mutate({ file, ...(supplierId ? { supplierId } : {}) }, {
      onSuccess: (result) => setParsed(result),
      onError: (error) => showToast('Could not read that file', error.message, 'error'),
    });
  };

  const save = (values: PurchaseFormValues) => {
    setSaveError(null);
    create.mutate(toDto(values), {
      onSuccess: (saved) => { showToast('Purchase saved', `${saved.supplierName} · ${saved.invoiceNumber} was added.`, 'success'); navigate('/purchases'); },
      onError: (error) => setSaveError(error.message),
    });
  };

  const addSupplier = async (name: string) => {
    try {
      const created = await createSupplier.mutateAsync({ name });
      showToast('Supplier added', `${created.name} is now in your suppliers.`, 'success');
      return created.id;
    } catch (error) {
      showToast('Could not add the supplier', (error as Error).message, 'error');
      return null;
    }
  };

  if (parsed) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Check the invoice</h2>
            <p className="text-sm text-muted-foreground">Read from <span className="font-medium">{parsed.fileName}</span> (sheet “{parsed.sheetName}”). Correct anything that is wrong, then approve.</p>
          </div>
          <button type="button" onClick={() => { setParsed(null); setSaveError(null); }} className="btn-ghost">Choose another file</button>
        </div>
        <PurchaseForm
          key={parsed.fileHash}
          initial={fromParsed(parsed)}
          suppliers={suppliers}
          productSuggestions={purchased.map((p) => p.product)}
          warnings={parsed.warnings}
          duplicates={parsed.duplicates}
          supplierGuess={parsed.supplierGuess}
          onAddSupplier={addSupplier}
          saving={create.isPending}
          error={saveError}
          saveLabel="Approve and save"
          onSave={save}
          onCancel={() => setParsed(null)}
        />
      </div>
    );
  }

  return (
    <div className="card-enterprise mx-auto max-w-2xl space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Upload a purchase invoice</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Upload the Excel invoice from your supplier. The details are read automatically, and you check them before anything is saved.</p>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="label !mb-0" htmlFor="upload-supplier">Supplier</label>
          <button type="button" onClick={() => setAddingSupplier(true)} className="btn-brand !px-2.5 !py-1 text-xs"><Plus className="h-3.5 w-3.5" /> New supplier</button>
        </div>
        <select id="upload-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input">
          <option value="">Detect from the file</option>
          {suppliers.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); readFile(e.dataTransfer.files[0]); }}
        className={cn('flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors', dragging ? 'border-primary bg-primary/5' : 'border-border')}
      >
        {preview.isPending ? (
          <>
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium">Reading the invoice…</p>
          </>
        ) : (
          <>
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><FileSpreadsheet className="h-6 w-6" /></span>
            <p className="text-sm font-medium">Drop the Excel invoice here</p>
            <p className="mt-1 text-xs text-muted-foreground">.xlsx or .xls, up to 10 MB</p>
            <button type="button" onClick={() => picker.current?.click()} className="btn-brand mt-4"><UploadCloud className="h-4 w-4" /> Choose a file</button>
          </>
        )}
        <input ref={picker} type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" aria-label="Choose an Excel invoice" onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      <p className="text-xs text-muted-foreground">
        If a file is not read correctly, correct it on the next screen, or enter the invoice by hand from the Invoices page.
      </p>
      {addingSupplier && <AddSupplierDialog onClose={() => setAddingSupplier(false)} onAdded={(s) => { setSupplierId(s.id); setAddingSupplier(false); showToast('Supplier added', `${s.name} was added.`, 'success'); }} />}
    </div>
  );
}
