import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils';
import { usePriceHistory } from '../hooks/usePurchases';
import { dateLabel, inr } from '../utils/format';
import { gapOf, supplierStats, withChange } from '../utils/priceStats';
import type { PurchaseFilterValues } from '../utils/purchaseFilters';
import { countActive } from '../utils/purchaseFilters';
import ChangeBadge from './ChangeBadge';
import PriceChart from './PriceChart';

interface ProductPriceDetailProps {
  product: string;
  filters: PurchaseFilterValues;
  onOpenFilters: () => void;
}

const Stat: React.FC<{ label: string; children: React.ReactNode; note?: React.ReactNode; strong?: boolean }> = ({ label, children, note, strong }) => (
  <div className={cn('rounded-xl border bg-card p-4', strong && 'border-primary/40 bg-primary/5')}>
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
    <div className={cn('mt-1 text-xl font-bold tabular-nums', strong && 'text-primary')}>{children}</div>
    {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
  </div>
);

const Th: React.FC<{ children?: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th className={cn('whitespace-nowrap px-3 py-2.5 font-semibold first:px-4 first:sm:px-5 last:px-4 last:sm:px-5', right ? 'text-right' : 'text-left')}>{children}</th>
);
const Td: React.FC<{ children?: React.ReactNode; right?: boolean; muted?: boolean; strong?: boolean }> = ({ children, right, muted, strong }) => (
  <td className={cn('whitespace-nowrap px-3 py-2.5 first:px-4 first:sm:px-5 last:px-4 last:sm:px-5', right && 'text-right tabular-nums', muted && 'text-muted-foreground', strong && 'font-semibold')}>{children}</td>
);
const headRow = 'border-b bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground';

/** One product: where its price stands, supplier against supplier, bought against sold, and every purchase. */
const ProductPriceDetail: React.FC<ProductPriceDetailProps> = ({ product, filters, onOpenFilters }) => {
  const { dateFrom, dateTo, supplierId } = filters;
  const { data: history, isLoading, isError } = usePriceHistory({ product, ...(supplierId ? { supplierId } : {}), ...(dateFrom ? { from: dateFrom } : {}), ...(dateTo ? { to: dateTo } : {}) });
  const points = useMemo(() => history?.points ?? [], [history]);
  const stats = useMemo(() => supplierStats(points), [points]);
  const rows = useMemo(() => [...withChange(points)].reverse(), [points]);
  const hasSale = points.some((p) => p.sale);
  // purchases connected to an actual invoice, newest first, with what was gained per kg and in all
  const compared = useMemo(() => [...points].reverse().filter((p) => p.sale).map((p) => ({ point: p, gap: gapOf(p) })), [points]);
  const gains = compared.filter((c) => c.gap !== null);
  const totalGain = gains.reduce((sum, c) => sum + (c.gap!.amount * (c.point.netWeight ?? 0)), 0);
  const averageGain = gains.length ? gains.reduce((sum, c) => sum + c.gap!.amount, 0) / gains.length : null;
  const latest = points[points.length - 1];
  const rates = points.map((p) => p.rate);
  const cheapest = stats.length >= 2 ? stats[0]! : null;
  const filterCount = countActive({ ...filters, product: '' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/purchases/price-tracker" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All products</Link>
          <h1 className="text-2xl font-bold">{history?.product ?? product}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Rate per kg for each purchase, supplier against supplier{hasSale ? ', and against what you charged' : ''}.</p>
        </div>
        <button type="button" onClick={onOpenFilters} className="btn-ghost shrink-0"><SlidersHorizontal className="h-4 w-4" /> Filters{filterCount > 0 && <span className="rounded-full bg-[hsl(var(--brand-accent))] px-1.5 text-[11px] font-semibold text-white">{filterCount}</span>}</button>
      </div>

      {isLoading ? (
        <div className="py-16"><LoadingSpinner variant="invoices" size="sm" /></div>
      ) : isError ? (
        <div className="card-enterprise px-6 py-14 text-center text-sm text-muted-foreground">The price history could not be loaded.</div>
      ) : !latest ? (
        <div className="card-enterprise px-6 py-14 text-center">
          <h3 className="text-base font-semibold">No purchases of {product} in this period</h3>
          <p className="mt-1 text-sm text-muted-foreground">Try a wider date range or another supplier.</p>
        </div>
      ) : (
        <>
          <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat strong label="Latest rate" note={`${latest.supplierName} · ${dateLabel(latest.date)}`}>{inr(latest.rate)}<span className="text-xs font-medium text-muted-foreground"> /kg</span></Stat>
            <Stat label="Change since their last purchase" note={stats.find((x) => x.supplierId === latest.supplierId)?.previous ? `${inr(stats.find((x) => x.supplierId === latest.supplierId)!.previous!.rate)} on ${dateLabel(stats.find((x) => x.supplierId === latest.supplierId)!.previous!.date)}` : undefined}>
              <ChangeBadge percent={stats.find((x) => x.supplierId === latest.supplierId)?.change ?? null} className="text-sm" />
            </Stat>
            <Stat label="Cheapest supplier now" note={cheapest ? `${stats.length} suppliers compared` : 'Only one supplier so far'}>{cheapest ? <>{cheapest.supplierName} <span className="text-base">{inr(cheapest.latest.rate)}</span></> : '—'}</Stat>
            <Stat label="Lowest · Highest" note={`Average ${inr(rates.reduce((s, r) => s + r, 0) / rates.length)} · ${points.length} purchase${points.length === 1 ? '' : 's'}`}>{inr(Math.min(...rates))} · {inr(Math.max(...rates))}</Stat>
          </section>

          <section className="card-enterprise p-4 sm:p-5" aria-label={`Rate of ${product} over time`}>
            <h2 className="mb-3 text-base font-semibold">Price over time</h2>
            <PriceChart points={points} />
            {!hasSale ? (
              <p className="mt-2 text-xs text-muted-foreground">To compare with what you charged, open a purchase and choose its “Connected invoice” (an actual invoice).</p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">The dashed lines are what the connected actual invoices charged for it: in rupees at the exchange rate of the invoice date, and in the invoice currency (right axis).</p>
            )}
          </section>

          {hasSale && (
            <section className="card-enterprise" aria-label="Bought against sold">
              <div className="border-b px-4 py-3 sm:px-5">
                <h2 className="text-base font-semibold">Bought against sold</h2>
                <p className="text-xs text-muted-foreground">Per kg. What each purchase cost you, and what the connected actual invoice charged for the same product, in rupees at the exchange rate of the invoice date.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead><tr className={headRow}><Th>Bought on</Th><Th>Supplier</Th><Th right>Bought at</Th><Th right>Sold at</Th><Th right>Gain per kg</Th></tr></thead>
                  <tbody>
                    {compared.map(({ point: p, gap }, i) => (
                      <tr key={`${p.invoiceId}-${i}`} className="border-b last:border-0 hover:bg-accent/50">
                        <Td>{dateLabel(p.date)}</Td>
                        <Td>{p.supplierName}</Td>
                        <Td right strong>{inr(p.rate)}</Td>
                        <Td right>
                          <Link to={`/invoices/${p.sale!.invoiceId}`} className="block font-mono text-xs hover:underline">{p.sale!.invoiceNumber}</Link>
                          <span className="block">{p.sale!.rateInr !== null ? inr(p.sale!.rateInr) : <span className="text-muted-foreground">no ₹ rate</span>}</span>
                          <span className="block text-xs text-muted-foreground">{p.sale!.currency} {p.sale!.rate.toFixed(2)}{p.sale!.fxRate !== null ? ` × ${p.sale!.fxRate}` : ''}</span>
                        </Td>
                        <Td right>{gap ? <span className={cn('font-semibold', gap.amount >= 0 ? 'text-emerald-700' : 'text-red-700')}>{gap.amount >= 0 ? '+' : '−'}{inr(Math.abs(gap.amount))}<span className="block text-xs font-medium">{gap.percent >= 0 ? '+' : ''}{gap.percent}%</span></span> : <span className="text-muted-foreground">—</span>}</Td>
                      </tr>
                    ))}
                  </tbody>
                  {averageGain !== null && (
                    <tfoot>
                      <tr className="bg-secondary/50 font-semibold">
                        <Td>Average</Td><Td /><Td /><Td />
                        <Td right><span className={averageGain >= 0 ? 'text-emerald-700' : 'text-red-700'}>{averageGain >= 0 ? '+' : '−'}{inr(Math.abs(averageGain))} per kg</span><span className="block text-xs font-medium text-muted-foreground">{totalGain >= 0 ? '+' : '−'}{inr(Math.abs(totalGain))} on the kilos bought</span></Td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </section>
          )}

          <section className="card-enterprise" aria-label="Supplier comparison">
            <div className="border-b px-4 py-3 sm:px-5"><h2 className="text-base font-semibold">Supplier against supplier</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead><tr className={headRow}><Th>Supplier</Th><Th right>Latest</Th><Th>On</Th><Th right>Change</Th><Th right>Lowest</Th><Th right>Highest</Th><Th right>Average</Th><Th right>Purchases</Th></tr></thead>
                <tbody>
                  {stats.map((x, i) => (
                    <tr key={x.supplierId} className="border-b last:border-0 hover:bg-accent/50">
                      <Td strong>{x.supplierName}{cheapest && i === 0 && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">cheapest</span>}</Td>
                      <Td right strong>{inr(x.latest.rate)}</Td>
                      <Td muted>{dateLabel(x.latest.date)}</Td>
                      <Td right><ChangeBadge percent={x.change} /></Td>
                      <Td right muted>{inr(x.lowest)}</Td>
                      <Td right muted>{inr(x.highest)}</Td>
                      <Td right muted>{inr(x.average)}</Td>
                      <Td right>{x.purchases}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card-enterprise" aria-label="Purchases of the product">
            <div className="border-b px-4 py-3 sm:px-5"><h2 className="text-base font-semibold">Every purchase</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className={headRow}>
                    <Th>Date</Th><Th>Supplier</Th><Th>Invoice</Th><Th right>Net weight</Th><Th right>Rate per kg</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p, i) => {
                    return (
                      <tr key={`${p.invoiceId}-${i}`} className="border-b last:border-0 hover:bg-accent/50">
                        <Td>{dateLabel(p.date)}</Td>
                        <Td>{p.supplierName}</Td>
                        <Td><Link to={`/purchases/${p.invoiceId}`} className="font-mono text-xs hover:underline">{p.invoiceNumber}</Link></Td>
                        <Td right muted>{p.netWeight ? `${p.netWeight} KGS` : '—'}</Td>
                        <Td right strong>{inr(p.rate)} {p.change !== null && p.change !== 0 && <span className={cn('ml-1 text-xs font-medium', p.change > 0 ? 'text-red-600' : 'text-emerald-600')}>{p.change > 0 ? '+' : ''}{p.change}%</span>}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default ProductPriceDetail;
