import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { documentService } from '../services/document.service';
import type { CreateDocumentDto, UpdateDocumentDto, ListDocumentsQuery } from 'shared';

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
  logger.info('Document created', { documentId: doc.id, title: doc.title });
  res.status(201).json({ success: true, data: doc, error: null, meta: null });
});

export const updateDocument = asyncHandler(async (req: Request, res: Response) => {
  const dto = req.body as UpdateDocumentDto;
  const id = String(req.params['id']);
  const doc = await documentService.update(id, dto);
  logger.info('Document updated', { documentId: doc.id });
  res.json({ success: true, data: doc, error: null, meta: null });
});

export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  await documentService.softDelete(id);
  logger.info('Document deleted (soft)', { documentId: id });
  res.json({ success: true, data: null, error: null, meta: null });
});

export const exportDocument = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const doc = await documentService.getById(id);
  // Placeholder — full .docx generation with the docx package will go here
  logger.info('Document export requested', { documentId: doc.id });
  res.status(501).json({
    success: false,
    data: null,
    error: { code: 'NOT_IMPLEMENTED', message: 'Word export feature coming soon' },
    meta: null,
  });
});
