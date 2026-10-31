import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Trash2 } from 'lucide-react';
import type { Note } from '../utils/pdfModel';
import { cn } from '@/lib/utils';

export type Tool = 'select' | 'text' | 'highlight' | 'whiteout' | 'draw' | 'image';

const A4_RATIO = 595.28 / 841.89;

interface PdfPageViewProps {
  /** The opened PDF this page comes from, or null for a blank page */
  pdf: PDFDocumentProxy | null;
  index: number;
  turn: number;
  notes: Note[];
  tool: Tool;
  color: string;
  /** Text size / line width (fraction of the page width) for what is drawn next */
  size: number;
  image: { src: string; aspect: number } | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Called before a change starts, so it can be undone */
  onBegin: () => void;
  onNotes: (notes: Note[]) => void;
  /** Called after a note is placed, so the editor can go back to the select tool */
  onPlaced: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

/** One page: the picture of the page (from pdf.js) with the editable notes on top. */
const PdfPageView: React.FC<PdfPageViewProps> = ({ pdf, index, turn, notes, tool, color, size, image, selectedId, onSelect, onBegin, onNotes, onPlaced }) => {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(A4_RATIO);
  const [visible, setVisible] = useState(false);
  const [preview, setPreview] = useState<Note | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const drag = useRef<{ id: string; mode: 'move' | 'resize'; startU: number; startV: number; note: Note } | null>(null);
  /** A text note that was just placed: its text box opens for typing once the click is over */
  const placed = useRef<string | null>(null);
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const editable = turn % 360 === 0;

  // draw the page only once it is near the screen (long PDFs would otherwise render every page at once)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) setVisible(true); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !visible || !canvas.current) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    void (async () => {
      const page = await pdf.getPage(index + 1);
      const rotation = (page.rotate + turn) % 360;
      const base = page.getViewport({ scale: 1, rotation });
      const target = canvas.current;
      if (cancelled || !target) return;
      setRatio(base.width / base.height);
      const scale = (Math.min(box.current?.clientWidth ?? 800, 900) * Math.min(window.devicePixelRatio || 1, 2)) / base.width;
      const viewport = page.getViewport({ scale, rotation });
      target.width = Math.floor(viewport.width);
      target.height = Math.floor(viewport.height);
      const context = target.getContext('2d');
      if (!context) return;
      task = page.render({ canvasContext: context, canvas: target, viewport }) as unknown as typeof task;
      try { await task!.promise; } catch { /* a cancelled render */ }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, index, turn, visible]);

  const at = (e: { clientX: number; clientY: number }) => {
    const rect = box.current!.getBoundingClientRect();
    return { u: clamp((e.clientX - rect.left) / rect.width), v: clamp((e.clientY - rect.top) / rect.height), rect };
  };

  const startNote = (e: React.PointerEvent) => {
    if (!editable || e.button !== 0) return;
    const { u, v, rect } = at(e);
    if (tool === 'text') {
      onBegin();
      const note: Note = { id: uid(), kind: 'text', x: u, y: v, w: 0.3, h: 0.04, color, size, text: 'Text' };
      onNotes([...notes, note]);
      onSelect(note.id);
      placed.current = note.id;
    } else if (tool === 'image' && image) {
      onBegin();
      const w = 0.25;
      const note: Note = { id: uid(), kind: 'image', x: clamp(u - w / 2, 0, 1 - w), y: v, w, h: (w * image.aspect * rect.width) / rect.height, color, size, src: image.src };
      onNotes([...notes, note]);
      onSelect(note.id);
      onPlaced();
    } else if (tool === 'highlight' || tool === 'whiteout') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setPreview({ id: 'preview', kind: tool, x: u, y: v, w: 0, h: 0, color, size });
    } else if (tool === 'draw') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setPreview({ id: 'preview', kind: 'draw', x: 0, y: 0, w: 0, h: 0, color, size: size / 4, points: [[u, v]] });
    } else {
      onSelect(null);
    }
  };

  const moveNote = (e: React.PointerEvent) => {
    const { u, v } = at(e);
    if (drag.current) {
      const d = drag.current;
      const du = u - d.startU;
      const dv = v - d.startV;
      onNotes(notesRef.current.map((n) => n.id !== d.id ? n
        : d.mode === 'move'
          ? { ...n, x: clamp(d.note.x + du, 0, 1 - Math.min(d.note.w, 0.9)), y: clamp(d.note.y + dv, 0, 0.98), ...(n.points ? { points: d.note.points!.map(([a, b]) => [a + du, b + dv] as [number, number]) } : {}) }
          : { ...n, w: clamp(d.note.w + du, 0.02, 1 - d.note.x), h: clamp(d.note.h + dv, 0.01, 1 - d.note.y) }));
      return;
    }
    if (!preview) return;
    if (preview.kind === 'draw') setPreview({ ...preview, points: [...preview.points!, [u, v]] });
    else setPreview({ ...preview, w: u - preview.x, h: v - preview.y });
  };

  const endNote = () => {
    if (placed.current) {
      const id = placed.current;
      placed.current = null;
      setEditing(id);
      onPlaced();
      return;
    }
    if (drag.current) { drag.current = null; return; }
    if (!preview) return;
    const done = preview;
    setPreview(null);
    if (done.kind === 'draw') {
      if ((done.points?.length ?? 0) < 2) return;
      onBegin();
      onNotes([...notes, { ...done, id: uid() }]);
    } else if (Math.abs(done.w) > 0.01 && Math.abs(done.h) > 0.005) {
      onBegin();
      const note: Note = { ...done, id: uid(), x: Math.min(done.x, done.x + done.w), y: Math.min(done.y, done.y + done.h), w: Math.abs(done.w), h: Math.abs(done.h) };
      onNotes([...notes, note]);
      onSelect(note.id);
      onPlaced();
    }
  };

  const grab = (e: React.PointerEvent, note: Note, mode: 'move' | 'resize') => {
    if (!editable) return;
    e.stopPropagation();
    onSelect(note.id);
    if (editing === note.id && mode === 'move') return; // typing in the note, not moving it
    onBegin();
    const { u, v } = at(e);
    drag.current = { id: note.id, mode, startU: u, startV: v, note };
    box.current!.setPointerCapture(e.pointerId);
  };

  const remove = (id: string) => { onBegin(); onNotes(notes.filter((n) => n.id !== id)); onSelect(null); };

  const shown = editable ? (preview ? [...notes, preview] : notes) : [];
  const cursor = !editable ? 'default' : tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';

  return (
    <div
      ref={box}
      className="relative mx-auto w-full max-w-[900px] select-none overflow-hidden rounded-sm bg-white shadow-md [container-type:inline-size]"
      style={{ aspectRatio: String(ratio), cursor, touchAction: editable && tool !== 'select' ? 'none' : 'auto' }}
      onPointerDown={startNote}
      onPointerMove={moveNote}
      onPointerUp={endNote}
      onPointerCancel={endNote}
    >
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label={`Page ${index + 1}`} />
      {shown.map((n) => {
        const selected = n.id === selectedId;
        const frame = { left: `${n.x * 100}%`, top: `${n.y * 100}%`, width: `${n.w * 100}%`, height: `${n.h * 100}%` };
        if (n.kind === 'draw') {
          return (
            <svg key={n.id} className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={(n.points ?? []).map(([a, b]) => `${a * 100},${b * 100}`).join(' ')} fill="none" stroke={n.color} strokeWidth={n.size * 100} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: `${n.size * 100}cqw` }} />
            </svg>
          );
        }
        return (
          <div
            key={n.id}
            onPointerDown={(e) => n.id !== 'preview' && grab(e, n, 'move')}
            onDoubleClick={() => n.kind === 'text' && setEditing(n.id)}
            className={cn('absolute', selected && 'outline outline-2 outline-blue-500', n.kind === 'text' ? 'cursor-move' : 'cursor-move')}
            style={n.kind === 'text' ? { left: frame.left, top: frame.top, minWidth: '4%' } : frame}
          >
            {n.kind === 'text' ? (
              editing === n.id ? (
                <textarea
                  ref={(el) => { if (el && document.activeElement !== el) { el.focus(); el.select(); } }}
                  value={n.text}
                  onChange={(e) => onNotes(notes.map((x) => (x.id === n.id ? { ...x, text: e.target.value } : x)))}
                  onBlur={() => setEditing(null)}
                  onPointerDown={(e) => e.stopPropagation()}
                  rows={Math.max(1, (n.text ?? '').split('\n').length)}
                  className="block min-w-[10ch] resize-none overflow-hidden whitespace-pre bg-white/70 p-0 font-sans leading-[1.25] outline-none"
                  style={{ color: n.color, fontSize: `${n.size * 100}cqw`, width: `${Math.max(10, ...(n.text ?? '').split('\n').map((l) => l.length + 1))}ch` }}
                  aria-label="Note text"
                />
              ) : (
                <div className="whitespace-pre font-sans leading-[1.25]" style={{ color: n.color, fontSize: `${n.size * 100}cqw` }}>{n.text}</div>
              )
            ) : n.kind === 'image' ? (
              <img src={n.src} alt="" draggable={false} className="h-full w-full object-fill" />
            ) : (
              <div className="h-full w-full" style={{ background: n.kind === 'whiteout' ? '#ffffff' : n.color, opacity: n.kind === 'whiteout' ? 1 : 0.4 }} />
            )}
            {selected && n.id !== 'preview' && (
              <>
                <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => remove(n.id)} className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow" aria-label="Delete note"><Trash2 className="h-3 w-3" /></button>
                {n.kind !== 'text' && <span onPointerDown={(e) => grab(e, n, 'resize')} className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-blue-500" aria-label="Resize" />}
              </>
            )}
          </div>
        );
      })}
      {!editable && <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">Turn the page back to 0° to add or move notes</span>}
    </div>
  );
};

export default PdfPageView;
