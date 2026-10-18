import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { invoiceService } from '../services/invoice.service';
import { actorOf, events } from '../services/notification.events';
import { type CreateInvoiceDto, type ListInvoicesQuery, type ManualRateDto, type ShareNativeDto, type UpdateInvoiceDto } from 'shared';
import * as XLSX from 'xlsx';
import { buildInvoiceDocument } from '../services/invoice-document';
import { renderInvoicePdf } from '../services/invoice-pdf';
import { renderInvoiceExcel } from '../services/invoice-excel';
import { nativeShare } from '../services/native-share.service';
import { AppError } from '../utils/AppError';

export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListInvoicesQuery;
  const result = await invoiceService.list(query);
  res.json({ success: true, data: result.data, error: null, meta: result.meta });
});

export const getInvoiceSummary = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await invoiceService.summary();
  res.json({ success: true, data: summary, error: null, meta: null });
});

export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const invoice = await invoiceService.getByIdWithConversion(id);
  logger.info('Invoice fetched', { invoiceId: invoice.id, action: 'get_invoice' });
  res.json({ success: true, data: invoice, error: null, meta: null });
});

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const dto = req.body as CreateInvoiceDto;
  const invoice = await invoiceService.create(dto);
  await events.invoiceCreated(actorOf(req), invoice.id);
  logger.info('Invoice created', { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, action: 'create_invoice' });
  res.status(201).json({ success: true, data: invoice, error: null, meta: null });
});

export const createActualInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoiceService.createActual(String(req.params['id']));
  await events.invoiceCreated(actorOf(req), invoice.id);
  logger.info('Actual invoice created', { invoiceId: invoice.id, originalId: String(req.params['id']), action: 'create_actual_invoice' });
  res.status(201).json({ success: true, data: invoice, error: null, meta: null });
});

export const updateInvoice = asyncHandler(async (req: Request, res: Response) => {
  const dto = req.body as UpdateInvoiceDto;
  const id = String(req.params['id']);
  const invoice = await invoiceService.update(id, dto);
  await events.invoiceUpdated(actorOf(req), invoice.id);
  logger.info('Invoice updated', { invoiceId: invoice.id, action: 'update_invoice' });
  res.json({ success: true, data: invoice, error: null, meta: null });
});

export const setInvoiceManualRate = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const { rate } = req.body as ManualRateDto;
  const invoice = await invoiceService.setManualRate(id, rate);
  await events.invoiceRateSet(actorOf(req), id, rate, invoice.conversion.baseCurrency);
  logger.info('Invoice exchange rate set manually', { invoiceId: id, rate, action: 'set_manual_rate' });
  res.json({ success: true, data: invoice, error: null, meta: null });
});

export const clearInvoiceManualRate = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const invoice = await invoiceService.clearManualRate(id);
  await events.invoiceRateCleared(actorOf(req), id);
  logger.info('Invoice manual exchange rate removed', { invoiceId: id, action: 'clear_manual_rate' });
  res.json({ success: true, data: invoice, error: null, meta: null });
});

export const deleteInvoice = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  await invoiceService.softDelete(id);
  await events.invoiceDeleted(actorOf(req), id);
  logger.info('Invoice deleted (soft)', { invoiceId: id, action: 'delete_invoice' });
  res.json({ success: true, data: null, error: null, meta: null });
});

/** attachment = save the file; inline = show/print it in the browser. */
const dispositionOf = (req: Request) => (req.query['disposition'] === 'inline' ? 'inline' : 'attachment');

export const downloadInvoicePdf = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoiceService.getById(String(req.params['id']));
  const doc = buildInvoiceDocument(invoice);
  const bytes = await renderInvoicePdf(doc);
  logger.info('Invoice PDF generated', { invoiceId: invoice.id, disposition: dispositionOf(req), action: 'download_invoice_pdf' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${dispositionOf(req)}; filename="invoice-${doc.fileName}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(Buffer.from(bytes));
});

