import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** One animated scene per kind of page. Pure SVG and CSS (the keyframes are in index.css); they stand still for people who ask for less motion. */
export type LoaderVariant = 'app' | 'dashboard' | 'invoices' | 'invoice' | 'importers' | 'exporter' | 'products' | 'recycle' | 'notifications';

export const DEFAULT_MESSAGE: Record<LoaderVariant, string> = {
  app: 'Loading your workspace…',
  dashboard: 'Crunching your numbers…',
  invoices: 'Fetching your invoices…',
  invoice: 'Opening the invoice…',
  importers: 'Finding your importers…',
  exporter: 'Loading exporter details…',
  products: 'Stocking the shelves…',
  recycle: 'Checking the bin…',
  notifications: 'Checking for news…',
};

export const SCENE_W = 240;
export const SCENE_H = 180;

const accent = 'fill-[hsl(var(--brand-accent))]';
const accentStroke = 'stroke-[hsl(var(--brand-accent))]';
const ink = 'fill-[hsl(var(--primary)/0.22)]';
const inkStroke = 'stroke-[hsl(var(--primary)/0.3)]';
const card = 'fill-[hsl(var(--card))] stroke-[hsl(var(--border))]';
const glow = 'fill-[hsl(var(--primary)/0.05)]';

const Glow = () => <circle cx="120" cy="92" r="72" className={glow} />;

function Waves() {
  return (
    <>
      <g className="ld-wave-2"><path d="M0 162 Q 30 152 60 162 T 120 162 T 180 162 T 240 162 T 300 162 T 360 162 T 420 162 T 480 162 V 180 H 0 Z" className="fill-[hsl(var(--brand-accent)/0.16)]" /></g>
      <g className="ld-wave-1"><path d="M0 168 Q 30 160 60 168 T 120 168 T 180 168 T 240 168 T 300 168 T 360 168 T 420 168 T 480 168 V 180 H 0 Z" className="fill-[hsl(var(--primary)/0.14)]" /></g>
    </>
  );
}

function Coins() {
  return (
    <>
      <circle cx="50" cy="150" r="5" className={cn(accent, 'ld-coin ld-coin-1')} />
      <circle cx="192" cy="152" r="4" className={cn(accent, 'ld-coin ld-coin-2')} />
      <circle cx="206" cy="146" r="3.5" className={cn(accent, 'ld-coin ld-coin-3')} />
    </>
  );
}

/** An invoice that is written line by line, optionally stamped. */
function InvoiceArt({ stamp = true }: { stamp?: boolean }) {
  return (
    <g className="ld-card">
      <rect x="72" y="46" width="96" height="100" rx="10" className={card} strokeWidth="1.5" />
      <path d="M72 56 a10 10 0 0 1 10 -10 h76 a10 10 0 0 1 10 10 v8 h-96 z" className={accent} />
      <rect x="82" y="52" width="30" height="4" rx="2" className="fill-white/80" />
      <rect x="82" y="58" width="18" height="3" rx="1.5" className="fill-white/50" />
      <rect x="82" y="76" width="76" height="6" rx="3" className={cn(ink, 'ld-line ld-line-1')} />
      <rect x="82" y="90" width="58" height="6" rx="3" className={cn(ink, 'ld-line ld-line-2')} />
      <rect x="82" y="104" width="68" height="6" rx="3" className={cn(ink, 'ld-line ld-line-3')} />
      <rect x="82" y="124" width="38" height="8" rx="4" className={cn(accent, 'ld-line ld-line-4')} />
      {stamp && (
        <g className="ld-stamp">
          <circle cx="152" cy="130" r="13" className="fill-[hsl(var(--card))] stroke-[hsl(var(--brand-accent))]" strokeWidth="2.5" />
          <path d="M146 130 l4.5 4.5 l8 -9" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={accentStroke} />
        </g>
      )}
    </g>
  );
}

function Pin({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="ld-pin" style={{ animationDelay: `${delay}s` }}>
        <path d="M0 0 L-5.5 -9 A7 7 0 1 1 5.5 -9 Z" className={accent} />
        <circle cx="0" cy="-14" r="2.6" className="fill-white" />
      </g>
    </g>
  );
}

function Crate({ x, y, delay, produce }: { x: number; y: number; delay: number; produce: string[] }) {
  return (
    <g className="ld-drop" style={{ animationDelay: `${delay}s` }}>
      {produce.map((c, i) => <circle key={i} cx={x + 9 + i * 13} cy={y - 2} r="6.5" className={c} />)}
      <rect x={x} y={y} width="44" height="30" rx="3" className="fill-[hsl(30_55%_58%)] stroke-[hsl(30_45%_38%)]" strokeWidth="1.5" />
      <path d={`M${x} ${y + 10} H${x + 44} M${x} ${y + 20} H${x + 44}`} className="stroke-[hsl(30_45%_38%)]" strokeWidth="1.2" fill="none" />
    </g>
  );
}

