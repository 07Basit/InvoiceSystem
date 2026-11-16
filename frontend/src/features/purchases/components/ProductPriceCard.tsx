import type { PriceOverviewItem } from 'shared';
import { dateLabel, inr } from '../utils/format';
import ChangeBadge from './ChangeBadge';
import PriceSparkline from './PriceSparkline';

interface ProductPriceCardProps {
  item: PriceOverviewItem;
  onOpen: () => void;
}

/** One product on the overview: its latest rate, how it moved, a small trend, the cheapest supplier and what it was sold for. */
const ProductPriceCard: React.FC<ProductPriceCardProps> = ({ item, onOpen }) => {
  const direction = item.changePercent === null || item.changePercent === 0 ? 'flat' : item.changePercent > 0 ? 'up' : 'down';
  const gap = item.sale?.rateInr != null ? item.sale.rateInr - item.sale.buyRate : null;
  return (
    <button type="button" onClick={onOpen} aria-label={`${item.product}, latest ${inr(item.latest.rate)} per kg`}
      className="group flex flex-col gap-2 rounded-xl border bg-card card-pattern p-4 text-left transition-all hover:border-[hsl(var(--brand-accent))]/40 hover:shadow-md">
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-base font-semibold" title={item.product}>{item.product}</span>
        <ChangeBadge percent={item.changePercent} />
      </span>
      <span>
        <span className="text-2xl font-bold tabular-nums">{inr(item.latest.rate)}</span>
        <span className="text-xs text-muted-foreground"> /kg</span>
        <span className="block truncate text-xs text-muted-foreground">{item.latest.supplierName} · {dateLabel(item.latest.date)}</span>
      </span>
      <PriceSparkline values={item.series.map((p) => p.rate)} direction={direction} />
      <span className="space-y-0.5 text-xs text-muted-foreground">
        {item.cheapest ? (
          <span className="block truncate">Cheapest now: <span className="font-medium text-foreground">{item.cheapest.supplierName} {inr(item.cheapest.rate)}</span></span>
        ) : (
          <span className="block truncate">{item.suppliers} supplier · {item.purchases} purchase{item.purchases === 1 ? '' : 's'}</span>
        )}
        {item.cheapest && <span className="block">{item.suppliers} suppliers · {item.purchases} purchases</span>}
        {item.sale && (
          <span className="block truncate">
            Sold {item.sale.rateInr !== null ? inr(item.sale.rateInr) : `${item.sale.currency} ${item.sale.rate.toFixed(2)}`}
            {item.sale.rateInr !== null && ` (${item.sale.currency} ${item.sale.rate.toFixed(2)})`}
            {gap !== null && <span className={gap >= 0 ? ' font-medium text-emerald-700' : ' font-medium text-red-700'}> · {gap >= 0 ? '+' : '−'}{inr(Math.abs(gap))} vs bought</span>}
          </span>
        )}
      </span>
    </button>
  );
};

export default ProductPriceCard;
