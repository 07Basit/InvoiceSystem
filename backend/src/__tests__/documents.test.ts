import ExcelJS from 'exceljs';
import mammoth from 'mammoth';
import { PDFDocument } from 'pdf-lib';
import { prismaMock } from './setup';
import { documentService, downloadName } from '../services/document.service';
import { textToPdf } from '../services/document-pdf';
import { hexColor, htmlToDocx, imageSize } from '../services/document-docx';
import { createDocumentSchema, importDocumentBodySchema, DOCUMENT_FILE } from 'shared';

// a 1x1 PNG
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'd1', title: 'Report', type: 'WORD', content: '<p>Hello</p>', fileUrl: null, size: 12,
  createdAt: new Date('2026-10-22T00:00:00Z'), updatedAt: new Date('2026-10-22T00:00:00Z'), deletedAt: null, ...over,
});

describe('document schemas', () => {
  it('knows the three kinds of document', () => {
    for (const type of ['WORD', 'PDF', 'EXCEL']) expect(createDocumentSchema.safeParse({ title: 'x', type }).success).toBe(true);
    expect(createDocumentSchema.safeParse({ title: 'x', type: 'PPT' }).success).toBe(false);
    expect(createDocumentSchema.safeParse({ title: '  ' }).success).toBe(false);
    expect(createDocumentSchema.parse({ title: 'x' }).type).toBe('WORD');
    expect(importDocumentBodySchema.safeParse({}).success).toBe(true);
    expect(DOCUMENT_FILE.EXCEL.extension).toBe('xlsx');
  });
});

describe('textToPdf', () => {
  it('makes a valid A4 PDF, and a blank page when there is no text', async () => {
    const blank = await PDFDocument.load(await textToPdf('Empty', ''));
    expect(blank.getPageCount()).toBe(1);
    const text = await PDFDocument.load(await textToPdf('Notes', 'Line one\nLine two ₹ “quoted” 日本'));
    expect(text.getPageCount()).toBe(1);
    expect(Math.round(text.getPage(0).getSize().width)).toBe(595);
  });

  it('starts new pages for long text and breaks very long words', async () => {
    const long = Array.from({ length: 200 }, (_, i) => `Paragraph ${i} ${'word '.repeat(30)}`).join('\n');
    expect((await PDFDocument.load(await textToPdf('Long', long))).getPageCount()).toBeGreaterThan(2);
    await expect(textToPdf('Wide', 'x'.repeat(400))).resolves.toBeInstanceOf(Uint8Array);
  });
});

describe('htmlToDocx', () => {
  const html = `
    <h1>Title</h1>
    <p style="text-align: center">Centered <strong>bold</strong> <em>italic</em> <u>under</u> <s>gone</s> <span style="color: #ff0000">red</span> <mark style="background-color: #ffff00">marked</mark></p>
    <ul><li><p>First</p></li><li><p>Second</p><ul><li><p>Nested</p></li></ul></li></ul>
    <ol><li><p>One</p></li><li><p>Two</p></li></ol>
    <table><tbody><tr><th>Head</th><th>Other</th></tr><tr><td>Cell A</td><td colspan="1">Cell B</td></tr></tbody></table>
    <blockquote><p>Quoted</p></blockquote>
    <p>Link: <a href="https://example.com">site</a><br>after break</p>
    <p><img src="data:image/png;base64,${PNG_B64}" alt="dot"></p>
    <hr><pre>code line</pre>`;

  it('keeps every piece of text, in order', async () => {
    const docx = await htmlToDocx('Sample', html);
    expect(docx.subarray(0, 2).toString()).toBe('PK');
    const text = (await mammoth.extractRawText({ buffer: docx })).value;
    for (const part of ['Title', 'Centered', 'bold', 'italic', 'under', 'gone', 'red', 'marked', 'First', 'Second', 'Nested', 'One', 'Two', 'Head', 'Other', 'Cell A', 'Cell B', 'Quoted', 'site', 'after break', 'code line']) {
      expect(text).toContain(part);
    }
    expect(text.indexOf('Title')).toBeLessThan(text.indexOf('First'));
  });

  it('keeps headings, bold and italic, lists and tables as real Word structures', async () => {
    const back = (await mammoth.convertToHtml({ buffer: await htmlToDocx('Sample', html) })).value;
    expect(back).toMatch(/<h1>Title<\/h1>/);
    expect(back).toMatch(/<strong>bold<\/strong>/);
    expect(back).toMatch(/<em>italic<\/em>/);
    expect(back).toMatch(/<ul>/);
    expect(back).toMatch(/<ol>/);
    expect(back).toMatch(/<table>/);
    expect(back).toMatch(/<img /);
  });

  it('writes an empty document for empty text and ignores pictures it cannot read', async () => {
    await expect(htmlToDocx('Empty', '')).resolves.toBeInstanceOf(Buffer);
    await expect(htmlToDocx('x', '<p><img src="https://example.com/a.png"></p><p>ok</p>')).resolves.toBeInstanceOf(Buffer);
  });

  it('reads colours and picture sizes', () => {
    expect(hexColor('#f00')).toBe('FF0000');
    expect(hexColor('rgb(0, 128, 255)')).toBe('0080FF');
    expect(hexColor('red')).toBeUndefined();
    expect(imageSize(Buffer.from(PNG_B64, 'base64'))).toEqual({ type: 'png', width: 1, height: 1 });
    expect(imageSize(Buffer.from('nope'))).toBeUndefined();
  });
});