export const downloadInvoiceExcel = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoiceService.getById(String(req.params['id']));
  const doc = buildInvoiceDocument(invoice);
  const buffer = await renderInvoiceExcel(doc);
  logger.info('Invoice Excel generated', { invoiceId: invoice.id, action: 'download_invoice_excel' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${doc.fileName}.xlsx"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
});

/** Whether the Mail / WhatsApp buttons can attach the file on this computer. */
export const nativeShareStatus = asyncHandler(async (req: Request, res: Response) => {
  const local = nativeShare.isLocalRequest(req.socket.remoteAddress, req.headers['x-forwarded-for']);
  res.json({ success: true, data: { available: nativeShare.isAvailable() && local, copyFile: nativeShare.supportsFileClipboard() && local }, error: null, meta: null });
});

/** Opens Mail (file attached) or WhatsApp (file on the clipboard) on the computer running the server. */
export const shareInvoiceNative = asyncHandler(async (req: Request, res: Response) => {
  const target = (req.body as ShareNativeDto).target;
  const supported = target === 'clipboard' ? nativeShare.supportsFileClipboard() : nativeShare.isAvailable();
  if (!supported) throw new AppError('Opening desktop apps is not available here.', 501, 'NATIVE_SHARE_UNAVAILABLE');
  if (!nativeShare.isLocalRequest(req.socket.remoteAddress, req.headers['x-forwarded-for'])) throw new AppError('Only available from the computer running the server.', 403, 'NATIVE_SHARE_LOCAL_ONLY');

  const { kind, text } = req.body as ShareNativeDto;
  const invoice = await invoiceService.getById(String(req.params['id']));
  const doc = buildInvoiceDocument(invoice);
  const bytes = kind === 'pdf' ? await renderInvoicePdf(doc) : await renderInvoiceExcel(doc);
  const filename = `invoice-${doc.fileName}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`;
  const path = await nativeShare.writeTempFile(filename, bytes);

  const subject = `Invoice ${doc.invoiceNumber}`;
  const body = `Hello,\n\nPlease find attached invoice ${doc.invoiceNumber} dated ${doc.invoiceDate}.\n\nThank you.`;

  let opened: 'mail' | 'app' | 'none' | 'clipboard';
  if (target === 'clipboard') {
    await nativeShare.copyFile(path, text);
    opened = 'clipboard';
  } else if (target === 'mail') {
    await nativeShare.mail(path, subject, body);
    opened = 'mail';
  } else {
    opened = await nativeShare.whatsapp(path, `${subject}\n\n${body}`);
  }
  logger.info('Invoice shared natively', { invoiceId: invoice.id, target, kind, opened, action: 'share_invoice_native' });
  res.json({ success: true, data: { target, filename, opened }, error: null, meta: null });
});

export const exportInvoices = asyncHandler(async (_req: Request, res: Response) => {
  const result = await invoiceService.list({ page: 1, limit: 1000, order: 'desc', sort: 'createdAt' });
  const invoices = result.data as Array<{
    invoiceNumber: string;
    currency: string;
    total: number;
    invoiceDate: string;
    importer: { name: string };
    importerName: string | null;
  }>;

  const wb = XLSX.utils.book_new();
  const wsData = [
    ['Invoice Number', 'Invoice Date', 'Importer', 'Currency', 'Total'],
    ...invoices.map((item) => [
      item.invoiceNumber,
      new Date(item.invoiceDate).toISOString().split('T')[0],
      item.importerName ?? item.importer.name,
      item.currency,
      Number(item.total),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  logger.info('Invoices exported to Excel', { count: invoices.length, action: 'export_invoices' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="invoices-export.xlsx"');
  res.send(buffer);
});

export const importInvoices = asyncHandler(async (_req: Request, res: Response) => {
  res.status(501).json({
    success: false,
    data: null,
    error: { code: 'NOT_IMPLEMENTED', message: 'Import feature coming soon' },
    meta: null,
  });
});
