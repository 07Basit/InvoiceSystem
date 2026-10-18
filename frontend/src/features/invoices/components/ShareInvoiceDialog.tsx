import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Download, FileSpreadsheet, FileText, Paperclip, Share2, X } from 'lucide-react';
import { invoiceService } from '../services/invoiceService';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { canSharePdf, canShareFile, saveBlob, shareFile, shareMessage, type ShareInvoiceInfo } from '@/lib/share';

type Kind = 'pdf' | 'excel';

export interface ShareableInvoice extends ShareInvoiceInfo {
  id: string;
  importerName?: string | null | undefined;
}

interface Prepared {
  file: File;
  filename: string;
}

const MIME: Record<Kind, string> = {
  pdf: 'application/pdf',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** The fields the dialog needs, taken from a list item or a full invoice. */
export function toShareable(invoice: ShareInvoiceInfo & { id: string; importerName?: string | null; importer?: { name: string }; actualOf?: { invoiceNumber: string } | null; printedNumber?: string | null }): ShareableInvoice {
  return {
    id: invoice.id,
    // an actual invoice is sent under the number of the invoice it was made from
    invoiceNumber: invoice.printedNumber || invoice.actualOf?.invoiceNumber || invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    currency: invoice.currency,
    total: invoice.total,
    exporterName: invoice.exporterName,
    importerName: invoice.importerName ?? invoice.importer?.name,
  };
}

const sizeLabel = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** Send an invoice as a PDF or Excel file: through the device's share sheet, or by email or WhatsApp. */
export default function ShareInvoiceDialog({ invoice, onClose }: { invoice: ShareableInvoice; onClose: () => void }) {
  const { showToast } = useToast();
  const [kind, setKind] = useState<Kind>('pdf');
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canCopyFile, setCanCopyFile] = useState(false);
  const [copying, setCopying] = useState(false);
  const [fileCopied, setFileCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const message = shareMessage(invoice);

  // The file is fetched ahead of time: the share sheet must be opened straight from a click, with nothing awaited first.
  useEffect(() => {
    let cancelled = false;
    setPrepared(null);
    setLoadError(null);
    invoiceService.getDocument(invoice.id, kind)
      .then(({ blob, filename }) => {
        if (!cancelled) setPrepared({ filename, file: new File([blob], filename, { type: MIME[kind] }) });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'The file could not be prepared.');
      });
    return () => { cancelled = true; };
  }, [invoice.id, kind, attempt]);

  // Can this computer put the file itself on its clipboard? (only when the app runs on your own Mac or Windows PC)
  useEffect(() => {
    let cancelled = false;
    invoiceService.nativeShareStatus().then((status) => { if (!cancelled) setCanCopyFile(status.copyFile); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ready = prepared !== null;
  const sheetAvailable = ready && canShareFile(prepared.file);
  // PDF can be shared here but this file type can't (typical for Excel in Chrome and Brave)
  const onlyPdfShares = !sheetAvailable && kind === 'excel' && canSharePdf();
  const kindLabel = kind === 'excel' ? 'Excel' : 'PDF';

  /** Puts the file itself on the clipboard (only where the app runs on your own computer). */
  const copyFileToClipboard = useCallback(async () => {
    if (!prepared || copying) return;
    setCopying(true);
    try {
      await invoiceService.shareNative(invoice.id, kind, 'clipboard');
      setFileCopied(true);
      setTimeout(() => setFileCopied(false), 2500);
      showToast('File copied', `${prepared.filename} is on your clipboard. Paste it (⌘V / Ctrl+V) into an email or chat to attach it.`, 'success');
    } catch (error) {
      showToast("Couldn't copy the file", error instanceof Error ? error.message : 'Please try again.', 'error');
    } finally {
      setCopying(false);
    }
  }, [prepared, copying, invoice.id, kind, showToast]);

  const openShareSheet = useCallback(async () => {
    if (!prepared) return;
    setSharing(true);
    try {
      const outcome = await shareFile(prepared.file, message);
      if (outcome === 'shared') { showToast('Shared', `${prepared.filename} was sent to the app you picked.`, 'success'); onClose(); }
      if (outcome === 'blocked') {
        // the browser won't hand this type of file to other apps: put it on the clipboard instead
        if (canCopyFile) await copyFileToClipboard();
        else showToast(`This browser can't share ${kindLabel} files to other apps`, `Switch to PDF, which can be shared${kind === 'excel' ? '' : ' from another browser'}.`, 'info');
      }
    } catch (error) {
      showToast("Couldn't open the share sheet", error instanceof Error ? error.message : 'Download the file and attach it yourself instead.', 'error');
    } finally {
      setSharing(false);
    }
  }, [prepared, message, showToast, onClose, kind, kindLabel, canCopyFile, copyFileToClipboard]);

  /** The browser has no share sheet for files: say so and point to what works here. */
  const explainShareSheet = () => {
    if (onlyPdfShares) {
      if (canCopyFile) void copyFileToClipboard();
      else showToast("This browser can't share Excel files to other apps", 'Switch to PDF, which can be shared.', 'info');
      return;
    }
    showToast(
      "This browser can't share files to other apps",
      'Use Chrome, Edge or Brave on Windows, Safari on a Mac, or a phone browser. Meanwhile, download the file and attach it yourself.',
      'info',
    );
  };

  const download = () => {
    if (!prepared) return;
    saveBlob(prepared.file, prepared.filename);
    showToast(kind === 'pdf' ? 'PDF ready' : 'Excel ready', `${prepared.filename} was downloaded.`, 'success');
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      showToast('Message copied', 'Paste it into the message box (⌘V / Ctrl+V).', 'success');
    } catch {
      showToast("Couldn't copy", 'Your browser blocked access to the clipboard.', 'error');
    }
  };

  const formatButton = (value: Kind, label: string, icon: ReactNode) => (
    <button
      type="button"
      role="radio"
      aria-checked={kind === value}
      onClick={() => setKind(value)}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
        kind === value ? 'border-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent)/0.1)] text-[hsl(var(--brand-accent))]' : 'hover:bg-accent',
      )}
    >
      {icon} {label}
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Share invoice ${invoice.invoiceNumber}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background shadow-2xl outline-none sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b bg-gradient-to-r from-[hsl(var(--primary)/0.08)] to-[hsl(var(--brand-accent)/0.14)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--brand-accent))] text-white"><Share2 className="h-4 w-4" /></span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight">Share invoice</h2>
              <p className="truncate font-mono text-xs text-muted-foreground">{invoice.invoiceNumber}{invoice.importerName ? ` · ${invoice.importerName}` : ''}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <p className="label">File format</p>
            <div role="radiogroup" aria-label="File format" className="flex gap-2">
              {formatButton('pdf', 'PDF', <FileText className="h-4 w-4" />)}
              {formatButton('excel', 'Excel', <FileSpreadsheet className="h-4 w-4" />)}
            </div>
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              {loadError ? (
                <>
                  <span className="text-destructive">{loadError}</span>
                  <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-semibold underline">Try again</button>
                </>
              ) : ready ? (
                <span className="truncate">{prepared.filename} · {sizeLabel(prepared.file.size)}</span>
              ) : (
                <span>Preparing the file…</span>
              )}
            </p>
          </div>

          {/* Always shown. Where the browser can't hand over a file it explains why instead of vanishing. */}
          <button
            type="button"
            onClick={sheetAvailable ? openShareSheet : explainShareSheet}
            disabled={sharing || (!ready && !loadError)}
            aria-describedby="share-sheet-note"
            className={cn(
              'flex w-full flex-col items-center justify-center gap-0.5 rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50',
              sheetAvailable
                ? 'bg-[hsl(var(--brand-accent))] text-white shadow-sm hover:opacity-90'
                : 'border border-dashed text-foreground hover:bg-accent',
            )}
          >
            <span className="flex items-center gap-2"><Share2 className="h-4 w-4" /> Share to an app…</span>
            <span id="share-sheet-note" className={cn('text-[11px] font-normal', sheetAvailable ? 'text-white/85' : 'text-muted-foreground')}>
              {sheetAvailable ? 'Send the file straight to Mail, WhatsApp, Messages and more' : onlyPdfShares ? canCopyFile ? 'This browser can only share PDF files. Excel is copied to your clipboard instead' : 'This browser can only share PDF files. Switch to PDF to share' : 'Works on phones, Windows and Safari. Not available in this browser'}
            </span>
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <button type="button" onClick={download} disabled={!ready} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50">
              <Download className="h-4 w-4" /> Download
            </button>
            <div className="flex items-center gap-1">
              {canCopyFile && (
                <button
                  type="button"
                  onClick={copyFileToClipboard}
                  disabled={!ready || copying}
                  title="Copy the file itself, then paste it into an email or chat"
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  {fileCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Paperclip className="h-4 w-4" />} {fileCopied ? 'File copied' : 'Copy file'}
                </button>
              )}
              <button type="button" onClick={copyMessage} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent">
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? 'Message copied' : 'Copy message'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