describe('documentService', () => {
  it('makes a real PDF when a PDF is created, and a blank workbook for Excel', async () => {
    prismaMock.document.create.mockImplementation((async (args: { data: Record<string, unknown> }) => ({ ...row(), ...args.data })) as never);
    const pdf = (await documentService.create({ title: 'Notes', type: 'PDF', content: 'Hello' })) as unknown as { size: number };
    const pdfCall = prismaMock.document.create.mock.calls[0]![0] as { data: { data: Uint8Array } };
    expect(Buffer.from(pdfCall.data.data).subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.size).toBe(pdfCall.data.data.length);

    await documentService.create({ title: 'Sheet', type: 'EXCEL', content: '' });
    const xlsx = (prismaMock.document.create.mock.calls[1]![0] as { data: { data: Uint8Array } }).data.data;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(xlsx) as unknown as ExcelJS.Buffer);
    expect(wb.worksheets).toHaveLength(1);

    await documentService.create({ title: 'Letter', type: 'WORD', content: '<p>Hi</p>' });
    expect(prismaMock.document.create.mock.calls[2]![0]).toEqual({ data: { title: 'Letter', type: 'WORD', content: '<p>Hi</p>', size: 9 }, omit: { data: true } });
  });

  it('never lists or reads the file bytes with the document', async () => {
    prismaMock.$transaction.mockResolvedValue([[row()], 1] as never);
    await documentService.list({ page: 1, limit: 20, sort: 'updatedAt', order: 'desc' } as never);
    prismaMock.document.findFirst.mockResolvedValue(row() as never);
    await documentService.getById('d1');
    expect(prismaMock.document.findFirst).toHaveBeenCalledWith({ where: { id: 'd1', deletedAt: null }, omit: { data: true } });
  });

  it('lists only the starred documents when asked, and can star and unstar one', async () => {
    prismaMock.$transaction.mockResolvedValue([[row({ starred: true })], 1] as never);
    await documentService.list({ page: 1, limit: 20, sort: 'updatedAt', order: 'desc', starred: 'true' } as never);
    expect(prismaMock.document.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null, starred: true }, select: expect.objectContaining({ starred: true }) }));
    prismaMock.document.findFirst.mockResolvedValue(row() as never);
    prismaMock.document.update.mockResolvedValue(row({ starred: true }) as never);
    await documentService.update('d1', { starred: true });
    expect(prismaMock.document.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { starred: true }, omit: { data: true } });
    expect(createDocumentSchema.parse({ title: 'x', starred: false }).starred).toBe(false);
  });

  it('does not let a document change its type', async () => {
    prismaMock.document.findFirst.mockResolvedValue(row() as never);
    await expect(documentService.update('d1', { type: 'PDF' })).rejects.toMatchObject({ statusCode: 400, code: 'DOCUMENT_TYPE_LOCKED' });
    prismaMock.document.update.mockResolvedValue(row({ title: 'New' }) as never);
    await documentService.update('d1', { title: 'New', content: '<p>Longer text</p>' });
    expect(prismaMock.document.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { title: 'New', content: '<p>Longer text</p>', size: 18 }, omit: { data: true } });
  });

  it('saves a replaced file only if it is the right kind of file', async () => {
    prismaMock.document.findFirst.mockResolvedValue(row({ type: 'PDF' }) as never);
    await expect(documentService.saveFile('d1', Buffer.from('not a pdf'))).rejects.toMatchObject({ code: 'DOCUMENT_BAD_FILE' });
    prismaMock.document.update.mockResolvedValue(row({ type: 'PDF' }) as never);
    await expect(documentService.saveFile('d1', Buffer.from('%PDF-1.7 ...'))).resolves.toBeDefined();
    prismaMock.document.findFirst.mockResolvedValue(row({ type: 'EXCEL' }) as never);
    await expect(documentService.saveFile('d1', Buffer.from('plain'))).rejects.toMatchObject({ code: 'DOCUMENT_BAD_FILE' });
    prismaMock.document.findFirst.mockResolvedValue(row() as never);
    await expect(documentService.saveFile('d1', Buffer.from('PK..'))).rejects.toMatchObject({ code: 'DOCUMENT_NOT_A_FILE' });
  });

  it('builds the .docx of a Word document when it is downloaded', async () => {
    prismaMock.document.findFirst.mockResolvedValue(row({ title: 'My: Report/1', content: '<p>Body text</p>' }) as never);
    const file = await documentService.getFile('d1');
    expect(file.fileName).toBe('My_ Report_1.docx');
    expect(file.mime).toBe(DOCUMENT_FILE.WORD.mime);
    expect((await mammoth.extractRawText({ buffer: file.bytes })).value).toContain('Body text');
  });

  it('sends the stored PDF or workbook as it is, and says when there is none', async () => {
    const bytes = new Uint8Array(Buffer.from('%PDF-1.7 test'));
    prismaMock.document.findFirst.mockResolvedValue(row({ type: 'PDF', title: 'Scan', data: bytes }) as never);
    expect((await documentService.getFile('d1')).bytes.toString()).toBe('%PDF-1.7 test');
    prismaMock.document.findFirst.mockResolvedValue(row({ type: 'PDF', data: null }) as never);
    await expect(documentService.getFile('d1')).rejects.toMatchObject({ code: 'DOCUMENT_FILE_MISSING' });
    prismaMock.document.findFirst.mockResolvedValue(null);
    await expect(documentService.getFile('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  describe('importFile', () => {
    beforeEach(() => {
      prismaMock.document.create.mockImplementation((async (args: { data: Record<string, unknown> }) => ({ ...row(), ...args.data })) as never);
    });

    it('reads a Word file into editable text', async () => {
      const docx = await htmlToDocx('x', '<h1>Imported</h1><p>Some <strong>text</strong></p>');
      await documentService.importFile('Quarterly report.docx', docx);
      const data = (prismaMock.document.create.mock.calls[0]![0] as { data: { title: string; type: string; content: string } }).data;
      expect(data.title).toBe('Quarterly report');
      expect(data.type).toBe('WORD');
      expect(data.content).toContain('<h1>Imported</h1>');
      expect(data.content).toContain('<strong>text</strong>');
    });

    it('keeps a PDF and a workbook as files', async () => {
      await documentService.importFile('scan.PDF', Buffer.from('%PDF-1.4 x'), 'My scan');
      expect((prismaMock.document.create.mock.calls[0]![0] as { data: { title: string; type: string } }).data).toMatchObject({ title: 'My scan', type: 'PDF' });
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('A').getCell('A1').value = 5;
      await documentService.importFile('numbers.xlsx', Buffer.from(await wb.xlsx.writeBuffer()));
      expect((prismaMock.document.create.mock.calls[1]![0] as { data: { type: string } }).data.type).toBe('EXCEL');
    });

    it('refuses other kinds of file and files that are not what their name says', async () => {
      await expect(documentService.importFile('photo.png', Buffer.from('x'))).rejects.toMatchObject({ code: 'DOCUMENT_UNSUPPORTED' });
      await expect(documentService.importFile('fake.pdf', Buffer.from('hello'))).rejects.toMatchObject({ code: 'DOCUMENT_BAD_FILE' });
      await expect(documentService.importFile('fake.docx', Buffer.from('hello'))).rejects.toMatchObject({ code: 'DOCUMENT_BAD_FILE' });
      await expect(documentService.importFile('broken.xlsx', Buffer.from('PK\u0003\u0004 not really'))).rejects.toMatchObject({ code: 'DOCUMENT_BAD_FILE' });
      expect(prismaMock.document.create).not.toHaveBeenCalled();
    });
  });

  it('makes safe download names', () => {
    expect(downloadName('  ../Q1 / plan ', 'EXCEL')).toBe('Q1 _ plan.xlsx');
    expect(downloadName('///', 'PDF')).toBe('document.pdf');
  });
});
