import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import mammoth from 'mammoth';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { DOCUMENT_FILE, PaginationMeta } from 'shared';
import type { CreateDocumentDto, UpdateDocumentDto, ListDocumentsQuery, DocumentType } from 'shared';
import { containsCi } from '../utils/caseInsensitive';
import { textToPdf } from './document-pdf';
import { htmlToDocx } from './document-docx';

/** A file name safe to send in a download header: letters, digits, spaces, dot, dash and underscore. */
export function downloadName(title: string, type: DocumentType): string {
  const base = title.replace(/[^A-Za-z0-9._ -]+/g, '_').replace(/^[._\s-]+|[._\s-]+$/g, '') || 'document';
  return `${base}.${DOCUMENT_FILE[type].extension}`;
}

/** An empty workbook (one blank sheet), so a new Excel document always has a file to download. */
async function blankWorkbook(title: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Invoice Manager';
  wb.title = title;
  wb.addWorksheet('Sheet1');
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Prisma stores bytes as a plain Uint8Array. */
const toBytes = (bytes: Buffer) => new Uint8Array(bytes);

const isPdf = (bytes: Buffer) => bytes.subarray(0, 5).toString('latin1') === '%PDF-';
/** .docx and .xlsx files are zip archives. */
const isZip = (bytes: Buffer) => bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;

const TYPE_BY_EXTENSION: Record<string, DocumentType> = { docx: 'WORD', xlsx: 'EXCEL', pdf: 'PDF' };

export const documentService = {
  async list(query: ListDocumentsQuery): Promise<{ data: unknown[]; meta: PaginationMeta }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search;
    const sort = query.sort ?? 'updatedAt';
    const order = query.order ?? 'desc';
    const type = query.type;

    const where: Prisma.DocumentWhereInput = {
      deletedAt: null,
      ...(type && { type }),
      ...(query.starred === 'true' && { starred: true }),
      ...(search && {
        OR: [{ title: containsCi(search) }],
      }),
    };

    const [documents, total] = await prisma.$transaction([
      prisma.document.findMany({
        where,
        select: { id: true, title: true, type: true, size: true, starred: true, createdAt: true, updatedAt: true },
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.document.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: documents,
      meta: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  },

  /** One document with its content, but without the file bytes (those come from `getFile`). */
  async getById(id: string) {
    const doc = await prisma.document.findFirst({ where: { id, deletedAt: null }, omit: { data: true } });
    if (!doc) throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    return doc;
  },

  async create(dto: CreateDocumentDto) {
    const type = dto.type ?? 'WORD';
    if (type === 'PDF') {
      // a new PDF is made from the text (blank when there is none)
      const bytes = Buffer.from(await textToPdf(dto.title, dto.content ?? ''));
      return prisma.document.create({ data: { title: dto.title, type, content: '', data: toBytes(bytes), size: bytes.length }, omit: { data: true } });
    }
    if (type === 'EXCEL') {
      const bytes = await blankWorkbook(dto.title);
      return prisma.document.create({ data: { title: dto.title, type, content: dto.content ?? '', data: toBytes(bytes), size: bytes.length }, omit: { data: true } });
    }
    return prisma.document.create({ data: { title: dto.title, type, content: dto.content ?? '', size: Buffer.byteLength(dto.content ?? '') }, omit: { data: true } });
  },

  async update(id: string, dto: UpdateDocumentDto) {
    const current = await this.getById(id);
    if (dto.type !== undefined && dto.type !== current.type) throw new AppError('A document cannot change its type', 400, 'DOCUMENT_TYPE_LOCKED');
    return prisma.document.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.starred !== undefined ? { starred: dto.starred } : {}),
        ...(dto.content !== undefined ? { content: dto.content, ...(current.type === 'WORD' ? { size: Buffer.byteLength(dto.content) } : {}) } : {}),
      },
      omit: { data: true },
    });
  },

  /** Replaces the saved file: a PDF after its pages or notes were edited, or the .xlsx the spreadsheet editor produced. */
  async saveFile(id: string, bytes: Buffer) {
    const doc = await this.getById(id);
    if (doc.type === 'WORD') throw new AppError('A Word document is saved as text, not as a file', 400, 'DOCUMENT_NOT_A_FILE');
    if (doc.type === 'PDF' && !isPdf(bytes)) throw new AppError('That is not a PDF file', 400, 'DOCUMENT_BAD_FILE');
    if (doc.type === 'EXCEL' && !isZip(bytes)) throw new AppError('That is not an Excel (.xlsx) file', 400, 'DOCUMENT_BAD_FILE');
    return prisma.document.update({ where: { id }, data: { data: toBytes(bytes), size: bytes.length }, omit: { data: true } });
  },

  /** The file to download or open: the stored PDF or workbook, or a .docx built from the Word text. */
  async getFile(id: string): Promise<{ title: string; type: DocumentType; bytes: Buffer; fileName: string; mime: string }> {
    const doc = await prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    const type = doc.type as DocumentType;
    let bytes: Buffer;
    if (type === 'WORD') bytes = await htmlToDocx(doc.title, doc.content ?? '');
    else if (doc.data) bytes = Buffer.from(doc.data);
    else if (type === 'EXCEL') bytes = await blankWorkbook(doc.title);
    else throw new AppError('This document has no file yet', 404, 'DOCUMENT_FILE_MISSING');
    return { title: doc.title, type, bytes, fileName: downloadName(doc.title, type), mime: DOCUMENT_FILE[type].mime };
  },

  /** Adds an uploaded .docx, .xlsx or .pdf. A Word file is read into editable text; the other two are stored as they are. */
  async importFile(filename: string, bytes: Buffer, title?: string) {
    const extension = filename.split('.').pop()?.toLowerCase() ?? '';
    const type = TYPE_BY_EXTENSION[extension];
    if (!type) throw new AppError('Only .docx, .xlsx and .pdf files can be added', 400, 'DOCUMENT_UNSUPPORTED');
    const name = (title ?? filename.replace(/\.[^.]+$/, '')).trim().slice(0, 200) || 'Untitled';
    if (type === 'PDF') {
      if (!isPdf(bytes)) throw new AppError('That is not a valid PDF file', 400, 'DOCUMENT_BAD_FILE');
      return prisma.document.create({ data: { title: name, type, content: '', data: toBytes(bytes), size: bytes.length }, omit: { data: true } });
    }
    if (!isZip(bytes)) throw new AppError(`That is not a valid .${extension} file`, 400, 'DOCUMENT_BAD_FILE');
    if (type === 'EXCEL') {
      // check it opens before it is kept
      try {
        await new ExcelJS.Workbook().xlsx.load(bytes as unknown as ExcelJS.Buffer);
      } catch {
        throw new AppError('That Excel file could not be read', 400, 'DOCUMENT_BAD_FILE');
      }
      return prisma.document.create({ data: { title: name, type, content: '', data: toBytes(bytes), size: bytes.length }, omit: { data: true } });
    }
    let html: string;
    try {
      html = (await mammoth.convertToHtml({ buffer: bytes })).value;
    } catch {
      throw new AppError('That Word file could not be read', 400, 'DOCUMENT_BAD_FILE');
    }
    return prisma.document.create({ data: { title: name, type, content: html, size: bytes.length }, omit: { data: true } });
  },

  async softDelete(id: string) {
    await this.getById(id);
    return prisma.document.update({ where: { id }, data: { deletedAt: new Date() }, omit: { data: true } });
  },
};
