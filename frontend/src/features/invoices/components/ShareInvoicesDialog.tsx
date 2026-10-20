import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileArchive, FileSpreadsheet, FileText, Files, Share2, X } from 'lucide-react';
import { MAX_ZIP_INVOICES } from 'shared';
import { invoiceService } from '../services/invoiceService';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { canShareFile, saveBlob, shareFile } from '@/lib/share';

type Kind = 'pdf' | 'excel';
type Mode = 'separate' | 'zip';

/** Most separate files handed to the share sheet at once. */
export const MAX_SEPARATE_FILES = 10;

const MIME: Record<Kind, string> = {
  pdf: 'application/pdf',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const sizeLabel = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** What goes with the files when someone pastes a message. */
export function bulkMessage(count: number) {
  const subject = `${count} invoices`;
  const body = `Hello,\n\nPlease find attached ${count} invoices.\n\nThank you.`;
  return { subject, body, text: `${subject}\n\n${body}` };
}

/** Send several invoices at once: as separate files through the share sheet, or as one ZIP. */
export default function ShareInvoicesDialog({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const { showToast } = useToast();
  const [kind, setKind] = useState<Kind>('pdf');
  const [mode, setMode] = useState<Mode>(ids.length > MAX_SEPARATE_FILES ? 'zip' : 'separate');
  const [files, setFiles] = useState<File[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sharing, setSharing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const message = bulkMessage(ids.length);
  const separateAllowed = ids.length <= MAX_SEPARATE_FILES;
  const tooManyForZip = ids.length > MAX_ZIP_INVOICES;

  // The files are made ahead of time: the share sheet must open straight from a click, with nothing awaited first.
  useEffect(() => {
    if (tooManyForZip && mode === 'zip') { setFiles(null); setLoadError(`A ZIP holds up to ${MAX_ZIP_INVOICES} invoices. Select fewer.`); return; }
    let cancelled = false;
    setFiles(null);
    setLoadError(null);
    const make = async (): Promise<File[]> => {
      if (mode === 'zip') {
        const { blob, filename } = await invoiceService.getZip(ids, [kind]);
        return [new File([blob], filename, { type: 'application/zip' })];
      }
      const made: File[] = [];
      for (const id of ids) {
        const { blob, filename } = await invoiceService.getDocument(id, kind);
        made.push(new File([blob], filename, { type: MIME[kind] }));
      }
      return made;
    };
    make()
      .then((made) => { if (!cancelled) setFiles(made); })
      .catch((error: unknown) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : 'The files could not be prepared.'); });
    return () => { cancelled = true; };
  }, [ids, kind, mode, attempt, tooManyForZip]);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ready = files !== null;
  // Excel and ZIP files can't be handed to other apps from a browser: the button is greyed out and points to Download
  const noShare = mode === 'zip' || kind === 'excel';
  const sheetAvailable = !noShare && ready && canShareFile(files);
  const totalSize = files?.reduce((s, f) => s + f.size, 0) ?? 0;

  const openShareSheet = async () => {
    if (!files) return;
    setSharing(true);
    try {
      const outcome = await shareFile(files, message);
      if (outcome === 'shared') { showToast('Shared', `${files.length === 1 ? files[0]!.name : `${files.length} files`} sent to the app you picked.`, 'success'); onClose(); }
      if (outcome === 'blocked') explain();
    } catch (error) {
      showToast("Couldn't open the share sheet", error instanceof Error ? error.message : 'Download the files and attach them yourself instead.', 'error');
    } finally {
      setSharing(false);
    }
  };

  /** This browser won't pass these files to other apps. */
  const explain = () => {
    showToast("This browser can't share files to other apps", 'Download the files and attach them yourself instead.', 'info');
  };

  const download = () => {
    if (!files) return;
    files.forEach((file, i) => setTimeout(() => saveBlob(file, file.name), i * 350));
    showToast('Download started', files.length === 1 ? files[0]!.name : `${files.length} files`, 'success');
  };

  const choice = (selected: boolean, onClick: () => void, icon: ReactNode, label: string, hint?: string, disabled?: boolean) => (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        selected ? 'border-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent)/0.1)] text-[hsl(var(--brand-accent))]' : 'hover:bg-accent',
      )}
    >
      <span className="flex items-center gap-2">{icon} {label}</span>
      {hint ? <span className="text-[11px] font-normal text-muted-foreground">{hint}</span> : null}
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${ids.length} invoices`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background shadow-2xl outline-none sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b bg-gradient-to-r from-[hsl(var(--primary)/0.08)] to-[hsl(var(--brand-accent)/0.14)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--brand-accent))] text-white"><Share2 className="h-4 w-4" /></span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight">Share invoices</h2>
              <p className="text-xs text-muted-foreground">{ids.length} selected</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <p className="label">File format</p>
            <div role="radiogroup" aria-label="File format" className="flex gap-2">
              {choice(kind === 'pdf', () => setKind('pdf'), <FileText className="h-4 w-4" />, 'PDF')}
              {choice(kind === 'excel', () => setKind('excel'), <FileSpreadsheet className="h-4 w-4" />, 'Excel')}
            </div>
          </div>

          <div>
            <p className="label">Share as</p>
            <div role="radiogroup" aria-label="Share as" className="flex gap-2">
              {choice(mode === 'separate', () => setMode('separate'), <Files className="h-4 w-4" />, 'Separate files', separateAllowed ? undefined : `Up to ${MAX_SEPARATE_FILES}`, !separateAllowed)}
              {choice(mode === 'zip', () => setMode('zip'), <FileArchive className="h-4 w-4" />, 'One ZIP')}
            </div>
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
              {loadError ? (
                <>
                  <span className="text-destructive">{loadError}</span>{' '}
                  {!tooManyForZip && <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-semibold underline">Try again</button>}
                </>
              ) : ready ? (
                <span>{files.length === 1 ? files[0]!.name : `${files.length} files`} · {sizeLabel(totalSize)}</span>
              ) : (
                <span>Preparing the files…</span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={sheetAvailable ? openShareSheet : explain}
            disabled={noShare || sharing || (!ready && !loadError)}
            aria-describedby="bulk-share-note"
            className={cn(
              'flex w-full flex-col items-center justify-center gap-0.5 rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50',
              sheetAvailable ? 'bg-[hsl(var(--brand-accent))] text-white shadow-sm hover:opacity-90' : noShare ? 'cursor-not-allowed bg-muted text-muted-foreground disabled:opacity-100' : 'border border-dashed text-foreground hover:bg-accent',
            )}
          >
            <span className={cn('flex items-center gap-2', noShare && 'opacity-60')}><Share2 className="h-4 w-4" /> Share to an app…</span>
            <span id="bulk-share-note" className={cn('text-[11px] font-normal', sheetAvailable ? 'text-white/85' : 'text-muted-foreground')}>
              {sheetAvailable
                ? 'Send straight to Mail, WhatsApp, Messages and more'
                : noShare
                  ? `${mode === 'zip' ? 'ZIP' : 'Excel'} files can't be shared from here. Please download ${mode === 'zip' ? 'the ZIP' : 'the files'} and share ${mode === 'zip' ? 'it' : 'them'}.`
                  : 'Works on phones, Windows and Safari. Not available in this browser'}
            </span>
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <button type="button" onClick={download} disabled={!ready} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50">
              <Download className="h-4 w-4" /> Download
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
