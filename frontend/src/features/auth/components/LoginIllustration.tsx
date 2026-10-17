import { useMemo, type ReactNode } from 'react';

const ROUTE_1 = 'M140 705 C 430 250, 1010 190, 1305 480';
const ROUTE_2 = 'M215 835 C 520 610, 905 650, 1190 812';

/**
 * Full-bleed vector scene for the login screen, themed around exporting produce by sea and air:
 * flight routes, a cargo ship on layered waves, a wireframe globe, invoices, coins and produce.
 * Everything is decorative (aria-hidden) and stays low-contrast so the form remains the focus.
 */
export default function LoginIllustration() {
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full text-white"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <linearGradient id="lg-wave-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(176 75% 48%)" stopOpacity="0.34" />
          <stop offset="1" stopColor="hsl(190 70% 20%)" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="lg-wave-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(190 80% 55%)" stopOpacity="0.26" />
          <stop offset="1" stopColor="hsl(200 70% 18%)" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="lg-wave-c" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(22 100% 58%)" stopOpacity="0.2" />
          <stop offset="1" stopColor="hsl(22 100% 40%)" stopOpacity="0.04" />
        </linearGradient>
        <radialGradient id="lg-globe" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.02" />
        </radialGradient>
      </defs>

      {/* ───────── Concentric rings behind the form (with orbiting dots) ───────── */}
      <g stroke="currentColor">
        <circle cx="1060" cy="400" r="250" strokeOpacity="0.1" />
        <circle cx="1060" cy="400" r="345" strokeOpacity="0.09" strokeDasharray="3 11" />
        <circle cx="1060" cy="400" r="445" strokeOpacity="0.06" />
        <circle cx="1060" cy="400" r="560" strokeOpacity="0.04" strokeDasharray="2 14" />
      </g>
      <g fill="currentColor" fillOpacity="0.4">
        <circle cx="1310" cy="400" r="5" />
        <circle cx="880" cy="632" r="4" />
        <circle cx="1100" cy="52" r="3.5" />
        <circle cx="760" cy="300" r="3" />
      </g>
      <circle cx="1060" cy="55" r="7" fill="hsl(22 100% 55%)" fillOpacity="0.65" />
      <circle cx="1365" cy="480" r="5" fill="hsl(175 80% 55%)" fillOpacity="0.7" />

      {/* ───────── Wireframe globe (top-left) ───────── */}
      <g className="login-bob" style={{ ['--d' as string]: '-3s' }}>
        <circle cx="205" cy="185" r="128" fill="url(#lg-globe)" stroke="currentColor" strokeOpacity="0.22" />
        <g stroke="currentColor" strokeOpacity="0.16">
          <ellipse cx="205" cy="185" rx="128" ry="46" />
          <ellipse cx="205" cy="185" rx="92" ry="128" />
          <ellipse cx="205" cy="185" rx="42" ry="128" />
          <path d="M77 185h256M205 57v256" />
          <path d="M96 118c70 22 142 22 218 0M96 252c70-22 142-22 218 0" />
        </g>
        <path d="M138 128c14-16 40-18 52-6 8 8-2 20-14 22-10 2-8 14-22 12-12-2-26-14-16-28Z" fill="currentColor" fillOpacity="0.14" />
        <path d="M232 170c18-8 40 0 44 16 4 14-12 20-18 36-6 12-20 6-24-8-4-14-12-30-2-44Z" fill="currentColor" fillOpacity="0.14" />
        {/* map pin on the globe */}
        <g transform="translate(262 128)">
          <path d="M0 0c-9-12-13-17-13-24a13 13 0 0 1 26 0c0 7-4 12-13 24Z" fill="hsl(22 100% 55%)" fillOpacity="0.85" />
          <circle cy="-24" r="5" fill="#fff" fillOpacity="0.9" />
        </g>
      </g>

      {/* ───────── Flight routes ───────── */}
      <path d={ROUTE_1} stroke="hsl(22 100% 60%)" strokeOpacity="0.42" strokeWidth="2" className="login-dash" />
      <path d={ROUTE_2} stroke="hsl(175 80% 62%)" strokeOpacity="0.4" strokeWidth="2" className="login-dash login-dash-slow" />
      <Pin x={140} y={705} color="hsl(22 100% 58%)" />
      <Pin x={1305} y={480} color="hsl(22 100% 58%)" />
      <Pin x={215} y={835} color="hsl(175 80% 58%)" />
      <Pin x={1190} y={812} color="hsl(175 80% 58%)" />
      <Plane path={ROUTE_1} dur="16s" color="hsl(22 100% 62%)" animate={!reduceMotion} fallback={{ x: 700, y: 245, r: -4 }} />
      <Plane path={ROUTE_2} dur="22s" color="hsl(175 80% 66%)" animate={!reduceMotion} fallback={{ x: 700, y: 700, r: 3 }} begin="-9s" />

      {/* ───────── Waves ───────── */}
      <g className="login-wave login-wave-1">
        <path d="M-80 748C160 706 400 790 650 748S1120 704 1380 752 1560 770 1560 770V920H-80Z" fill="url(#lg-wave-a)" />
        <path d="M-80 748C160 706 400 790 650 748S1120 704 1380 752" stroke="currentColor" strokeOpacity="0.22" />
      </g>
      <g className="login-wave login-wave-2">
        <path d="M-80 805C200 764 430 850 720 806S1170 770 1400 812 1560 820 1560 820V920H-80Z" fill="url(#lg-wave-b)" />
        <path d="M-80 805C200 764 430 850 720 806S1170 770 1400 812" stroke="currentColor" strokeOpacity="0.16" />
      </g>
      <g className="login-wave login-wave-3">
        <path d="M-80 860C240 826 470 898 790 860S1200 836 1560 868V920H-80Z" fill="url(#lg-wave-c)" />
      </g>
      <g stroke="currentColor" strokeOpacity="0.14">
        <path d="M80 786q22-12 44 0t44 0M520 826q22-12 44 0t44 0M960 792q22-12 44 0t44 0M1260 846q22-12 44 0t44 0" />
      </g>

      {/* ───────── Cargo ship ───────── */}
      <Bob transform="translate(150 640)" d="-1s">
        <path d="M0 58h262l-30 42H34Z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeOpacity="0.38" />
        <path d="M14 74h234" stroke="hsl(22 100% 58%)" strokeOpacity="0.55" strokeWidth="3" />
        {/* containers */}
        {[
          [14, 40, 'hsl(22 100% 58%)'],
          [42, 40, '#fff'],
          [70, 40, 'hsl(175 80% 55%)'],
          [98, 40, 'hsl(22 100% 58%)'],
          [126, 40, '#fff'],
          [154, 40, 'hsl(175 80% 55%)'],
          [28, 22, '#fff'],
          [56, 22, 'hsl(22 100% 58%)'],
          [84, 22, 'hsl(175 80% 55%)'],
          [112, 22, '#fff'],
          [70, 4, 'hsl(22 100% 58%)'],
          [98, 4, '#fff'],
        ].map(([x, y, c]) => (
          <g key={`${x}-${y}`}>
            <rect x={x as number} y={y as number} width="26" height="17" rx="2" fill={c as string} fillOpacity="0.28" stroke={c as string} strokeOpacity="0.55" />
            <path d={`M${(x as number) + 7} ${(y as number) + 3}v11M${(x as number) + 13} ${(y as number) + 3}v11M${(x as number) + 19} ${(y as number) + 3}v11`} stroke={c as string} strokeOpacity="0.4" />
          </g>
        ))}
        {/* bridge + funnel */}
        <rect x="196" y="16" width="44" height="42" rx="3" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeOpacity="0.4" />
        <path d="M204 28h28M204 38h28M204 48h28" stroke="currentColor" strokeOpacity="0.35" />
        <rect x="214" y="0" width="12" height="16" rx="2" fill="hsl(22 100% 58%)" fillOpacity="0.5" />
      </Bob>

      {/* ───────── Dock containers + crane (bottom-right) ───────── */}
      <Bob transform="translate(1135 742) scale(0.85)" d="-5s">
        <path d="M10 0h120v-78M10 0V-78h120M10 -78 70 -118 130 -78M40 -78V0M100 -78V0" stroke="currentColor" strokeOpacity="0.26" />
        <path d="M70 -118v34" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 5" />
        <rect x="52" y="-86" width="36" height="16" rx="2" fill="hsl(22 100% 58%)" fillOpacity="0.4" stroke="hsl(22 100% 58%)" strokeOpacity="0.7" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x={150 + i * 50} y="-34" width="46" height="26" rx="2" fill={i === 1 ? 'hsl(175 80% 55%)' : '#fff'} fillOpacity="0.2" stroke="currentColor" strokeOpacity="0.4" />
            <path d={`M${160 + i * 50} -30v18M${170 + i * 50} -30v18M${180 + i * 50} -30v18`} stroke="currentColor" strokeOpacity="0.3" />
          </g>
        ))}
        <rect x="175" y="-62" width="46" height="26" rx="2" fill="hsl(22 100% 58%)" fillOpacity="0.22" stroke="hsl(22 100% 58%)" strokeOpacity="0.6" />
        <path d="M185 -58v18M195 -58v18M205 -58v18" stroke="hsl(22 100% 58%)" strokeOpacity="0.45" />
      </Bob>

      {/* ───────── Invoices ───────── */}
      <Bob transform="translate(585 455) rotate(-9)" d="-2s">
        <rect width="132" height="168" rx="10" fill="currentColor" fillOpacity="0.07" stroke="currentColor" strokeOpacity="0.32" />
        <rect x="14" y="14" width="40" height="11" rx="3" fill="currentColor" fillOpacity="0.28" />
        <path d="M14 44h104M14 58h104M14 72h66M14 96h104M14 110h104" stroke="currentColor" strokeOpacity="0.26" />
        <path d="M78 148h40" stroke="currentColor" strokeOpacity="0.4" strokeWidth="3" />
        <g transform="translate(88 78) rotate(-14)" stroke="hsl(175 80% 60%)" strokeOpacity="0.8">
          <circle r="25" strokeWidth="2.5" />
          <circle r="20" strokeOpacity="0.45" />
          <path d="M-9 1l6 7 12-14" strokeWidth="3" />
        </g>
      </Bob>
      <Bob transform="translate(1235 70) rotate(8)" d="-7s">
        <rect width="150" height="178" rx="10" fill="currentColor" fillOpacity="0.07" stroke="currentColor" strokeOpacity="0.3" />
        <rect x="14" y="14" width="46" height="11" rx="3" fill="hsl(22 100% 58%)" fillOpacity="0.55" />
        <path d="M14 40h122" stroke="currentColor" strokeOpacity="0.3" />
        <path d="M14 58h36M64 58h24M100 58h36M14 76h36M64 76h24M100 76h36M14 94h36M64 94h24M100 94h36" stroke="currentColor" strokeOpacity="0.24" />
        <path d="M14 114h122" stroke="currentColor" strokeOpacity="0.3" />
        <rect x="76" y="128" width="60" height="26" rx="5" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeOpacity="0.4" />
        <path d="M86 141h26" stroke="currentColor" strokeOpacity="0.5" strokeWidth="3" />
      </Bob>

      {/* ───────── Coins ───────── */}
      <Coin x={600} y={118} r={30} label="$" delay="-4s" />
      <Coin x={1340} y={338} r={23} label="₹" delay="-8s" />
      <Coin x={455} y={555} r={21} label="€" delay="-1s" />
      <Coin x={760} y={420} r={15} label="£" delay="-6s" />

      {/* ───────── Produce ───────── */}
      <Bob transform="translate(505 262)" d="-3.5s">
        <path d="M0 30C-6 6 6-14 30-22 34 4 20 26 0 30Z" fill="hsl(150 70% 50%)" fillOpacity="0.28" stroke="hsl(150 70% 60%)" strokeOpacity="0.6" />
        <path d="M0 30C8 18 16 6 30-22" stroke="hsl(150 70% 60%)" strokeOpacity="0.55" />
        <path d="M2 34C20 40 44 30 52 8 30 4 8 14 2 34Z" fill="hsl(150 70% 50%)" fillOpacity="0.2" stroke="hsl(150 70% 60%)" strokeOpacity="0.5" />
      </Bob>
      <Bob transform="translate(905 108)" d="-9s">
        <path d="M0 -10C-22 -26-40 -4-32 22-26 40-8 46 0 40 8 46 26 40 32 22 40-4 22-26 0-10Z" fill="hsl(8 85% 58%)" fillOpacity="0.26" stroke="hsl(8 85% 66%)" strokeOpacity="0.6" />
        <path d="M0 -10C0 -22 4 -30 12 -34" stroke="hsl(30 60% 70%)" strokeOpacity="0.7" strokeWidth="2.5" />
        <path d="M6 -26c8-10 20-10 26-6-4 10-16 14-26 6Z" fill="hsl(150 70% 50%)" fillOpacity="0.4" />
        <path d="M-16 4c-2 8 0 14 6 18" stroke="#fff" strokeOpacity="0.4" />
      </Bob>
      <Bob transform="translate(540 705)" d="-5.5s">
        <circle r="27" fill="hsl(30 100% 55%)" fillOpacity="0.2" stroke="hsl(30 100% 62%)" strokeOpacity="0.65" />
        <circle r="21" stroke="hsl(30 100% 70%)" strokeOpacity="0.4" />
        <path d="M0 -21V21M-21 0H21M-15 -15 15 15M15 -15-15 15" stroke="hsl(30 100% 70%)" strokeOpacity="0.4" />
      </Bob>

      {/* ───────── Sparkles, plus signs, dot grids ───────── */}
      {[
        [370, 90, 1],
        [780, 170, 0.7],
        [1180, 255, 0.9],
        [330, 470, 0.8],
        [900, 540, 1],
        [1395, 200, 0.7],
        [60, 600, 0.9],
        [560, 80, 0.6],
      ].map(([x, y, s], i) => (
        <g key={`sp-${i}`} transform={`translate(${x} ${y}) scale(${s})`}>
          <path
            d="M0-14C1-5 5-1 14 0 5 1 1 5 0 14-1 5-5 1-14 0-5-1-1-5 0-14Z"
            fill="currentColor"
            fillOpacity="0.5"
            className="login-twinkle"
            style={{ ['--d' as string]: `${-i * 1.3}s` }}
          />
        </g>
      ))}
      <g stroke="currentColor" strokeOpacity="0.3">
        <path d="M455 360v14M448 367h14" />
        <path d="M1015 120v14M1008 127h14" />
        <path d="M1280 600v14M1273 607h14" />
        <path d="M300 640v14M293 647h14" />
      </g>
      <DotGrid x={44} y={590} />
      <DotGrid x={1340} y={560} />
      <DotGrid x={700} y={40} cols={6} rows={2} />
    </svg>
  );
}

