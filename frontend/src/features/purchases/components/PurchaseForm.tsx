import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import type { DuplicateMatch } from 'shared';
import DatePicker from '@/components/ui/DatePicker';
import NumberInput from '@/components/ui/NumberInput';
import { cn } from '@/lib/utils';
import type { Supplier } from '../services/purchaseService';
import ConnectedInvoicePicker from './ConnectedInvoicePicker';
import { blankLine, expectedTotal, lineAmount, problemsOf, round2, sumLines, type FormLine, type PurchaseFormValues } from '../utils/purchaseForm';
import { dateLabel, inr } from '../utils/format';

interface PurchaseFormProps {
  initial: PurchaseFormValues;
  suppliers: Supplier[];
  /** Product names offered while typing a product */
  productSuggestions: string[];
  warnings?: string[];
  duplicates?: DuplicateMatch[];
  /** A supplier name the file mentions that matches no saved supplier */
  supplierGuess?: string | null;
  onAddSupplier?: (name: string) => Promise<string | null>;
  saving: boolean;
  /** An error from the last save, shown above the buttons */
  error?: string | null;
  saveLabel: string;
  onSave: (values: PurchaseFormValues) => void;
  onCancel: () => void;
}

/** Keeps the subtotal and total in step with the products and charges, unless someone has typed their own figure. */
function resync(prev: PurchaseFormValues, next: PurchaseFormValues): PurchaseFormValues {
  const subTotal = next.subTotal === undefined || next.subTotal === sumLines(prev.lines) ? sumLines(next.lines) : next.subTotal;
  const withSub = { ...next, subTotal };
  const total = next.total === undefined || next.total === expectedTotal(prev) ? expectedTotal(withSub) : next.total;
  return { ...withSub, total };
}

const Field: React.FC<{ label: string; htmlFor?: string; children: React.ReactNode; hint?: React.ReactNode }> = ({ label, htmlFor, children, hint }) => (
  <div>
    <label className="label" htmlFor={htmlFor}>{label}</label>
    {children}
    {hint}
  </div>
);

/** Hint under a total that differs from what the figures above it add up to, with a button to take that figure. */
const Suggest: React.FC<{ text: string; value: number; current: number | undefined; onUse: () => void }> = ({ text, value, current, onUse }) =>
  current !== undefined && Math.abs(current - value) <= 0.009 ? null : (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-amber-700">
      {text} {inr(value)}
      <button type="button" onClick={onUse} className="rounded border border-amber-300 px-1.5 py-0.5 font-medium hover:bg-amber-50">Use {inr(value)}</button>
    </p>
  );

