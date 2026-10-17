import { afterEach, describe, expect, it, vi } from 'vitest';
import { canShareFile, mailtoUrl, shareFile, shareMessage, whatsappNumber, whatsappUrl } from '../share';

const info = { invoiceNumber: 'INV-1', invoiceDate: '2026-10-17T00:00:00.000Z', currency: 'EUR', total: 2570.4, exporterName: 'Green Harvest' };

afterEach(() => { vi.restoreAllMocks(); Object.assign(navigator, { share: undefined, canShare: undefined }); });

describe('shareMessage', () => {
  it('is the invoice heading, a greeting, the invoice number and date, and a thank you', () => {
    const { subject, body, text } = shareMessage(info);
    expect(subject).toBe('Invoice INV-1');
    expect(body).toBe('Hello,\n\nPlease find attached invoice INV-1 dated Oct 17, 2026.\n\nThank you.');
    expect(text).toBe('Invoice INV-1\n\nHello,\n\nPlease find attached invoice INV-1 dated Oct 17, 2026.\n\nThank you.');
  });
  it('does not mention the sender or the amount', () => {
    expect(shareMessage(info).text).not.toMatch(/Green Harvest|EUR|2,570/);
  });
});

describe('links', () => {
  it('builds a mailto link with the subject and body encoded', () => {
    const url = mailtoUrl(' buyer@example.com ', 'Invoice A&B', 'Line 1\nLine 2');
    expect(url).toBe('mailto:buyer@example.com?subject=Invoice%20A%26B&body=Line%201%0ALine%202');
  });
  it('allows no recipient', () => {
    expect(mailtoUrl('', 's', 'b')).toBe('mailto:?subject=s&body=b');
  });
  it('keeps only digits of a phone number for WhatsApp', () => {
    expect(whatsappNumber('+1 (555) 010-0100')).toBe('15550100100');
    expect(whatsappNumber(null)).toBe('');
    expect(whatsappUrl('+91 90000 10000', 'Hi there')).toBe('https://wa.me/919000010000?text=Hi%20there');
    expect(whatsappUrl('', 'Hi')).toBe('https://wa.me/?text=Hi');
  });
});

describe('share sheet', () => {
  const file = new File(['x'], 'invoice.pdf', { type: 'application/pdf' });

  it('is only offered when the browser can share files', () => {
    expect(canShareFile(file)).toBe(false);
    Object.assign(navigator, { share: vi.fn(), canShare: vi.fn(() => true) });
    expect(canShareFile(file)).toBe(true);
    Object.assign(navigator, { canShare: vi.fn(() => false) });
    expect(canShareFile(file)).toBe(false);
  });

  it('hands the file and message to the share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share, canShare: () => true });
    await expect(shareFile(file, { subject: 'S', text: 'T' })).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'S', text: 'T' });
  });

  it('treats closing the sheet as cancelled, but reports real errors', async () => {
    Object.assign(navigator, { canShare: () => true, share: vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError')) });
    await expect(shareFile(file, { subject: 'S', text: 'T' })).resolves.toBe('cancelled');
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(new Error('boom')) });
    await expect(shareFile(file, { subject: 'S', text: 'T' })).rejects.toThrow('boom');
  });
});
