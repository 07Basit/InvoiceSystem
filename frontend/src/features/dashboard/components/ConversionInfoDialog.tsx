import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ConversionInfoDialogProps {
  baseCurrency: string;
  missingRates: string[];
  onClose: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h4 className="text-sm font-semibold mb-1">{title}</h4>
    <div className="text-sm text-muted-foreground space-y-1.5">{children}</div>
  </div>
);

const ConversionInfoDialog: React.FC<ConversionInfoDialogProps> = ({ baseCurrency, missingRates, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="How the dashboard is calculated">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">How the dashboard is calculated</h3>
            <p className="text-xs text-muted-foreground">Invoices can be in different currencies; everything here is shown in {baseCurrency}.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-md text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <Section title="Reporting currency">
          <p>
            Pick the currency in the dropdown at the top. Total revenue, both revenue charts and the importer totals are all
            expressed in it. Changing it only changes how figures are displayed. Your invoices are never modified.
          </p>
        </Section>

        <Section title="Which exchange rate is used">
          <p>
            Every invoice is converted at the rate of <strong>its own invoice date</strong>, not today's rate. An invoice from
            15 Sep uses the 15 Sep rate even if the rate has moved since, so past months never change. Invoice amount × that
            rate = the amount counted in {baseCurrency}. Invoices already in {baseCurrency} are used as they are.
          </p>
          <p>The rate is looked up in this order, and the first one that has it is used:</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <strong>European Central Bank (via Frankfurter)</strong>: about 30 major currencies, for past and current dates. The
              ECB doesn't publish on weekends or holidays, so those days use the previous business day's rate.
            </li>
            <li>
              <strong>ExchangeRate-API</strong>: for currencies the ECB doesn't cover (for example AED or SAR), but only for
              <strong> recent invoices</strong> (dated today or in the last 2 days), because the free plan only gives today's
              rate. That rate is saved against the invoice's date and never changes afterwards.
            </li>
            <li>
              <strong>Your own rate</strong>: for older invoices in currencies the ECB doesn't cover, nothing automatic exists, so
              you enter the rate yourself (see below).
            </li>
          </ol>
          <p>Every automatic rate is saved the first time it is found, so later loads are fast. Only a currency code and a date range are sent to these services, never invoice details.</p>
        </Section>

        <Section title="What counts and what doesn't">
          <p>
            <strong>Total Invoices</strong>, <strong>Monthly Invoices</strong> and the invoice list always include every invoice.
            Revenue only includes invoices that could be converted.
          </p>
        </Section>

        <Section title="If a rate can't be found">
          <p>An invoice is left out of revenue only when no step above has a rate for it:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>An older invoice in a currency the ECB doesn't cover.</strong> Nothing automatic can supply it, so a manual rate is needed.</li>
            <li><strong>A service is unreachable</strong> and that date's rate hasn't been saved yet. Saved rates keep working, and the app retries automatically (about an hour later).</li>
          </ul>
          <p>
            <strong>You can fix it yourself:</strong> open the invoice and enter what 1 unit of its currency was worth on the invoice
            date. The panel links to sites where you can look the rate up. That invoice is then counted in revenue using your rate,
            and your rate takes priority over any automatic one. If you change the reporting currency later, the rate must be entered again.
          </p>
          <p>
            Such invoices still show in counts and lists, marked in yellow with "Not in revenue", and a banner at the top of the
            dashboard says how many are affected. Revenue is never silently understated.
          </p>
        </Section>

        <div className={`rounded-lg border px-4 py-3 text-sm ${missingRates.length ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {missingRates.length
            ? `Right now ${missingRates.join(', ')} can't be converted and is excluded from revenue.`
            : 'Right now every invoice is converted. Nothing is excluded.'}
        </div>
      </div>
    </div>
  );
};

export default ConversionInfoDialog;
