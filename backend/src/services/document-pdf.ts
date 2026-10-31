import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const BODY = 11;
const LEADING = 16;

/** Replacements for characters the built-in PDF fonts cannot draw. */
const FALLBACKS: Record<string, string> = { '₹': 'Rs', '€': 'EUR', '£': 'GBP', '“': '"', '”': '"', '‘': "'", '’': "'", '–': '-', '—': '-', '•': '*', '…': '...', '\t': '    ' };

function clean(value: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  return [...value]
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      if (code === 10) return ch;
      if (code === 13) return '';
      if (supported.has(code)) return ch;
      return FALLBACKS[ch] ?? '?';
    })
    .join('');
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') { out.push(''); continue; }
    let line = '';
    for (const word of paragraph.split(' ')) {
      let piece = word;
      // a single word wider than the line is cut into pieces
      while (font.widthOfTextAtSize(piece, size) > maxWidth && piece.length > 1) {
        let cut = piece.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(piece.slice(0, cut), size) > maxWidth) cut--;
        if (line) { out.push(line); line = ''; }
        out.push(piece.slice(0, cut));
        piece = piece.slice(cut);
      }
      const next = line ? `${line} ${piece}` : piece;
      if (line && font.widthOfTextAtSize(next, size) > maxWidth) { out.push(line); line = piece; } else line = next;
    }
    out.push(line);
  }
  return out;
}

/** A new A4 PDF made from plain text: the title as a heading, then the text, on as many pages as it needs. Empty text gives one blank page. */
export async function textToPdf(title: string, text: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator('Invoice Manager');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  const body = clean(text, regular).trim();
  if (!body) return pdf.save();

  let y = PAGE_H - MARGIN;
  const heading = wrap(clean(title, bold), bold, 18, PAGE_W - MARGIN * 2);
  heading.forEach((line) => { page.drawText(line, { x: MARGIN, y: y - 18, size: 18, font: bold, color: rgb(0.1, 0.12, 0.14) }); y -= 24; });
  y -= 10;

  for (const line of wrap(body, regular, BODY, PAGE_W - MARGIN * 2)) {
    if (y - LEADING < MARGIN) { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; }
    if (line) page.drawText(line, { x: MARGIN, y: y - BODY, size: BODY, font: regular, color: rgb(0.1, 0.12, 0.14) });
    y -= LEADING;
  }
  return pdf.save();
}
