import { useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Invoice } from '../services/invoiceService';
import { useClearManualRate, useSetManualRate } from '../hooks/useInvoices';

interface ExchangeRatePanelProps {
  invoice: Invoice;
}

function lookupLinks(from: string, isoDate: string) {
  return [
    { name: 'XE historical rates', url: `https://www.xe.com/currencytables/?from=${from}&date=${isoDate}` },
    { name: 'X-Rates historical', url: `https://www.x-rates.com/historical/?from=${from}&amount=1&date=${isoDate}` },
  ];
}

const ExchangeRatePanel: React.FC<ExchangeRatePanelProps> = ({ invoice }) => {
  const conv = invoice.conversion;
  const setRate = useSetManualRate();
  const clearRate = useClearManualRate();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!conv || conv.source === 'same') return null;

  const { baseCurrency: base } = conv;
  const total = Number(invoice.total);
  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed > 0;
  const isoDate = String(invoice.invoiceDate).slice(0, 10);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!valid) return setError('Enter a rate greater than 0.');
    setRate.mutate(
      { id: invoice.id, rate: parsed },
      { onSuccess: () => { setEditing(false); setValue(''); }, onError: () => setError('Could not save the rate. Please try again.') },
    );
  };

  if (conv.source === 'auto' && conv.rate !== null && conv.value !== null) {
    return (
      <div className="rounded-xl border bg-card px-5 py-3 text-sm text-muted-foreground print:hidden">
        Counted as <span className="font-semibold text-foreground">{formatCurrency(conv.value, base)}</span> in revenue
        {' '}(1 {invoice.currency} = {conv.rate.toFixed(4)} {base},{' '}
        {conv.provider === 'EXCHANGERATE_API' ? 'ExchangeRate-API rate fetched when the invoice was recent' : 'European Central Bank rate for the invoice date'}).
      </div>
    );
  }

  if (conv.source === 'manual' && !editing && conv.rate !== null && conv.value !== null) {
    return (
      <div className="rounded-xl border bg-card px-5 py-3 text-sm print:hidden">
        <p>
          Counted as <span className="font-semibold">{formatCurrency(conv.value, base)}</span> in revenue using
          {' '}<span className="font-semibold">your rate</span>: 1 {invoice.currency} = {conv.rate} {base}.
        </p>
        <div className="mt-2 flex gap-3 text-xs font-semibold">
          <button type="button" onClick={() => { setValue(String(conv.rate)); setEditing(true); }} className="underline">Change rate</button>
          <button type="button" disabled={clearRate.isPending} onClick={() => clearRate.mutate(invoice.id)} className="underline text-muted-foreground disabled:opacity-50">Remove</button>
        </div>
      </div>
    );
  }

  // missing (or editing a manual rate)
  const missing = conv.source === 'missing';
  return (
    <form onSubmit={save} className={`rounded-xl border px-5 py-4 space-y-3 print:hidden ${missing ? 'border-amber-200 bg-amber-50' : 'bg-card'}`}>
      {missing && (
        <div className="flex gap-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Exchange rate needed</p>
            <p>
              No automatic {invoice.currency} to {base} rate was found for {formatDate(invoice.invoiceDate)}, so this invoice is not
              counted in dashboard revenue. Enter what 1 {invoice.currency} was worth in {base} on that date.
            </p>
          </div>
        </div>
      )}

      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">1 {invoice.currency} =</span>
        <input
          type="number"
          step="any"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="rate"
          aria-label={`Exchange rate: ${base} per 1 ${invoice.currency}`}
          className="w-36 px-3 py-2 border rounded-md bg-background"
        />
        <span className="font-medium">{base}</span>
        {valid && (
          <span className="text-muted-foreground">
            → {formatCurrency(total, invoice.currency)} ≈ {formatCurrency(total * parsed, base)}
          </span>
        )}
      </label>

      <div className="text-xs text-muted-foreground">
        Look up the rate for {isoDate}:{' '}
        {lookupLinks(invoice.currency, isoDate).map((l, i) => (
          <span key={l.url}>
            {i > 0 && ' · '}
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-foreground underline">
              {l.name}<ExternalLink className="h-3 w-3" />
            </a>
          </span>
        ))}
        {' '}(use the {base} column in the {invoice.currency} row)
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={setRate.isPending} className="px-3 py-2 text-sm rounded-md bg-[hsl(var(--primary))] text-primary-foreground disabled:opacity-50">
          {setRate.isPending ? 'Saving…' : 'Save rate'}
        </button>
        {!missing && (
          <button type="button" onClick={() => { setEditing(false); setError(null); }} className="px-3 py-2 text-sm border rounded-md hover:bg-accent">Cancel</button>
        )}
      </div>
    </form>
  );
};

export default ExchangeRatePanel;
