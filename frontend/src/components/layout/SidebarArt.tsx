/** A small line drawing for the empty space in the sidebar: a cargo ship on a quiet sea, with a route to a pin. */
export default function SidebarArt() {
  const line = { fill: 'none', stroke: 'hsl(0 0% 100% / 0.22)', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  const accent = { ...line, stroke: 'hsl(var(--brand-accent) / 0.85)' } as const;

  return (
    <svg
      viewBox="0 0 220 210"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      data-testid="sidebar-art"
      className="pointer-events-none h-full max-h-44 w-full"
    >
      {/* plane and clouds */}
      <path d="M40 22l30 8-10 6-14-3-6 7-4-2 3-8-10-3z" style={line} transform="rotate(-8 55 28)" />
      <path d="M78 36h26M96 44h18" style={{ ...line, strokeDasharray: '1 5' }} />
      <path d="M118 18q6-8 14-3 6-6 14 0 7-1 8 6h-38z" style={{ ...line, stroke: 'hsl(0 0% 100% / 0.14)' }} />
      <g transform="translate(0 40)">
      {/* sun */}
      <circle cx="176" cy="34" r="12" style={accent} />
      {/* route: dashed arc to a pin */}
      <path d="M28 96C52 40 110 22 160 60" style={{ ...line, strokeDasharray: '2 6' }} />
      <path d="M160 40a8 8 0 0 1 8 8c0 7-8 15-8 15s-8-8-8-15a8 8 0 0 1 8-8z" style={accent} />
      {/* ship: hull, containers, bridge */}
      <path d="M30 124h132l-12 20H46Z" style={line} />
      <rect x="48" y="104" width="18" height="16" rx="2" style={line} />
      <rect x="70" y="104" width="18" height="16" rx="2" style={accent} />
      <rect x="92" y="104" width="18" height="16" rx="2" style={line} />
      <rect x="59" y="86" width="18" height="16" rx="2" style={line} />
      <path d="M124 124v-26h18v26M124 108h18" style={line} />
      {/* sea */}
      <path d="M14 156q12-8 24 0t24 0 24 0 24 0 24 0 24 0 24 0" style={line} />
      <path d="M30 168q12-8 24 0t24 0 24 0 24 0 24 0" style={{ ...line, stroke: 'hsl(0 0% 100% / 0.12)' }} />
      </g>
    </svg>
  );
}

/** A faint globe with meridians, tucked behind the menu in the sidebar's top corner. */
export function SidebarGlobe() {
  const line = { fill: 'none', stroke: 'hsl(0 0% 100% / 0.10)', strokeWidth: 1.5, strokeLinecap: 'round' } as const;
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" data-testid="sidebar-globe" className="pointer-events-none absolute -right-6 top-16 h-32 w-32">
      <circle cx="60" cy="60" r="48" style={line} />
      <ellipse cx="60" cy="60" rx="20" ry="48" style={line} />
      <path d="M12 60h96M20 36h80M20 84h80" style={line} />
      <path d="M22 78C44 40 80 34 104 50" style={{ ...line, stroke: 'hsl(var(--brand-accent) / 0.45)', strokeDasharray: '2 5' }} />
      <circle cx="104" cy="50" r="3.5" style={{ fill: 'hsl(var(--brand-accent) / 0.7)' }} />
    </svg>
  );
}

/** Scattered plus signs and dots: quiet texture for the middle of the sidebar. */
export function SidebarSparkles() {
  const line = { fill: 'none', stroke: 'hsl(0 0% 100% / 0.12)', strokeWidth: 1.5, strokeLinecap: 'round' } as const;
  return (
    <svg viewBox="0 0 256 400" aria-hidden="true" data-testid="sidebar-sparkles" className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
      <path d="M222 190v10M217 195h10M30 260v8M26 264h8M200 300v8M196 304h8" style={line} />
      <circle cx="40" cy="170" r="2" style={{ fill: 'hsl(0 0% 100% / 0.14)' }} />
      <circle cx="226" cy="250" r="2.5" style={{ fill: 'hsl(var(--brand-accent) / 0.5)' }} />
      <circle cx="120" cy="330" r="1.8" style={{ fill: 'hsl(0 0% 100% / 0.14)' }} />
    </svg>
  );
}
