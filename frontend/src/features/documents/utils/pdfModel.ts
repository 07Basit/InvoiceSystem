import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

/**
 * The PDF editor keeps a list of pages (each pointing at a page of an opened PDF, or a blank page) and the notes
 * placed on them. `buildPdf` turns that list into the finished file. Positions and sizes of notes are fractions of the
 * page as it is first shown (0..1 from the top-left), so they do not depend on the zoom of the screen.
 */

export type NoteKind = 'text' | 'highlight' | 'whiteout' | 'draw' | 'image';

export interface Note {
  id: string;
  kind: NoteKind;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  /** Text size, or the line width of a drawing, as a fraction of the page width */
  size: number;
  text?: string;
  /** A drawing: points as fractions of the page */
  points?: [number, number][];
  /** A picture: a PNG or JPEG data URL */
  src?: string;
}

export const BLANK_SOURCE = -1;

export interface PageState {
  id: string;
  /** Which opened PDF the page comes from, or BLANK_SOURCE for a new empty page */
  source: number;
  /** The page's number in that PDF (0-based) */
  index: number;
  /** Turned by the user, clockwise, in degrees (0, 90, 180, 270) */
  turn: number;
  notes: Note[];
}

const A4: [number, number] = [595.28, 841.89];

export function hexToRgb(hex: string) {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? '000000';
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
}

/**
 * A point of the page as it is shown (u across, v down, both 0..1) in the page's own coordinates, for a page whose
 * built-in rotation is `rotation`. PDF pages can carry a /Rotate; the view shows them already turned.
 */
export function toUserPoint(u: number, v: number, width: number, height: number, rotation: number): [number, number] {
  switch (((rotation % 360) + 360) % 360) {
    case 90: return [v * width, u * height];
    case 180: return [(1 - u) * width, v * height];
    case 270: return [(1 - v) * width, (1 - u) * height];
    default: return [u * width, (1 - v) * height];
  }
}

/** Replaces characters the built-in font cannot draw. */
function printable(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  return [...text].map((ch) => (ch === '\n' || supported.has(ch.codePointAt(0)!) ? ch : '?')).join('');
}

function dataUrlBytes(src: string): { bytes: Uint8Array; png: boolean } | null {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(src);
  if (!m) return null;
  const binary = atob(m[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, png: m[1]!.toLowerCase() === 'png' };
}

async function drawNotes(out: PDFDocument, page: PDFPage, font: PDFFont, notes: Note[]) {
  const { width, height } = page.getSize();
  const rotation = page.getRotation().angle;
  const sideways = rotation % 180 !== 0;
  const shownW = sideways ? height : width;
  const shownH = sideways ? width : height;
  const point = (u: number, v: number) => toUserPoint(u, v, width, height, rotation);

  for (const note of notes) {
    if (note.kind === 'highlight' || note.kind === 'whiteout') {
      const [x1, y1] = point(note.x, note.y);
      const [x2, y2] = point(note.x + note.w, note.y + note.h);
      page.drawRectangle({
        x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1),
        color: note.kind === 'whiteout' ? rgb(1, 1, 1) : hexToRgb(note.color), opacity: note.kind === 'whiteout' ? 1 : 0.4,
      });
    } else if (note.kind === 'text' && note.text) {
      const size = Math.max(4, note.size * shownW);
      printable(note.text, font).split('\n').forEach((line, i) => {
        const [x, y] = point(note.x, note.y + (size * 0.82 + i * size * 1.25) / shownH);
        if (line) page.drawText(line, { x, y, size, font, color: hexToRgb(note.color), rotate: degrees(rotation) });
      });
    } else if (note.kind === 'draw' && note.points && note.points.length > 1) {
      const thickness = Math.max(0.5, note.size * shownW);
      for (let i = 1; i < note.points.length; i++) {
        const [a, b] = [note.points[i - 1]!, note.points[i]!];
        const [x1, y1] = point(a[0], a[1]);
        const [x2, y2] = point(b[0], b[1]);
        page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: hexToRgb(note.color), lineCap: 1 });
      }
    } else if (note.kind === 'image' && note.src) {
      const decoded = dataUrlBytes(note.src);
      if (!decoded) continue;
      try {
        const image = decoded.png ? await out.embedPng(decoded.bytes) : await out.embedJpg(decoded.bytes);
        const [x, y] = point(note.x, note.y + note.h);
        page.drawImage(image, { x, y, width: note.w * shownW, height: note.h * shownH, rotate: degrees(rotation) });
      } catch {
        // a picture that cannot be read is left out; the rest of the PDF is still saved
      }
    }
  }
}

/** The finished PDF: the pages in their order, turned as asked, with the notes drawn on them. */
export async function buildPdf(sources: Uint8Array[], pages: PageState[]): Promise<Uint8Array> {
  const loaded = await Promise.all(sources.map((bytes) => PDFDocument.load(bytes, { ignoreEncryption: true })));
  const out = await PDFDocument.create();
  out.setCreator('Invoice Manager');
  const font = await out.embedFont(StandardFonts.Helvetica);
  for (const state of pages) {
    let page: PDFPage;
    if (state.source === BLANK_SOURCE) {
      page = out.addPage(A4);
    } else {
      const [copied] = await out.copyPages(loaded[state.source]!, [state.index]);
      page = out.addPage(copied!);
    }
    await drawNotes(out, page, font, state.notes);
    if (state.turn % 360 !== 0) page.setRotation(degrees((page.getRotation().angle + state.turn) % 360));
  }
  return out.save();
}
