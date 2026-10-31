import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, HeadingLevel, ImageRun, LevelFormat, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
  type IParagraphOptions, type IRunOptions, type ITableCellOptions, type ParagraphChild,
} from 'docx';
import { parse, HTMLElement, TextNode, type Node } from 'node-html-parser';

/**
 * Turns the HTML the Word editor saves (headings, paragraphs, bold/italic/underline, colours, highlights, lists, tables,
 * images, links, alignment) into a real .docx file. Anything it does not know is read as plain text, so nothing is lost.
 */

interface Style {
  bold?: boolean | undefined;
  italics?: boolean | undefined;
  underline?: boolean | undefined;
  strike?: boolean | undefined;
  color?: string | undefined;
  highlight?: string | undefined;
  superScript?: boolean | undefined;
  subScript?: boolean | undefined;
  code?: boolean | undefined;
  link?: string | undefined;
}

type Block = Paragraph | Table;
type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
const MAX_IMAGE_WIDTH = 600;

/** The options that are set (the library does not accept explicit undefined values). */
const strip = <T>(options: object): T => Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)) as T;

/** "#ff0000", "rgb(255, 0, 0)" or a short "#f00" -> "FF0000" (undefined when it is not a colour). */
export function hexColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('').toUpperCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (!hex) return undefined;
  const h = hex[1]!;
  return (h.length === 3 ? [...h].map((c) => c + c).join('') : h).toUpperCase();
}

function styleOf(el: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (el.getAttribute('style') ?? '').split(';')) {
    const i = part.indexOf(':');
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
}

function alignOf(el: HTMLElement): Align | undefined {
  switch (styleOf(el)['text-align']) {
    case 'center': return AlignmentType.CENTER;
    case 'right': return AlignmentType.RIGHT;
    case 'justify': return AlignmentType.JUSTIFIED;
    case 'left': return AlignmentType.LEFT;
    default: return undefined;
  }
}

/** The width and height of a PNG or JPEG, read from its header (undefined for anything else). */
export function imageSize(bytes: Buffer): { type: 'png' | 'jpg' | 'gif'; width: number; height: number } | undefined {
  if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47) return { type: 'png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes.length > 10 && bytes.subarray(0, 3).toString('latin1') === 'GIF') return { type: 'gif', width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { type: 'jpg', height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
      i += 2 + bytes.readUInt16BE(i + 2);
    }
  }
  return undefined;
}

function imageRun(el: HTMLElement): ImageRun | undefined {
  const match = /^data:image\/[a-z+.-]+;base64,(.+)$/i.exec(el.getAttribute('src') ?? '');
  if (!match) return undefined;
  const bytes = Buffer.from(match[1]!, 'base64');
  const size = imageSize(bytes);
  if (!size || !size.width || !size.height) return undefined;
  const asked = Number(el.getAttribute('width')) || size.width;
  const width = Math.min(asked, MAX_IMAGE_WIDTH);
  const height = Math.round((width / size.width) * size.height);
  return new ImageRun({ type: size.type, data: bytes, transformation: { width, height }, altText: { name: 'image', description: el.getAttribute('alt') ?? '', title: el.getAttribute('title') ?? '' } });
}

function runOptions(style: Style, text: string): IRunOptions {
  const options = {
    text,
    bold: style.bold,
    italics: style.italics,
    strike: style.strike,
    superScript: style.superScript,
    subScript: style.subScript,
    underline: style.underline || style.link ? {} : undefined,
    color: style.link ? '0563C1' : style.color,
    shading: style.highlight ? { type: ShadingType.CLEAR, fill: style.highlight, color: 'auto' } : undefined,
    font: style.code ? 'Courier New' : undefined,
  };
  // only the options that are set (the library does not accept explicit undefined values)
  return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)) as IRunOptions;
}

/** The runs (text, line breaks, images, links) of an element's inline content. */
function inline(nodes: Node[], style: Style): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const node of nodes) {
    if (node instanceof TextNode) {
      const text = node.text.replace(/\s+/g, ' ');
      if (!text.trim() && text !== ' ') continue;
      if (text) out.push(new TextRun(runOptions(style, text)));
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') { out.push(new TextRun({ break: 1 })); continue; }
    if (tag === 'img') { const image = imageRun(node); if (image) out.push(image); continue; }
    const css = styleOf(node);
    const next: Style = { ...style };
    if (tag === 'strong' || tag === 'b') next.bold = true;
    if (tag === 'em' || tag === 'i') next.italics = true;
    if (tag === 'u') next.underline = true;
    if (tag === 's' || tag === 'strike' || tag === 'del') next.strike = true;
    if (tag === 'sup') next.superScript = true;
    if (tag === 'sub') next.subScript = true;
    if (tag === 'code') next.code = true;
    if (tag === 'mark') next.highlight = hexColor(css['background-color']) ?? hexColor(node.getAttribute('data-color') ?? undefined) ?? 'FFFF00';
    if (css['color']) next.color = hexColor(css['color']) ?? next.color;
    if (css['background-color'] && tag !== 'mark') next.highlight = hexColor(css['background-color']) ?? next.highlight;
    if (css['font-weight'] === 'bold' || Number(css['font-weight']) >= 600) next.bold = true;
    if (css['font-style'] === 'italic') next.italics = true;
    if ((css['text-decoration'] ?? '').includes('underline')) next.underline = true;
    if ((css['text-decoration'] ?? '').includes('line-through')) next.strike = true;
    if (tag === 'a' && node.getAttribute('href')) {
      next.link = node.getAttribute('href')!;
      const children = inline(node.childNodes, next);
      out.push(new ExternalHyperlink({ link: next.link, children: children.filter((c): c is TextRun => c instanceof TextRun) }));
      continue;
    }
    out.push(...inline(node.childNodes, next));
  }
  return out;
}

