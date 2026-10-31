import { cn } from '@/lib/utils';

interface PriceSparklineProps {
  values: number[];
  /** Rising prices are bad news for a buyer: red when up, green when down */
  direction: 'up' | 'down' | 'flat';
  className?: string;
}

const STROKE = { up: '#dc2626', down: '#059669', flat: '#64748b' };

/** A small line of the latest rates, with the last one marked. */
const PriceSparkline: React.FC<PriceSparklineProps> = ({ values, direction, className }) => {
  const W = 120;
  const H = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i: number) => (values.length === 1 ? W / 2 : 4 + (i * (W - 8)) / (values.length - 1));
  const y = (v: number) => (max === min ? H / 2 : H - 4 - ((v - min) / (max - min)) * (H - 8));
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const color = STROKE[direction];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Recent rates" className={cn('h-9 w-full', className)}>
      {values.length > 1 && <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
      {/* a round cap on a zero-length line is a true circle, even though the drawing is stretched */}
      <line x1={x(values.length - 1)} y1={y(values[values.length - 1]!)} x2={x(values.length - 1)} y2={y(values[values.length - 1]!) + 0.01} stroke={color} strokeWidth="7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export default PriceSparkline;
