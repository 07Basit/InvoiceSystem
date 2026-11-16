import { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PricePoint } from 'shared';
import { dateLabel, inr } from '../utils/format';

const SOLD = 'Sold at';
const SOLD_INR = 'Sold at (₹)';
const SUPPLIER_COLORS = ['#ea580c', '#2563eb', '#16a34a', '#9333ea', '#0891b2', '#ca8a04'];

/**
 * The rate per kg of one product over time: a line in rupees for each supplier, and, when purchases are connected to an actual
 * invoice, dashed lines for what that invoice charged: in rupees (same axis) and in the invoice currency (right axis).
 */
const PriceChart: React.FC<{ points: PricePoint[] }> = ({ points }) => {
  const suppliers = useMemo(() => [...new Set(points.map((p) => p.supplierName))], [points]);
  const currencies = useMemo(() => [...new Set(points.flatMap((p) => (p.sale ? [p.sale.currency] : [])))], [points]);
  const hasSaleInr = points.some((p) => p.sale?.rateInr != null);
  const data = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const p of points) {
      const row = byDate.get(p.date) ?? { date: p.date, label: dateLabel(p.date) };
      row[p.supplierName] = p.rate;
      if (p.sale) {
        if (p.sale.rateInr !== null) row[SOLD_INR] = p.sale.rateInr;
        row[`${SOLD} (${p.sale.currency})`] = p.sale.rate;
      }
      byDate.set(p.date, row);
    }
    return [...byDate.values()];
  }, [points]);
  const single = currencies.length === 1;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="inr" domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={52} tickFormatter={(v: number) => `₹${v}`} />
          {single && <YAxis yAxisId="sold" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={80} tickFormatter={(v: number) => `${currencies[0]} ${Number(v.toFixed(2))}`} />}
          <Tooltip formatter={(value: number, name: string) => [name.endsWith('(₹)') || !name.startsWith(SOLD) ? inr(value) : `${/\((\w+)\)$/.exec(name)?.[1] ?? ''} ${value.toFixed(2)}`, name]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {suppliers.map((name, i) => (
            <Line key={name} yAxisId="inr" type="monotone" dataKey={name} name={`${name} (₹)`} stroke={SUPPLIER_COLORS[i % SUPPLIER_COLORS.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls isAnimationActive={false} />
          ))}
          {hasSaleInr && <Line yAxisId="inr" type="monotone" dataKey={SOLD_INR} name={SOLD_INR} stroke="#475569" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} connectNulls isAnimationActive={false} />}
          {currencies.map((code) => (
            <Line key={code} yAxisId={single ? 'sold' : 'inr'} type="monotone" dataKey={`${SOLD} (${code})`} name={`${SOLD} (${code})`} stroke="#0d9488" strokeWidth={2} strokeDasharray="2 3" dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PriceChart;
