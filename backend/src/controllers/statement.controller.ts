import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { statementService } from '../services/statement.service';
import { renderStatementPdf } from '../services/statement-pdf';
import { renderStatementExcel } from '../services/statement-excel';
import type { StatementQuery } from 'shared';

const fileName = (name: string, extension: string) => `statement-${name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'importer'}.${extension}`;

export const getStatement = asyncHandler(async (req: Request, res: Response) => {
  const statement = await statementService.build(String(req.params['id']), req.query as unknown as StatementQuery);
  res.json({ success: true, data: statement, error: null, meta: null });
});

export const downloadStatementPdf = asyncHandler(async (req: Request, res: Response) => {
  const statement = await statementService.build(String(req.params['id']), req.query as unknown as StatementQuery);
  const bytes = await renderStatementPdf(statement);
  logger.info('Statement PDF generated', { importerId: statement.importer.id, action: 'download_statement_pdf' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName(statement.importer.name, 'pdf')}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(Buffer.from(bytes));
});

export const downloadStatementExcel = asyncHandler(async (req: Request, res: Response) => {
  const statement = await statementService.build(String(req.params['id']), req.query as unknown as StatementQuery);
  const buffer = await renderStatementExcel(statement);
  logger.info('Statement Excel generated', { importerId: statement.importer.id, action: 'download_statement_excel' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName(statement.importer.name, 'xlsx')}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
});
