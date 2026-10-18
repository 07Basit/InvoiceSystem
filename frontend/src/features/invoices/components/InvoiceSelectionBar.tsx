import { useEffect, useRef, useState } from 'react';
import { ChevronUp, Download, Share2, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAX_ZIP_INVOICES } from 'shared';

export type DownloadFormat = 'pdf' | 'excel';

interface InvoiceSelectionBarProps {
  count: number;
  onClear: () => void;
  onDownload: (formats: DownloadFormat[]) => void;
  onShare: () => void;
  onDelete: () => void;
  busy?: boolean;
}

/** What the Download button will produce for this selection. */
export function downloadLabel(count: number, formats: DownloadFormat[]): string {
  if (formats.length === 0) return 'Choose a format';
  if (count === 1 && formats.length === 1) return formats[0] === 'pdf' ? 'Download PDF' : 'Download Excel';
  return 'Download ZIP';
}

/** Sticks to the bottom of the list while invoices are ticked: Download, Share and Delete act on all of them. */
export default function InvoiceSelectionBar({ count, onClear, onDownload, onShare, onDelete, busy }: InvoiceSelectionBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [formats, setFormats] = useState<DownloadFormat[]>(['pdf']);
  const menuRef = useRef<HTMLDivElement>(null);
  const tooMany = count > MAX_ZIP_INVOICES;

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const toggle = (format: DownloadFormat) => setFormats((f) => (f.includes(format) ? f.filter((x) => x !== format) : [...f, format]));

  return (
    <div role="toolbar" aria-label="Actions for selected invoices" className="sticky bottom-4 z-30 mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-3 shadow-lg">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold">{count} selected</span>
        <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Clear</button>
      </div>

      <div className="flex items-center gap-2">
        <div ref={menuRef} className="relative">
          <button type="button" onClick={() => setMenuOpen((o) => !o)} disabled={busy} aria-expanded={menuOpen} aria-haspopup="dialog" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50">
            <Download className="h-4 w-4" /> Download <ChevronUp className={cn('h-3.5 w-3.5 transition-transform', !menuOpen && 'rotate-180')} />
          </button>
          {menuOpen && (
            <div role="dialog" aria-label="Download selected invoices" className="absolute bottom-full right-0 mb-2 w-64 rounded-xl border bg-card p-3 shadow-lg">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Include</p>
              {(['pdf', 'excel'] as const).map((format) => (
                <label key={format} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-accent">
                  <input type="checkbox" checked={formats.includes(format)} onChange={() => toggle(format)} className="h-4 w-4 accent-[hsl(var(--brand-accent))]" />
                  {format === 'pdf' ? 'PDF files' : 'Excel files'}
                </label>
              ))}
              {count > 1 || formats.length > 1 ? <p className="mt-1 text-xs text-muted-foreground">Everything arrives in one ZIP file.</p> : null}
              {tooMany && <p className="mt-1 text-xs text-destructive">A ZIP holds up to {MAX_ZIP_INVOICES} invoices. Select fewer.</p>}
              <button
                type="button"
                disabled={formats.length === 0 || tooMany}
                onClick={() => { setMenuOpen(false); onDownload(formats); }}
                className="mt-3 w-full rounded-lg bg-[hsl(var(--brand-accent))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {downloadLabel(count, formats)}
              </button>
            </div>
          )}
        </div>
        <button type="button" onClick={onShare} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"><Share2 className="h-4 w-4" /> Share</button>
        <button type="button" onClick={onDelete} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Delete</button>
      </div>
    </div>
  );
}
