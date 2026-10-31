import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ArrowDown, ArrowLeft, ArrowUp, Copy, Download, FilePlus2, FileStack, Highlighter, ImagePlus, MousePointer2, Pencil, Redo2, RotateCcw, RotateCw, Save, Square, Trash2, Type, Undo2,
} from 'lucide-react';
import PdfPageView, { type Tool } from '../components/PdfPageView';
import { useDocument, useSaveDocumentFile } from '../hooks/useDocuments';
import { documentService, type Document } from '../services/documentService';
import { BLANK_SOURCE, buildPdf, type Note, type PageState } from '../utils/pdfModel';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const uid = () => Math.random().toString(36).slice(2, 10);
const SIZES: { label: string; value: number }[] = [{ label: 'Small', value: 0.014 }, { label: 'Medium', value: 0.022 }, { label: 'Large', value: 0.034 }, { label: 'Extra large', value: 0.05 }];
const HISTORY_LIMIT = 40;
const MAX_PICTURE_BYTES = 3 * 1024 * 1024;

const TOOLS: { tool: Tool; label: string; icon: typeof Type }[] = [
  { tool: 'select', label: 'Select and move', icon: MousePointer2 },
  { tool: 'text', label: 'Add text', icon: Type },
  { tool: 'highlight', label: 'Highlight', icon: Highlighter },
  { tool: 'draw', label: 'Draw', icon: Pencil },
  { tool: 'whiteout', label: 'Cover with white', icon: Square },
  { tool: 'image', label: 'Add a picture or signature', icon: ImagePlus },
];

/** Opens PDF bytes for display; pdf.js takes over the buffer it is given, so it gets a copy. */
async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  return pdfjs.getDocument({ data: bytes.slice() }).promise;
}

interface Loaded {
  sources: Uint8Array[];
  docs: PDFDocumentProxy[];
  pages: PageState[];
}

/** Bytes as a file the browser can upload (a copy, so the buffer type is a plain ArrayBuffer). */
const pdfBlob = (bytes: Uint8Array) => new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });

const pagesOf = (source: number, count: number): PageState[] => Array.from({ length: count }, (_, index) => ({ id: uid(), source, index, turn: 0, notes: [] }));

interface PdfEditorProps {
  doc: Document;
  loaded: Loaded;
}

