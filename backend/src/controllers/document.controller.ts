import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { documentService } from '../services/document.service';
import type { CreateDocumentDto, UpdateDocumentDto, ListDocumentsQuery, ImportDocumentBody } from 'shared';

const uploaded = (req: Request) => {
  if (!req.file) throw new AppError('Choose a file to upload', 400, 'DOCUMENT_NO_FILE');
  return req.file;
};

export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListDocumentsQuery;
  const result = await documentService.list(query);
  res.json({ success: true, data: result.data, error: null, meta: result.meta });
});

export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const doc = await documentService.getById(id);
  logger.info('Document fetched', { documentId: doc.id });
  res.json({ success: true, data: doc, error: null, meta: null });
});

export const createDocument = asyncHandler(async (req: Request, res: Response) => {
  const dto = req.body as CreateDocumentDto;
  const doc = await documentService.create(dto);
  logger.info('Document created', { documentId: doc.id, type: doc.type });
  res.status(201).json({ success: true, data: doc, error: null, meta: null });
});

export const importDocument = asyncHandler(async (req: Request, res: Response) => {
  const file = uploaded(req);
  const { title } = req.body as ImportDocumentBody;
  // browsers send the name as latin1 bytes; read it back as UTF-8
  const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
  const doc = await documentService.importFile(name, file.buffer, title);
  logger.info('Document imported', { documentId: doc.id, type: doc.type, size: doc.size });
  res.status(201).json({ success: true, data: doc, error: null, meta: null });
});

export const updateDocument = asyncHandler(async (req: Request, res: Response) => {
  const dto = req.body as UpdateDocumentDto;
  const id = String(req.params['id']);
  const doc = await documentService.update(id, dto);
  logger.info('Document updated', { documentId: doc.id });
  res.json({ success: true, data: doc, error: null, meta: null });
});

export const uploadDocumentFile = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const doc = await documentService.saveFile(id, uploaded(req).buffer);
  logger.info('Document file saved', { documentId: doc.id, size: doc.size });
  res.json({ success: true, data: doc, error: null, meta: null });
});

export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  await documentService.softDelete(id);
  logger.info('Document deleted (soft)', { documentId: id });
  res.json({ success: true, data: null, error: null, meta: null });
});

/** The document as a file: a download by default, or `?disposition=inline` to show it in the page (the PDF viewer). */
export const downloadDocument = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const file = await documentService.getFile(id);
  const inline = req.query['disposition'] === 'inline';
  res.setHeader('Content-Type', file.mime);
  res.setHeader('Content-Length', String(file.bytes.length));
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${file.fileName}"`);
  res.setHeader('Cache-Control', 'no-store');
  logger.info('Document file sent', { documentId: id, type: file.type, size: file.bytes.length });
  res.send(file.bytes);
});
