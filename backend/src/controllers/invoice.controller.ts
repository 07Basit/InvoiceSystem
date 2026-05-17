import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { invoiceService } from '../services/invoice.service';
import type { CreateInvoiceDto, ListInvoicesQuery, UpdateInvoiceDto } from 'shared';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListInvoicesQuery;
  const result = await invoiceService.list(query);
  res.json({ success: true, data: result.data, error: null, meta: result.meta });
});

export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const invoice = await invoiceService.getById(id);
  logger.info('Invoice fetched', { invoiceId: invoice.id, action: 'get_invoice' });
  res.json({ success: true, data: invoice, error: null, meta: null });
});

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const dto = req.body as CreateInvoiceDto;
  const invoice = await invoiceService.create(dto);
  logger.info('Invoice created', { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, action: 'create_invoice' });
  res.status(201).json({ success: true, data: invoice, error: null, meta: null });
});

export const updateInvoice = asyncHandler(async (req: Request, res: Response) => {
  const dto = req.body as UpdateInvoiceDto;
  const id = String(req.params['id']);
  const invoice = await invoiceService.update(id, dto);
  logger.info('Invoice updated', { invoiceId: invoice.id, action: 'update_invoice' });
  res.json({ success: true, data: invoice, error: null, meta: null });
});

export const deleteInvoice = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  await invoiceService.softDelete(id);
  logger.info('Invoice deleted (soft)', { invoiceId: id, action: 'delete_invoice' });
  res.json({ success: true, data: null, error: null, meta: null });
});

export const downloadInvoicePdf = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const invoice = await invoiceService.getById(id);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();

  page.drawText('INVOICE', { x: 50, y: height - 60, font: boldFont, size: 26, color: rgb(0.08, 0.08, 0.65) });
  page.drawText(`Invoice No: ${invoice.invoiceNumber}`, { x: 50, y: height - 90, font, size: 11 });
  page.drawText(`Invoice Date: ${new Date(invoice.invoiceDate).toLocaleDateString()}`, { x: 50, y: height - 106, font, size: 11 });

  page.drawText(`Exporter: ${invoice.exporterName ?? '-'}`, { x: 50, y: height - 140, font: boldFont, size: 11 });
  page.drawText(`Importer: ${invoice.importer.name}`, { x: 50, y: height - 158, font: boldFont, size: 11 });
  page.drawText(`Buyer: ${invoice.buyerName ?? '-'}`, { x: 50, y: height - 176, font, size: 10 });

  let y = height - 220;
  page.drawText('Description', { x: 50, y, font: boldFont, size: 10 });
  page.drawText('Kgs/Box', { x: 250, y, font: boldFont, size: 10 });
  page.drawText('Boxes', { x: 315, y, font: boldFont, size: 10 });
  page.drawText('Rate/Kg', { x: 365, y, font: boldFont, size: 10 });
  page.drawText('Amount', { x: 455, y, font: boldFont, size: 10 });
  y -= 18;

  for (const item of invoice.lineItems) {
    page.drawText(item.descriptionOfGoods.slice(0, 28), { x: 50, y, font, size: 9 });
    page.drawText(Number(item.netWeightPerPackage).toFixed(2), { x: 250, y, font, size: 9 });
    page.drawText(String(item.numberOfBoxes), { x: 315, y, font, size: 9 });
    page.drawText(`${invoice.currency} ${Number(item.ratePerKg).toFixed(2)}`, { x: 365, y, font, size: 9 });
    page.drawText(`${invoice.currency} ${Number(item.amount).toFixed(2)}`, { x: 455, y, font, size: 9 });
    y -= 16;

    if (y < 120) {
      break;
    }
  }

  y -= 14;
  page.drawText(`Total Net Weight: ${Number(invoice.totalNetWeight).toFixed(2)} KGS`, { x: 50, y, font: boldFont, size: 10 });
  y -= 16;
  page.drawText(`Sub Total: ${invoice.currency} ${Number(invoice.subTotal).toFixed(2)}`, { x: 330, y, font, size: 10 });
  y -= 14;
  page.drawText(`Round Off: ${invoice.currency} ${Number(invoice.roundOff).toFixed(2)}`, { x: 330, y, font, size: 10 });
  y -= 14;
  page.drawText(`Total: ${invoice.currency} ${Number(invoice.total).toFixed(2)}`, { x: 330, y, font: boldFont, size: 12 });

  const pdfBytes = await pdfDoc.save();
  logger.info('Invoice PDF downloaded', { invoiceId: invoice.id, action: 'download_invoice_pdf' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
  res.send(Buffer.from(pdfBytes));
});

export const downloadInvoiceExcel = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const invoice = await invoiceService.getById(id);

  const wb = XLSX.utils.book_new();
  const wsData = [
    ['Invoice Number', invoice.invoiceNumber],
    ['Invoice Date', new Date(invoice.invoiceDate).toISOString().split('T')[0]],
    ['Exporter', invoice.exporterName ?? ''],
    ['Importer', invoice.importer.name],
    ['Buyer', invoice.buyerName ?? ''],
    ['Currency', invoice.currency],
    [],
    [
      'Marks & Nos',
      'Container No',
      'Description of Goods',
      'Net Wt Per Package',
      'No Of Boxes',
      'Total Net Wt Kgs',
      'Rate Per Kgs',
      'Total Per Box',
      `Amount (${invoice.currency})`,
    ],
    ...invoice.lineItems.map((item) => [
      item.marksAndNos ?? '',
      item.containerNo ?? '',
      item.descriptionOfGoods,
      Number(item.netWeightPerPackage),
      item.numberOfBoxes,
      Number(item.totalNetWeight),
      Number(item.ratePerKg),
      Number(item.totalPerBox),
      Number(item.amount),
    ]),
    [],
    ['Total Net Weight', Number(invoice.totalNetWeight)],
    ['Total Gross Weight', invoice.totalGrossWeight ? Number(invoice.totalGrossWeight) : ''],
    ['Sub Total', Number(invoice.subTotal)],
    ['Round Off', Number(invoice.roundOff)],
    ['Total', Number(invoice.total)],
    ['Amount In Words', invoice.amountInWords ?? ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Invoice');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  logger.info('Invoice Excel downloaded', { invoiceId: invoice.id, action: 'download_invoice_excel' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.xlsx"`);
  res.send(buffer);
});

export const exportInvoices = asyncHandler(async (_req: Request, res: Response) => {
  const result = await invoiceService.list({ page: 1, limit: 1000, order: 'desc', sort: 'createdAt' });
  const invoices = result.data as Array<{
    invoiceNumber: string;
    status: string;
    currency: string;
    total: number;
    invoiceDate: string;
    importer: { name: string };
  }>;

  const wb = XLSX.utils.book_new();
  const wsData = [
    ['Invoice Number', 'Invoice Date', 'Status', 'Importer', 'Currency', 'Total'],
    ...invoices.map((item) => [
      item.invoiceNumber,
      new Date(item.invoiceDate).toISOString().split('T')[0],
      item.status,
      item.importer.name,
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
