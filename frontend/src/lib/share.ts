import { formatDate } from '@/lib/utils';

export interface ShareInvoiceInfo {
  invoiceNumber: string;
  invoiceDate: string;
  currency?: string | undefined;
  total?: number | string | undefined;
  exporterName?: string | null | undefined;
}

export interface ShareMessage {
  /** "Invoice INV-1": the email subject / share title */
  subject: string;
  /** "Hello, ... Thank you." */
  body: string;
  /** The whole note as one block: subject, blank line, body */
  text: string;
}

/** The note that goes with the file in an email, a chat or a share sheet. */
export function shareMessage(info: ShareInvoiceInfo): ShareMessage {
  const subject = `Invoice ${info.invoiceNumber}`;
  const body = `Hello,\n\nPlease find attached invoice ${info.invoiceNumber} dated ${formatDate(info.invoiceDate)}.\n\nThank you.`;
  return { subject, body, text: `${subject}\n\n${body}` };
}

/** mailto: link with the recipient (optional), subject and body filled in. */
export function mailtoUrl(to: string, subject: string, body: string): string {
  const recipient = to.trim();
  return `mailto:${encodeURIComponent(recipient).replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Digits only, so "+1 (555) 010-0100" and "1 555 010 0100" both become 15550100100. */
export function whatsappNumber(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '');
}

/** WhatsApp chat link; with no number it opens the "choose a chat" screen with the text ready. */
export function whatsappUrl(number: string | null | undefined, text: string): string {
  const digits = whatsappNumber(number);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** True when this browser can hand a real file to the system share sheet (Mail, WhatsApp, AirDrop...). */
export function canShareFile(file: File | File[]): boolean {
  const files = Array.isArray(file) ? file : [file];
  return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && typeof navigator.share === 'function' && navigator.canShare({ files });
}

/** "blocked" = the browser refused to share this file (it only lets some file types through, often not Excel). */
export type ShareOutcome = 'shared' | 'cancelled' | 'blocked';

/**
 * Opens the system share sheet with the file. "cancelled" when the user closes it without choosing;
 * "blocked" when the browser refuses the file ("Permission denied": Chrome and Brave only allow some file
 * types, such as PDF and images, and turn away others like Excel). A plainer share is tried before giving up.
 */
export async function shareFile(file: File | File[], message: Pick<ShareMessage, 'subject' | 'text'>): Promise<ShareOutcome> {
  const files = Array.isArray(file) ? file : [file];
  const attempts: ShareData[] = [{ files, title: message.subject, text: message.text }, { files }];
  for (const data of attempts) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      if (error instanceof DOMException && error.name === 'NotAllowedError') continue;
      throw error;
    }
  }
  return 'blocked';
}

/** Can this browser share a PDF to other apps? (Used to tell "no file sharing at all" from "not this file type".) */
export function canSharePdf(): boolean {
  return canShareFile(new File(['%PDF-1.4'], 'probe.pdf', { type: 'application/pdf' }));
}

/** Saves a blob through a temporary link (works without any popup permission). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