const isBlock = (node: Node) => node instanceof HTMLElement && /^(p|h[1-6]|ul|ol|li|table|blockquote|pre|hr|div)$/i.test(node.tagName);

function paragraphs(el: HTMLElement, extra: { heading?: (typeof HEADINGS)[number]; indent?: number; list?: { ordered: boolean; level: number; instance: number }; quote?: boolean; mono?: boolean } = {}): Paragraph {
  const style: Style = extra.mono ? { code: true } : {};
  return new Paragraph(strip<IParagraphOptions>({
    children: inline(el.childNodes, style),
    heading: extra.heading,
    alignment: alignOf(el),
    spacing: { after: extra.list ? 60 : 120 },
    ...(extra.list ? { numbering: { reference: extra.list.ordered ? 'numbers' : 'bullets', level: Math.min(extra.list.level, 5), instance: extra.list.instance } } : {}),
    ...(extra.quote ? { indent: { left: 540 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'BBBBBB', space: 8 } } } : {}),
    ...(extra.indent ? { indent: { left: extra.indent } } : {}),
  }));
}

let listInstance = 0;

function list(el: HTMLElement, level: number, instance: number): Block[] {
  const ordered = el.tagName.toLowerCase() === 'ol';
  const out: Block[] = [];
  for (const li of el.childNodes) {
    if (!(li instanceof HTMLElement) || li.tagName.toLowerCase() !== 'li') continue;
    // an item holds a paragraph (as the editor saves it) or plain inline content, and may hold a nested list
    const nested = li.childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement && /^(ul|ol)$/i.test(n.tagName));
    const content = li.childNodes.filter((n) => !nested.includes(n as HTMLElement));
    const first = content.find((n): n is HTMLElement => n instanceof HTMLElement && n.tagName.toLowerCase() === 'p');
    const holder = first ?? li;
    const para = new Paragraph(strip<IParagraphOptions>({
      children: inline(first ? first.childNodes : content, {}),
      alignment: alignOf(holder),
      spacing: { after: 60 },
      numbering: { reference: ordered ? 'numbers' : 'bullets', level: Math.min(level, 5), instance },
    }));
    out.push(para);
    for (const n of nested) out.push(...list(n, level + 1, instance));
  }
  return out;
}

function table(el: HTMLElement): Table {
  const rows: TableRow[] = [];
  for (const tr of el.querySelectorAll('tr')) {
    const cells = tr.childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement && /^(td|th)$/i.test(n.tagName));
    rows.push(new TableRow({
      children: cells.map((cell) => {
        const header = cell.tagName.toLowerCase() === 'th';
        const children = blocks(cell.childNodes);
        const bg = hexColor(styleOf(cell)['background-color']) ?? (header ? 'F2F2F2' : undefined);
        return new TableCell(strip<ITableCellOptions>({
          children: children.length ? (children as Paragraph[]) : [new Paragraph('')],
          columnSpan: Number(cell.getAttribute('colspan')) || undefined,
          rowSpan: Number(cell.getAttribute('rowspan')) || undefined,
          shading: bg ? { type: ShadingType.CLEAR, fill: bg, color: 'auto' } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }));
      }),
    }));
  }
  return new Table({ rows: rows.length ? rows : [new TableRow({ children: [new TableCell({ children: [new Paragraph('')] })] })], width: { size: 100, type: WidthType.PERCENTAGE } });
}

function blocks(nodes: Node[]): Block[] {
  const out: Block[] = [];
  let loose: Node[] = [];
  const flush = () => {
    const children = inline(loose, {});
    if (children.length) out.push(new Paragraph({ children, spacing: { after: 120 } }));
    loose = [];
  };
  for (const node of nodes) {
    if (!(node instanceof HTMLElement) || !isBlock(node)) { loose.push(node); continue; }
    flush();
    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) out.push(paragraphs(node, { heading: HEADINGS[Number(tag[1]) - 1]! }));
    else if (tag === 'ul' || tag === 'ol') out.push(...list(node, 0, ++listInstance));
    else if (tag === 'table') out.push(table(node));
    else if (tag === 'blockquote') node.childNodes.forEach((child) => { if (child instanceof HTMLElement) out.push(paragraphs(child, { quote: true })); });
    else if (tag === 'pre') out.push(paragraphs(node, { mono: true }));
    else if (tag === 'hr') out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BBBBBB', space: 1 } }, spacing: { after: 120 } }));
    else if (tag === 'div') out.push(...blocks(node.childNodes));
    else if (tag === 'li') out.push(paragraphs(node));
    else out.push(paragraphs(node));
  }
  flush();
  return out;
}

const levels = (format: (typeof LevelFormat)[keyof typeof LevelFormat], text: (level: number) => string) =>
  Array.from({ length: 6 }, (_, level) => ({ level, format, text: text(level), alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } } }));

/** The finished .docx file for a Word document saved as HTML. */
export async function htmlToDocx(title: string, html: string): Promise<Buffer> {
  const root = parse(html || '');
  listInstance = 0;
  const children = blocks(root.childNodes);
  const doc = new Document({
    creator: 'Invoice Manager',
    title,
    numbering: {
      config: [
        { reference: 'bullets', levels: levels(LevelFormat.BULLET, () => '•') },
        { reference: 'numbers', levels: levels(LevelFormat.DECIMAL, (level) => `%${level + 1}.`) },
      ],
    },
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: children.length ? children : [new Paragraph('')] }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
