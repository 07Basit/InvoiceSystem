import { describe, expect, it } from 'vitest';
import { PDFDocument, degrees } from 'pdf-lib';
import { BLANK_SOURCE, buildPdf, hexToRgb, toUserPoint, type Note, type PageState } from '../pdfModel';

// a 1x1 PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function source(pages: [number, number, number?][]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const [w, h, rotation] of pages) {
    const page = pdf.addPage([w, h]);
    if (rotation) page.setRotation(degrees(rotation));
  }
  return pdf.save();
}

const state = (over: Partial<PageState> & { index: number }): PageState => ({ id: `p${over.index}`, source: 0, turn: 0, notes: [], ...over });
const note = (over: Partial<Note>): Note => ({ id: 'n', kind: 'text', x: 0.1, y: 0.1, w: 0.2, h: 0.05, color: '#ff0000', size: 0.02, ...over });

describe('toUserPoint', () => {
  it('maps the page as shown onto the page as stored, for every built-in rotation', () => {
    // top-left of the shown page
    expect(toUserPoint(0, 0, 200, 100, 0)).toEqual([0, 100]);
    expect(toUserPoint(1, 1, 200, 100, 0)).toEqual([200, 0]);
    expect(toUserPoint(0, 0, 200, 100, 90)).toEqual([0, 0]);
    expect(toUserPoint(1, 0, 200, 100, 90)).toEqual([0, 100]);
    expect(toUserPoint(0, 0, 200, 100, 180)).toEqual([200, 0]);
    expect(toUserPoint(0, 0, 200, 100, 270)).toEqual([200, 100]);
  });
});

describe('hexToRgb', () => {
  it('reads colours and falls back to black', () => {
    expect(hexToRgb('#ff0000')).toMatchObject({ red: 1, green: 0, blue: 0 });
    expect(hexToRgb('nonsense')).toMatchObject({ red: 0, green: 0, blue: 0 });
  });
});

describe('buildPdf', () => {
  it('keeps the pages in the order they were put in, drops deleted ones and adds blank pages', async () => {
    const bytes = await source([[100, 100], [200, 200], [300, 300]]);
    const out = await PDFDocument.load(await buildPdf([bytes], [state({ index: 2 }), state({ index: 0 }), state({ source: BLANK_SOURCE, index: 0, id: 'blank' })]));
    expect(out.getPageCount()).toBe(3);
    expect(out.getPage(0).getSize().width).toBe(300);
    expect(out.getPage(1).getSize().width).toBe(100);
    expect(Math.round(out.getPage(2).getSize().width)).toBe(595);
  });

  it('turns pages on top of their own rotation', async () => {
    const bytes = await source([[100, 200, 90]]);
    const out = await PDFDocument.load(await buildPdf([bytes], [state({ index: 0, turn: 90 })]));
    expect(out.getPage(0).getRotation().angle).toBe(180);
    const plain = await PDFDocument.load(await buildPdf([await source([[100, 200]])], [state({ index: 0, turn: 270 })]));
    expect(plain.getPage(0).getRotation().angle).toBe(270);
  });

  it('joins pages of several PDFs', async () => {
    const a = await source([[100, 100]]);
    const b = await source([[200, 200], [250, 250]]);
    const out = await PDFDocument.load(await buildPdf([a, b], [state({ index: 0 }), state({ source: 1, index: 1 })]));
    expect(out.getPage(1).getSize().width).toBe(250);
  });

  it('draws every kind of note without changing the page count', async () => {
    const bytes = await source([[300, 400], [300, 400, 90]]);
    const notes: Note[] = [
      note({ id: '1', kind: 'text', text: 'Line one\nLine two ₹ 日本' }),
      note({ id: '2', kind: 'highlight' }),
      note({ id: '3', kind: 'whiteout' }),
      note({ id: '4', kind: 'draw', points: [[0.1, 0.1], [0.2, 0.3], [0.4, 0.2]] }),
      note({ id: '5', kind: 'image', src: PNG, w: 0.2, h: 0.1 }),
      note({ id: '6', kind: 'image', src: 'not-an-image' }),
    ];
    const pages = [state({ index: 0, notes }), state({ index: 1, notes })];
    const plain = await buildPdf([bytes], [state({ index: 0 }), state({ index: 1 })]);
    const withNotes = await buildPdf([bytes], pages);
    expect((await PDFDocument.load(withNotes)).getPageCount()).toBe(2);
    expect(withNotes.byteLength).toBeGreaterThan(plain.byteLength);
  });
});