const PdfEditor: React.FC<PdfEditorProps> = ({ doc, loaded }) => {
  const { showToast } = useToast();
  const saveFile = useSaveDocumentFile();
  const [data, setData] = useState<Loaded>(loaded);
  const [history, setHistory] = useState<PageState[][]>([]);
  const [future, setFuture] = useState<PageState[][]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState('#dc2626');
  const [size, setSize] = useState(SIZES[1]!.value);
  const [picture, setPicture] = useState<{ src: string; aspect: number } | null>(null);
  const [selected, setSelected] = useState<{ pageId: string; noteId: string } | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const pictureInput = useRef<HTMLInputElement>(null);
  const mergeInput = useRef<HTMLInputElement>(null);
  const pagesRef = useRef(data.pages);
  pagesRef.current = data.pages;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /** Every change goes through here, so Undo and Redo can step back and forward. */
  const record = useCallback(() => {
    setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), pagesRef.current]);
    setFuture([]);
    setDirty(true);
  }, []);
  const setPages = useCallback((pages: PageState[]) => { pagesRef.current = pages; setData((d) => ({ ...d, pages })); }, []);
  const edit = (change: (pages: PageState[]) => PageState[]) => { record(); setPages(change(pagesRef.current)); };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setFuture((f) => [pagesRef.current, ...f]);
    setHistory((h) => h.slice(0, -1));
    setPages(previous);
    setSelected(null);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory((h) => [...h, pagesRef.current]);
    setFuture((f) => f.slice(1));
    setPages(next);
    setSelected(null);
  };

  const selectedNote: Note | undefined = useMemo(() => data.pages.find((p) => p.id === selected?.pageId)?.notes.find((n) => n.id === selected?.noteId), [data.pages, selected]);

  const changeSelected = (patch: Partial<Note>) => {
    if (!selected) return;
    edit((pages) => pages.map((p) => (p.id !== selected.pageId ? p : { ...p, notes: p.notes.map((n) => (n.id === selected.noteId ? { ...n, ...patch } : n)) })));
  };

  const onColor = (value: string) => { setColor(value); if (selectedNote) changeSelected({ color: value }); };
  const onSize = (value: number) => { setSize(value); if (selectedNote && (selectedNote.kind === 'text' || selectedNote.kind === 'draw')) changeSelected({ size: selectedNote.kind === 'draw' ? value / 4 : value }); };

  // ---- page operations
  const move = (i: number, by: number) => edit((pages) => {
    const next = [...pages];
    const [page] = next.splice(i, 1);
    next.splice(Math.min(Math.max(i + by, 0), next.length), 0, page!);
    return next;
  });
  const turn = (i: number, by: number) => edit((pages) => pages.map((p, k) => (k === i ? { ...p, turn: (p.turn + by + 360) % 360 } : p)));
  const duplicate = (i: number) => edit((pages) => {
    const next = [...pages];
    const page = pages[i]!;
    next.splice(i + 1, 0, { ...page, id: uid(), notes: page.notes.map((n) => ({ ...n, id: uid() })) });
    return next;
  });
  const removePage = (i: number) => {
    if (data.pages.length <= 1) return showToast('A PDF needs at least one page', undefined, 'info');
    edit((pages) => pages.filter((_, k) => k !== i));
  };
  const addBlank = (i: number) => edit((pages) => { const next = [...pages]; next.splice(i + 1, 0, { id: uid(), source: BLANK_SOURCE, index: 0, turn: 0, notes: [] }); return next; });

  const onPicture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) return showToast('Picture not added', 'Choose a PNG or JPEG picture.', 'error');
    if (file.size > MAX_PICTURE_BYTES) return showToast('Picture not added', 'That picture is larger than 3 MB.', 'error');
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const img = new window.Image();
      img.onload = () => { setPicture({ src, aspect: img.naturalHeight / img.naturalWidth }); setTool('image'); };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const onMerge = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (new TextDecoder('latin1').decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('That is not a PDF file.');
      const added = await openPdf(bytes);
      record();
      const source = data.sources.length;
      setData((d) => ({ sources: [...d.sources, bytes], docs: [...d.docs, added], pages: [...d.pages, ...pagesOf(source, added.numPages)] }));
      pagesRef.current = [...pagesRef.current, ...pagesOf(source, added.numPages)];
      showToast('Pages added', `${added.numPages} page${added.numPages === 1 ? '' : 's'} added at the end.`, 'success');
    } catch (error) {
      showToast('Could not add that PDF', (error as Error).message, 'error');
    }
  };

  const toggleChecked = (id: string) => setChecked((c) => { const next = new Set(c); if (!next.delete(id)) next.add(id); return next; });

  // ---- saving
  const save = async () => {
    setBusy(true);
    try {
      const bytes = await buildPdf(data.sources, data.pages);
      await saveFile.mutateAsync({ id: doc.id, file: pdfBlob(bytes), filename: `${doc.title}.pdf` });
      const reopened = await openPdf(bytes);
      pagesRef.current = pagesOf(0, reopened.numPages);
      setData({ sources: [bytes], docs: [reopened], pages: pagesRef.current });
      setHistory([]); setFuture([]); setSelected(null); setChecked(new Set()); setDirty(false);
      showToast('Saved', 'Your changes were saved to the PDF.', 'success');
    } catch (error) {
      showToast('Could not save', (error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const extract = async () => {
    const chosen = data.pages.filter((p) => checked.has(p.id));
    if (!chosen.length) return;
    setBusy(true);
    try {
      const bytes = await buildPdf(data.sources, chosen);
      const created = await documentService.importFile(new File([pdfBlob(bytes)], `${doc.title} (pages).pdf`, { type: 'application/pdf' }));
      showToast('New PDF created', `"${created.title}" has the ${chosen.length} selected page${chosen.length === 1 ? '' : 's'}. Find it in the PDF list.`, 'success');
      setChecked(new Set());
    } catch (error) {
      showToast('Could not create the new PDF', (error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    try {
      if (dirty) await save();
      await documentService.download(doc.id);
    } catch (error) {
      showToast('Could not download', (error as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link to="/documents/pdf" className="btn-icon shrink-0" aria-label="Back to documents" title="Back to documents"><ArrowLeft className="h-4 w-4" /></Link>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{doc.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground" role="status">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
          <button type="button" onClick={() => void save()} disabled={!dirty || busy} className="btn-brand disabled:opacity-50"><Save className="h-4 w-4" /> {busy ? 'Working…' : 'Save changes'}</button>
          <button type="button" onClick={() => void download()} disabled={busy} className="btn-ghost"><Download className="h-4 w-4" /> Download</button>
        </div>
      </div>

      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card px-2 py-1.5 shadow-sm" role="toolbar" aria-label="PDF tools">
        {TOOLS.map(({ tool: t, label, icon: Icon }) => (
          <button
            key={t}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={tool === t}
            onClick={() => (t === 'image' && !picture ? pictureInput.current?.click() : setTool(t))}
            className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent', tool === t && 'bg-primary/10 text-primary')}
          ><Icon className="h-4 w-4" /></button>
        ))}
        <input ref={pictureInput} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onPicture} aria-label="Choose a picture" />
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <label className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-accent" title="Colour">
          <span className="h-5 w-5 rounded-full border border-border" style={{ background: color }} />
          <input type="color" value={color} onChange={(e) => onColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Colour" />
        </label>
        <select aria-label="Text size and line width" value={SIZES.find((s) => s.value === (selectedNote?.kind === 'draw' ? selectedNote.size * 4 : selectedNote?.size ?? size))?.value ?? size} onChange={(e) => onSize(Number(e.target.value))} className="h-8 rounded-md border bg-background px-2 text-sm">
          {SIZES.map((s) => <option key={s.label} value={s.value}>{s.label}</option>)}
        </select>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <button type="button" onClick={undo} disabled={!history.length} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent disabled:opacity-40" title="Undo" aria-label="Undo"><Undo2 className="h-4 w-4" /></button>
        <button type="button" onClick={redo} disabled={!future.length} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent disabled:opacity-40" title="Redo" aria-label="Redo"><Redo2 className="h-4 w-4" /></button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <button type="button" onClick={() => mergeInput.current?.click()} className="btn-ghost !px-2.5 !py-1 text-xs"><FilePlus2 className="h-3.5 w-3.5" /> Add pages from a PDF</button>
        <input ref={mergeInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void onMerge(e)} aria-label="Choose a PDF to add" />
        <button type="button" onClick={() => void extract()} disabled={!checked.size || busy} className="btn-ghost !px-2.5 !py-1 text-xs disabled:opacity-50"><FileStack className="h-3.5 w-3.5" /> New PDF from {checked.size || 'ticked'} page{checked.size === 1 ? '' : 's'}</button>
      </div>

      <div className="space-y-6 rounded-xl bg-secondary/60 p-3 sm:p-6">
        {data.pages.map((page, i) => (
          <div key={page.id}>
            <div className="mx-auto mb-2 flex w-full max-w-[900px] flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <label className="mr-2 flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={checked.has(page.id)} onChange={() => toggleChecked(page.id)} aria-label={`Select page ${i + 1}`} />
                Page {i + 1} of {data.pages.length}
              </label>
              <span className="flex-1" />
              {[
                [`Turn page ${i + 1} left`, () => turn(i, -90), RotateCcw, false],
                [`Turn page ${i + 1} right`, () => turn(i, 90), RotateCw, false],
                [`Move page ${i + 1} up`, () => move(i, -1), ArrowUp, i === 0],
                [`Move page ${i + 1} down`, () => move(i, 1), ArrowDown, i === data.pages.length - 1],
                [`Copy page ${i + 1}`, () => duplicate(i), Copy, false],
                [`Add a blank page after page ${i + 1}`, () => addBlank(i), FilePlus2, false],
                [`Delete page ${i + 1}`, () => removePage(i), Trash2, false],
              ].map(([label, run, Icon, off]) => {
                const I = Icon as typeof Copy;
                return <button key={label as string} type="button" title={label as string} aria-label={label as string} disabled={off as boolean} onClick={run as () => void} className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent hover:text-foreground disabled:opacity-30"><I className="h-3.5 w-3.5" /></button>;
              })}
            </div>
            <PdfPageView
              pdf={page.source === BLANK_SOURCE ? null : data.docs[page.source] ?? null}
              index={page.index}
              turn={page.turn}
              notes={page.notes}
              tool={tool}
              color={color}
              size={size}
              image={picture}
              selectedId={selected?.pageId === page.id ? selected.noteId : null}
              onSelect={(noteId) => setSelected(noteId ? { pageId: page.id, noteId } : null)}
              onBegin={record}
              onPlaced={() => setTool((t) => (t === 'draw' ? t : 'select'))}
              onNotes={(notes) => setPages(pagesRef.current.map((p) => (p.id === page.id ? { ...p, notes } : p)))}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default function PdfEditorPage() {
  const { id } = useParams();
  const { data: doc, isLoading, isError } = useDocument(id);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!doc || doc.type !== 'PDF') return;
    let cancelled = false;
    void (async () => {
      try {
        const { blob } = await documentService.getFile(doc.id);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const opened = await openPdf(bytes);
        if (!cancelled) setLoaded({ sources: [bytes], docs: [opened], pages: pagesOf(0, opened.numPages) });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [doc]);

  if (isLoading || (doc && !loaded && !failed)) return <div className="py-24"><LoadingSpinner variant="invoice" size="sm" message="Opening your PDF…" /></div>;
  if (isError || !doc || doc.type !== 'PDF' || failed || !loaded) return <p className="py-24 text-center text-sm text-muted-foreground">This PDF could not be opened.</p>;
  return <PdfEditor doc={doc} loaded={loaded} />;
}
