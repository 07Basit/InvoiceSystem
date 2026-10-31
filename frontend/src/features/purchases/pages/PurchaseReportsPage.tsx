import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import type { PurchaseReport } from 'shared';
import FilterBar from '@/components/ui/FilterBar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { saveBlob } from '@/lib/share';
import { cn } from '@/lib/utils';
import PurchaseFilterPanel from '../components/PurchaseFilterPanel';
import { usePurchaseReport, useSuppliers } from '../hooks/usePurchases';
import { dateLabel, inr, plainNumber } from '../utils/format';
import { PERIODS, ymd } from '../utils/periods';
import { countActive, noPurchaseFilters, type PurchaseFilterValues } from '../utils/purchaseFilters';

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** The report as a spreadsheet-friendly CSV: totals first, then each supplier, then each product. */
export function reportCsv(report: PurchaseReport): string {
  const rows: (string | number)[][] = [
    ['Purchase report', report.from ? dateLabel(report.from) : 'start', report.to ? dateLabel(report.to) : 'today'],
    [],
    ['Supplier', 'Invoices', 'Subtotal', 'GST', 'Freight', 'Other charges', 'Total'],
    ...report.bySupplier.map((s) => [s.supplierName, s.count, s.subTotal, s.taxAmount, s.freight, s.otherCharges, s.total]),
    ['All suppliers', report.totals.count, report.totals.subTotal, report.totals.taxAmount, report.totals.freight, report.totals.otherCharges, report.totals.total],
    [],
    ['Product', 'Lines', 'Quantity', 'Net weight (KGS)', 'Average rate', 'Lowest rate', 'Highest rate', 'Amount'],
    ...report.byProduct.map((p) => [p.product, p.lines, p.quantity, p.netWeight, p.averageRate, p.minRate, p.maxRate, p.amount]),
  ];
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

const Stat: React.FC<{ label: string; value: string; note?: string; strong?: boolean }> = ({ label, value, note, strong }) => (
  <div className={cn('rounded-xl border bg-card p-4', strong && 'border-primary/40 bg-primary/5')}>
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={cn('mt-1 text-xl font-bold tabular-nums', strong && 'text-primary')}>{value}</p>
    {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
  </div>
);

/** Purchases for a date or a date range: per supplier, combined, per product, and the freight, GST and other charges. */
export default function PurchaseReportsPage() {
  const navigate = useNavigate();
  const { data: suppliers = [] } = useSuppliers();
  const month = useMemo(() => PERIODS[0]!.range(new Date()), []);
  const [filters, setFilters] = useState<PurchaseFilterValues>({ ...noPurchaseFilters, dateFrom: month.from, dateTo: month.to });
  const [product, setProduct] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const { dateFrom: from, dateTo: to, supplierId } = filters;
  const debouncedProduct = useDebouncedValue(product.trim(), 300);
  const { data: report, isLoading, isError, refetch } = usePurchaseReport({ ...(from ? { from } : {}), ...(to ? { to } : {}), ...(supplierId ? { supplierId } : {}), ...(debouncedProduct ? { product: debouncedProduct } : {}) });

  const today = ymd(new Date());

  const download = () => {
    if (report) saveBlob(new Blob([reportCsv(report)], { type: 'text/csv;charset=utf-8' }), `purchase-report-${from || 'start'}-to-${to || today}.csv`);
  };

  // the suppliers that sold something in the period, biggest first
  const bySupplier = useMemo(() => [...(report?.bySupplier ?? [])].sort((x, y) => y.total - x.total || x.supplierName.localeCompare(y.supplierName)), [report]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Purchase report</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {from || to ? `${from ? dateLabel(from) : 'The start'} to ${to ? dateLabel(to) : 'today'}` : 'All time'}
            {supplierId ? ` · ${suppliers.find((x) => x.id === supplierId)?.name ?? 'One supplier'}` : ' · All suppliers'}
            . Purchases count on their purchase date, or on the invoice date when there is none.
          </p>
        </div>
      </div>

      <FilterBar
        search={product}
        onSearchChange={setProduct}
        searchPlaceholder="Search a product…"
        searchLabel="Search a product"
        activeCount={countActive({ ...filters, product: '' })}
        onClear={() => { setProduct(''); setFilters(noPurchaseFilters); }}
        onOpenFilters={() => setPanelOpen(true)}
        trailing={<button type="button" onClick={download} disabled={!report} className="btn-ghost shrink-0 disabled:opacity-50"><Download className="h-4 w-4" /> <span className="hidden sm:inline">Download CSV</span></button>}
      />
      <PurchaseFilterPanel open={panelOpen} onClose={() => setPanelOpen(false)} filters={filters} onChange={setFilters} suppliers={suppliers} show={{ supplier: true }} matching={report?.totals.count} />

      {isLoading ? (
        <div className="py-16"><LoadingSpinner variant="invoices" size="sm" /></div>
      ) : isError || !report ? (
        <div className="card-enterprise px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">The report could not be loaded.</p>
          <button type="button" onClick={() => void refetch()} className="btn-ghost mt-3">Try again</button>
        </div>
      ) : (
        <>
          <section aria-label="Totals" className="space-y-3">
            <Stat strong label="Overall purchase cost for the period" value={inr(report.totals.total)} note={`${report.totals.count} invoice${report.totals.count === 1 ? '' : 's'} · goods + GST + freight + other charges`} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Goods (before GST and charges)" value={inr(report.totals.subTotal)} />
              <Stat label="Total GST" value={inr(report.totals.taxAmount)} />
              <Stat label="Total freight" value={inr(report.totals.freight)} />
              <Stat label="Other charges" value={inr(report.totals.otherCharges)} />
            </div>
          </section>

          <section className="card-enterprise" aria-label="Purchases by supplier">
            <div className="border-b px-4 py-3 sm:px-5"><h3 className="text-base font-semibold">Purchases by supplier</h3></div>
            {bySupplier.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">Nothing was purchased in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-b bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 text-left font-semibold sm:px-5">Supplier</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Invoices</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Total</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Goods</th>
                      <th className="px-2 py-2.5 text-right font-semibold">GST</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Freight</th>
                      <th className="px-4 py-2.5 text-right font-semibold sm:px-5">Other</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bySupplier.map((x) => (
                      <tr key={x.supplierId} className="border-b hover:bg-accent/50">
                        <td className="px-4 py-2.5 text-left font-medium sm:px-5"><span className="block max-w-[10rem] truncate" title={x.supplierName}>{x.supplierName}</span></td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{x.count}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right font-semibold tabular-nums">{inr(x.total)}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{inr(x.subTotal)}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-muted-foreground">{inr(x.taxAmount)}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-muted-foreground">{inr(x.freight)}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-muted-foreground sm:px-5">{inr(x.otherCharges)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-secondary/50 font-semibold">
                      <td className="px-4 py-2.5 text-left sm:px-5">Combined</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{report.totals.count}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{inr(report.totals.total)}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{inr(report.totals.subTotal)}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{inr(report.totals.taxAmount)}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{inr(report.totals.freight)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums sm:px-5">{inr(report.totals.otherCharges)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          <section className="card-enterprise" aria-label="Product-wise purchases">
            <div className="border-b px-4 py-3 sm:px-5"><h3 className="text-base font-semibold">Product-wise purchases</h3></div>
            {report.byProduct.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">Nothing was purchased in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] text-sm">
                  <thead>
                    <tr className="border-b bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 text-left font-semibold sm:px-5">Product</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Quantity</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Net weight (KGS)</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Average rate</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Lowest</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Highest</th>
                      <th className="px-4 py-2.5 text-right font-semibold sm:px-5">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byProduct.map((p) => (
                      <tr key={p.product} className="border-b last:border-0 hover:bg-accent/50">
                        <td className="min-w-[10rem] px-4 py-2.5 text-left sm:px-5"><button type="button" onClick={() => navigate(`/purchases/price-tracker?product=${encodeURIComponent(p.product)}`)} className="text-left font-medium hover:underline" title="See its price over time">{p.product}</button></td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{plainNumber(p.quantity)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{plainNumber(p.netWeight)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{inr(p.averageRate)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">{inr(p.minRate)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">{inr(p.maxRate)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums sm:px-5">{inr(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