/** Position with a transform attribute on the outside; the CSS bobbing animation lives on the inner group. */
function Bob({ transform, d, children }: { transform: string; d: string; children: ReactNode }) {
  return (
    <g transform={transform}>
      <g className="login-bob" style={{ ['--d' as string]: d }}>
        {children}
      </g>
    </g>
  );
}

function Pin({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="12" fill={color} fillOpacity="0.16" />
      <circle r="5" fill={color} fillOpacity="0.9" />
    </g>
  );
}

function Plane({
  path,
  dur,
  color,
  animate,
  fallback,
  begin = '0s',
}: {
  path: string;
  dur: string;
  color: string;
  animate: boolean;
  fallback: { x: number; y: number; r: number };
  begin?: string;
}) {
  const shape = (
    <g>
      <path d="M-13 -7 14 0 -13 7-8 0Z" fill={color} fillOpacity="0.9" />
      <path d="M-8 0H-26" stroke={color} strokeOpacity="0.5" strokeWidth="2" />
    </g>
  );
  if (!animate) return <g transform={`translate(${fallback.x} ${fallback.y}) rotate(${fallback.r})`}>{shape}</g>;
  return (
    <g>
      {shape}
      <animateMotion dur={dur} begin={begin} repeatCount="indefinite" rotate="auto" path={path} />
    </g>
  );
}

function Coin({ x, y, r, label, delay }: { x: number; y: number; r: number; label: string; delay: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="login-bob" style={{ ['--d' as string]: delay }}>
        <circle r={r} fill="hsl(40 95% 60%)" fillOpacity="0.14" stroke="hsl(40 95% 68%)" strokeOpacity="0.6" strokeWidth="2" />
        <circle r={r - 6} stroke="hsl(40 95% 72%)" strokeOpacity="0.35" strokeDasharray="2 4" />
        <text textAnchor="middle" dominantBaseline="central" fontSize={r * 0.95} fontWeight="700" fill="hsl(40 95% 75%)" fillOpacity="0.8" stroke="none" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">
          {label}
        </text>
      </g>
    </g>
  );
}

function DotGrid({ x, y, cols = 5, rows = 5 }: { x: number; y: number; cols?: number; rows?: number }) {
  return (
    <g fill="currentColor" fillOpacity="0.28" transform={`translate(${x} ${y})`}>
      {Array.from({ length: rows }).flatMap((_, r) =>
        Array.from({ length: cols }).map((__, c) => <circle key={`${r}-${c}`} cx={c * 14} cy={r * 14} r="1.8" />),
      )}
    </g>
  );
}