/** The purchase invoice form: used to review what was read from an Excel file, to edit a saved invoice and to enter one by hand. */
const PurchaseForm: React.FC<PurchaseFormProps> = ({ initial, suppliers, productSuggestions, warnings = [], duplicates = [], supplierGuess, onAddSupplier, saving, error, saveLabel, onSave, onCancel }) => {
  const [values, setValues] = useState<PurchaseFormValues>(initial);
  const [tried, setTried] = useState(false);
  const [addingSupplier, setAddingSupplier] = useState(false);

  const change = (patch: Partial<PurchaseFormValues>) => setValues((prev) => resync(prev, { ...prev, ...patch }));
  const changeLine = (key: string, patch: Partial<FormLine>) =>
    setValues((prev) => {
      const lines = prev.lines.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        // the amount follows the rate and the weight (or quantity), unless the amount itself was edited
        const touched = 'rate' in patch || 'netWeight' in patch || 'quantity' in patch || 'rateBasis' in patch;
        const amount = touched ? lineAmount(next) : undefined;
        return touched && amount !== undefined ? { ...next, amount } : next;
      });
      return resync(prev, { ...prev, lines });
    });
  const removeLine = (key: string) => setValues((prev) => resync(prev, { ...prev, lines: prev.lines.length > 1 ? prev.lines.filter((l) => l.key !== key) : [blankLine()] }));
  const addLine = () => setValues((prev) => ({ ...prev, lines: [...prev.lines, blankLine()] }));

  const linesSum = sumLines(values.lines);
  const expected = expectedTotal(values);
  const problems = useMemo(() => problemsOf(values), [values]);
  const blocked = duplicates.length > 0;
  const activeSuppliers = suppliers.filter((s) => s.isActive || s.id === values.supplierId);
  const weight = values.lines.reduce((sum, l) => sum + (l.netWeight ?? 0), 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (problems.length === 0 && !blocked) onSave(values);
  };

  const addGuess = async () => {
    if (!supplierGuess || !onAddSupplier) return;
    setAddingSupplier(true);
    try {
      const id = await onAddSupplier(supplierGuess);
      if (id) change({ supplierId: id });
    } finally {
      setAddingSupplier(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {duplicates.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> This invoice is already in your records</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-6">
            {duplicates.map((d) => (
              <li key={d.id}>
                {d.reason === 'same-file' ? 'The same Excel file was added as' : 'Same supplier and invoice number:'}{' '}
                <Link to={`/purchases/${d.id}`} className="font-medium underline">{d.supplierName} · {d.invoiceNumber}</Link> ({dateLabel(d.invoiceDate)}, {inr(d.total)})
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">It cannot be saved again. Open the existing one, or delete it first if it was entered wrongly.</p>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Check these before saving</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-6">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      <section className="card-enterprise p-4 sm:p-5" aria-label="Invoice details">
        <h2 className="mb-3 text-sm font-semibold">Invoice details</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Supplier"
            htmlFor="purchase-supplier"
            hint={!values.supplierId && supplierGuess && onAddSupplier ? (
              <p className="mt-1 text-[11px] text-amber-700">
                The file mentions “{supplierGuess}”, which is not a saved supplier.{' '}
                <button type="button" onClick={() => void addGuess()} disabled={addingSupplier} className="font-medium underline">{addingSupplier ? 'Adding…' : `Add ${supplierGuess}`}</button>
              </p>
            ) : null}
          >
            <select id="purchase-supplier" value={values.supplierId} onChange={(e) => change({ supplierId: e.target.value })} className={cn('input', tried && !values.supplierId && 'border-destructive')}>
              <option value="">Choose a supplier</option>
              {activeSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Invoice number" htmlFor="purchase-number">
            <input id="purchase-number" value={values.invoiceNumber} onChange={(e) => change({ invoiceNumber: e.target.value })} maxLength={100} className={cn('input', tried && !values.invoiceNumber.trim() && 'border-destructive')} />
          </Field>
          <Field label="Invoice date">
            <DatePicker ariaLabel="Invoice date" value={values.invoiceDate} onChange={(v) => change({ invoiceDate: v })} hasError={tried && !values.invoiceDate} />
          </Field>
          <Field label="Purchase / shipment date (if different)">
            <DatePicker ariaLabel="Purchase date" value={values.purchaseDate} onChange={(v) => change({ purchaseDate: v })} />
          </Field>
          <Field label="Due date (if any)">
            <DatePicker ariaLabel="Due date" value={values.dueDate} onChange={(v) => change({ dueDate: v })} />
          </Field>
          <Field label="Connected invoice (actual)" hint={<p className="mt-1 text-[11px] text-muted-foreground">The actual invoice this purchase was made for. Used to compare prices.</p>}>
            <ConnectedInvoicePicker value={values.invoiceId} label={values.invoiceLabel} onChange={(id, label) => change({ invoiceId: id, invoiceLabel: label })} />
          </Field>
        </div>
      </section>

      <section className="card-enterprise p-4 sm:p-5" aria-label="Products">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Products</h2>
          <span className="text-xs text-muted-foreground">{values.lines.filter((l) => l.productName.trim()).length} products · {round2(weight)} KGS</span>
        </div>
        <datalist id="purchase-products">{productSuggestions.map((name) => <option key={name} value={name} />)}</datalist>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-2 font-semibold">Product</th>
                <th className="w-24 px-2 py-2 text-right font-semibold">Quantity</th>
                <th className="w-28 px-2 py-2 text-right font-semibold">Net weight (KGS)</th>
                <th className="w-44 px-2 py-2 text-right font-semibold">Rate (₹)</th>
                <th className="w-32 px-2 py-2 text-right font-semibold">Amount (₹)</th>
                <th className="w-10" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {values.lines.map((line, i) => (
                <tr key={line.key} className="border-b last:border-0 align-top">
                  <td className="py-1.5 pr-2"><input aria-label={`Product ${i + 1}`} list="purchase-products" value={line.productName} onChange={(e) => changeLine(line.key, { productName: e.target.value })} maxLength={200} className="input" placeholder="Product" /></td>
                  <td className="px-2 py-1.5"><NumberInput ariaLabel={`Quantity for product ${i + 1}`} value={line.quantity} decimals={3} onChange={(v) => changeLine(line.key, { quantity: v })} className="input text-right" /></td>
                  <td className="px-2 py-1.5"><NumberInput ariaLabel={`Net weight for product ${i + 1}`} value={line.netWeight} decimals={3} onChange={(v) => changeLine(line.key, { netWeight: v })} className="input text-right" /></td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <NumberInput ariaLabel={`Rate for product ${i + 1}`} value={line.rate} decimals={4} onChange={(v) => changeLine(line.key, { rate: v })} className="input min-w-0 flex-1 text-right" />
                      <select aria-label={`Rate per for product ${i + 1}`} value={line.rateBasis} onChange={(e) => changeLine(line.key, { rateBasis: e.target.value as 'KG' | 'UNIT' })} className="input w-[4.5rem] shrink-0 !px-2 text-xs">
                        <option value="KG">/ KG</option>
                        <option value="UNIT">/ unit</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-2 py-1.5"><NumberInput ariaLabel={`Amount for product ${i + 1}`} value={line.amount} decimals={2} onChange={(v) => changeLine(line.key, { amount: v })} className="input text-right font-medium" /></td>
                  <td className="py-1.5 pl-1"><button type="button" onClick={() => removeLine(line.key)} className="btn-icon hover:text-destructive" aria-label={`Remove product ${i + 1}`}><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addLine} className="btn-ghost mt-3"><Plus className="h-4 w-4" /> Add product</button>
      </section>

      <section className="card-enterprise p-4 sm:p-5" aria-label="Charges and totals">
        <h2 className="mb-3 text-sm font-semibold">Charges and totals</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Subtotal (₹)" hint={<Suggest text="The products add up to" value={linesSum} current={values.subTotal} onUse={() => change({ subTotal: linesSum })} />}>
            <NumberInput ariaLabel="Subtotal" value={values.subTotal} decimals={2} onChange={(v) => change({ subTotal: v })} className="input text-right" />
          </Field>
          <Field label="GST / tax (₹)"><NumberInput ariaLabel="GST or tax" value={values.taxAmount} decimals={2} onChange={(v) => change({ taxAmount: v })} className="input text-right" /></Field>
          <Field label="Freight (₹)"><NumberInput ariaLabel="Freight" value={values.freight} decimals={2} onChange={(v) => change({ freight: v })} className="input text-right" /></Field>
          <Field label="Other charges (₹)"><NumberInput ariaLabel="Other charges" value={values.otherCharges} decimals={2} onChange={(v) => change({ otherCharges: v })} className="input text-right" /></Field>
          <Field label="Total (₹)" hint={<Suggest text="Subtotal + charges =" value={expected} current={values.total} onUse={() => change({ total: expected })} />}>
            <NumberInput ariaLabel="Total" value={values.total} decimals={2} onChange={(v) => change({ total: v })} className="input text-right font-semibold" />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Notes" htmlFor="purchase-notes">
            <textarea id="purchase-notes" value={values.notes} onChange={(e) => change({ notes: e.target.value })} maxLength={1000} rows={2} className="input resize-y" placeholder="Anything to remember about this purchase" />
          </Field>
        </div>
        {values.sourceFileName && <p className="mt-2 text-xs text-muted-foreground">Read from <span className="font-medium">{values.sourceFileName}</span></p>}
      </section>

      {(error || (tried && problems.length > 0)) && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {error && <p className="font-medium">{error}</p>}
          {tried && problems.length > 0 && <ul className="list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        </div>
      )}

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
        <span className="mr-auto hidden text-sm text-muted-foreground sm:block">Total <span className="font-semibold text-foreground">{inr(values.total ?? expected)}</span></span>
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
        <button type="submit" disabled={saving || blocked} className="btn-brand disabled:opacity-50">{saving ? 'Saving…' : saveLabel}</button>
      </div>
    </form>
  );
};

export default PurchaseForm;
