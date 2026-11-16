import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { DEFAULT_PAYMENT_METHOD, PAYMENT_METHODS, paymentSchema, type PaymentDto, type PaymentRecord } from 'shared';
import DatePicker from '@/components/ui/DatePicker';
import SearchCombobox, { type ComboOption } from '@/components/ui/SearchCombobox';
import NumberInput from '@/components/ui/NumberInput';
import { formatCurrency } from '@/lib/utils';
import { usePaymentMethods } from '../hooks/usePayments';

interface PaymentDialogProps {
  currency: string;
  /** What is still due on the invoice (the amount a new payment starts with) */
  balance: number;
  /** The payment being changed, or null for a new one */
  payment: PaymentRecord | null;
  busy: boolean;
  error: string | null;
  onSave: (dto: PaymentDto) => void;
  onClose: () => void;
}

/** The usual methods, then any other that was typed before (so it is only typed once). */
export function methodOptions(used: string[]): ComboOption[] {
  const seen = new Set<string>();
  return [...PAYMENT_METHODS, ...used].filter((m) => !seen.has(m.toLowerCase()) && seen.add(m.toLowerCase())).map((m) => ({ value: m, label: m }));
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Record a payment received against an invoice, or change one. */
const PaymentDialog: React.FC<PaymentDialogProps> = ({ currency, balance, payment, busy, error, onSave, onClose }) => {
  const [paidOn, setPaidOn] = useState(payment?.paidOn ?? today());
  const [amount, setAmount] = useState<number | undefined>(payment ? payment.amount : balance > 0 ? balance : undefined);
  const [method, setMethod] = useState(payment ? payment.method ?? '' : DEFAULT_PAYMENT_METHOD);
  const { data: used = [] } = usePaymentMethods();
  const [reference, setReference] = useState(payment?.reference ?? '');
  const [notes, setNotes] = useState(payment?.notes ?? '');
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = paymentSchema.safeParse({ paidOn, amount, method: method.trim() || undefined, reference: reference.trim() || undefined, notes: notes.trim() || undefined });
    if (!parsed.success) { setProblem(parsed.error.issues[0]?.message ?? 'Check the details'); return; }
    setProblem(null);
    onSave(parsed.data);
  };

  // what the invoice would still owe after this payment (the payment being changed is already counted in `balance`)
  const after = amount !== undefined ? Math.round((balance + (payment?.amount ?? 0) - amount) * 100) / 100 : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={payment ? 'Change payment' : 'Record payment'}>
      <form onSubmit={submit} className="my-8 w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{payment ? 'Change payment' : 'Record payment'}</h2>
            <p className="text-xs text-muted-foreground">Balance due now: {formatCurrency(balance, currency)}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-icon -mr-2 -mt-1" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date received</label>
            <DatePicker ariaLabel="Date received" value={paidOn} onChange={setPaidOn} />
          </div>
          <div>
            <label className="label" htmlFor="pay-amount">Amount ({currency})</label>
            <NumberInput ariaLabel="Amount" value={amount} onChange={setAmount} decimals={2} className="input text-right" />
          </div>
          <div className="col-span-2">
            <label className="label">Payment method</label>
            <SearchCombobox
              value={method}
              display={method}
              onChange={setMethod}
              options={methodOptions(used)}
              allowCustom
              labelClassName="w-auto whitespace-nowrap"
              ariaLabel="Payment method"
              placeholder="Select a method"
              searchPlaceholder="Search, or type a new method…"
              className="input w-full"
            />
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="pay-ref">Reference number</label>
            <input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className="input" placeholder="Bank reference, cheque number or transaction id" />
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="pay-notes">Notes</label>
            <textarea id="pay-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} className="input" placeholder="e.g. part payment, bank charges deducted" />
          </div>
        </div>

        {after !== null && (
          <p className="mt-3 text-xs text-muted-foreground">
            {after > 0.005 ? `After this, ${formatCurrency(after, currency)} is still due.` : after < -0.005 ? `This is ${formatCurrency(-after, currency)} more than the balance due. The invoice will show as overpaid.` : 'This settles the invoice in full.'}
          </p>
        )}
        {(problem || error) && <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2.5 text-sm text-red-900">{problem ?? error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={busy} className="btn-brand disabled:opacity-50">{busy ? 'Saving…' : payment ? 'Save changes' : 'Record payment'}</button>
        </div>
      </form>
    </div>
  );
};

export default PaymentDialog;