function Paper({ delay, x }: { delay: number; x: number }) {
  return (
    <g className="ld-paper" style={{ animationDelay: `${delay}s` }}>
      <rect x={x} y="18" width="16" height="20" rx="2" className={card} strokeWidth="1.2" />
      <path d={`M${x + 3} 25 H${x + 13} M${x + 3} 30 H${x + 10}`} className={inkStroke} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </g>
  );
}

const SCENES: Record<Exclude<LoaderVariant, 'app'>, () => ReactNode> = {
  dashboard: () => (
    <>
      <Glow />
      <rect x="40" y="40" width="160" height="104" rx="10" className={card} strokeWidth="1.5" />
      <path d="M54 128 H186" className="stroke-[hsl(var(--border))]" strokeWidth="1.5" fill="none" />
      {[30, 48, 40, 66, 84].map((h, i) => (
        <rect key={i} x={60 + i * 26} y={128 - h} width="18" height={h} rx="3" className={cn(i === 4 ? accent : ink, 'ld-bar', `ld-bar-${i + 1}`)} />
      ))}
      <path d="M69 100 L95 84 L121 92 L147 66 L173 46" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={cn(accentStroke, 'ld-draw')} />
      <circle cx="173" cy="46" r="4.5" className={cn(accent, 'ld-pulse')} />
      <Coins />
    </>
  ),

  invoices: () => (
    <>
      <Glow />
      {[0, 1, 2].map((i) => {
        const x = 78 - i * 6;
        const y = 56 - i * 8;
        return (
          <g key={i} className={`ld-shuffle ld-shuffle-${i + 1}`}>
            <rect x={x} y={y} width="96" height="72" rx="9" className={card} strokeWidth="1.5" />
            <path d={`M${x} ${y + 9} a9 9 0 0 1 9 -9 h78 a9 9 0 0 1 9 9 v5 h-96 z`} className={i === 2 ? accent : 'fill-[hsl(var(--brand-accent)/0.55)]'} />
            <rect x={x + 10} y={y + 26} width="60" height="5" rx="2.5" className={ink} />
            <rect x={x + 10} y={y + 38} width="44" height="5" rx="2.5" className={ink} />
            <rect x={x + 10} y={y + 52} width="28" height="7" rx="3.5" className={accent} />
          </g>
        );
      })}
      <g className="ld-stamp"><circle cx="168" cy="132" r="12" className="fill-[hsl(var(--card))] stroke-[hsl(var(--brand-accent))]" strokeWidth="2.5" /><path d="M162.5 132 l4 4 l7 -8" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={accentStroke} /></g>
      <Coins />
    </>
  ),

  invoice: () => (
    <>
      <Glow />
      <InvoiceArt stamp={false} />
      <rect x="74" y="50" width="92" height="7" rx="3.5" className="fill-[hsl(var(--brand-accent)/0.3)] ld-scan" />
      <Coins />
    </>
  ),

  importers: () => (
    <>
      <Glow />
      <circle cx="120" cy="92" r="52" className={card} strokeWidth="1.5" />
      <ellipse cx="120" cy="92" rx="52" ry="10" fill="none" strokeWidth="1.3" className={inkStroke} />
      <ellipse cx="120" cy="66" rx="45" ry="7" fill="none" strokeWidth="1.3" className={inkStroke} />
      <ellipse cx="120" cy="118" rx="45" ry="7" fill="none" strokeWidth="1.3" className={inkStroke} />
      {[0, 1, 2].map((i) => <ellipse key={i} cx="120" cy="92" rx="52" ry="52" fill="none" strokeWidth="1.3" className={cn(inkStroke, 'ld-meridian')} style={{ animationDelay: `${-i * 1.1}s` }} />)}
      <path d="M96 76 Q 118 52 146 84" fill="none" strokeWidth="2" strokeLinecap="round" className={cn(accentStroke, 'ld-draw')} />
      <Pin x={96} y={78} delay={0} />
      <Pin x={146} y={90} delay={0.5} />
      <Pin x={124} y={120} delay={1} />
      <Coins />
    </>
  ),

  exporter: () => (
    <>
      <Glow />
      <g className="ld-drift"><ellipse cx="60" cy="40" rx="20" ry="7" className="fill-[hsl(var(--primary)/0.08)]" /><ellipse cx="74" cy="36" rx="13" ry="6" className="fill-[hsl(var(--primary)/0.08)]" /></g>
      <g className="ld-bob">
        <rect x="80" y="100" width="22" height="18" rx="2" className={accent} />
        <rect x="104" y="100" width="22" height="18" rx="2" className="fill-amber-400" />
        <rect x="92" y="82" width="22" height="18" rx="2" className="fill-emerald-500" />
        <rect x="140" y="88" width="26" height="30" rx="3" className={card} strokeWidth="1.5" />
        <rect x="145" y="94" width="7" height="7" rx="1.5" className={ink} /><rect x="155" y="94" width="7" height="7" rx="1.5" className={ink} />
        <rect x="150" y="78" width="9" height="10" rx="2" className={accent} />
        <path d="M66 118 H180 L168 142 H80 Z" className="fill-[hsl(var(--primary))]" />
        <path d="M70 124 H176" className="stroke-white/30" strokeWidth="1.5" />
      </g>
      <Waves />
    </>
  ),

  products: () => (
    <>
      <Glow />
      <ellipse cx="120" cy="150" rx="82" ry="7" className="fill-[hsl(var(--primary)/0.1)]" />
      <Crate x={54} y={118} delay={0} produce={['fill-rose-400', 'fill-amber-400', 'fill-emerald-500']} />
      <Crate x={118} y={118} delay={0.55} produce={[accent, 'fill-emerald-500', 'fill-rose-400']} />
      <Crate x={86} y={88} delay={1.1} produce={['fill-amber-400', accent, 'fill-emerald-500']} />
    </>
  ),

  recycle: () => (
    <>
      <Glow />
      <Paper x={86} delay={0} />
      <Paper x={118} delay={0.9} />
      <Paper x={102} delay={1.8} />
      <path d="M86 84 H154 L148 146 H92 Z" className="fill-[hsl(var(--primary)/0.85)]" />
      <path d="M104 94 V136 M120 94 V136 M136 94 V136" className="stroke-white/25" strokeWidth="2" strokeLinecap="round" fill="none" />
      <g className="ld-lid"><rect x="80" y="74" width="80" height="9" rx="4.5" className={accent} /><rect x="110" y="68" width="20" height="7" rx="3.5" className={accent} /></g>
      <Coins />
    </>
  ),

  notifications: () => (
    <>
      <Glow />
      <path d="M80 72 Q 66 92 80 112" fill="none" strokeWidth="2.5" strokeLinecap="round" className={cn(accentStroke, 'ld-ping')} />
      <path d="M160 72 Q 174 92 160 112" fill="none" strokeWidth="2.5" strokeLinecap="round" className={cn(accentStroke, 'ld-ping ld-ping-2')} />
      <g className="ld-ring">
        <path d="M120 50 C 96 50 92 74 92 96 L 82 116 H158 L148 96 C148 74 144 50 120 50 Z" className={accent} />
        <circle cx="120" cy="46" r="5" className={accent} />
        <g className="ld-clapper"><circle cx="120" cy="124" r="7" className="fill-[hsl(var(--primary))]" /></g>
      </g>
      <circle cx="146" cy="62" r="7" className="fill-rose-500 ld-pulse" />
      <Coins />
    </>
  ),
};

/** The animated picture for a kind of page, drawn at `scale` of its 240 x 180 design size. */
export function Scene({ variant, scale = 1 }: { variant: LoaderVariant; scale?: number }) {
  const route = 'M18 100 C 58 4, 182 4, 222 100';
  return (
    <div aria-hidden="true" className="shrink-0" style={{ width: SCENE_W * scale, height: SCENE_H * scale }}>
      <div className="relative" style={{ width: SCENE_W, height: SCENE_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} width={SCENE_W} height={SCENE_H} className="absolute inset-0">
          {variant === 'app' ? (
            <>
              <Glow />
              <path d={route} fill="none" strokeWidth="1.5" strokeDasharray="2 6" strokeLinecap="round" className={inkStroke} />
              <InvoiceArt />
              <Coins />
              <Waves />
            </>
          ) : SCENES[variant]()}
        </svg>
        {variant === 'app' && (
          <div className="ld-plane absolute left-0 top-0" style={{ offsetPath: `path('${route}')` }}>
            <svg width="22" height="16" viewBox="0 0 22 16">
              <path d="M0 0 L22 8 L0 16 L5 8 Z" className={accent} />
              <path d="M5 8 L22 8" stroke="white" strokeOpacity="0.6" strokeWidth="1" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
