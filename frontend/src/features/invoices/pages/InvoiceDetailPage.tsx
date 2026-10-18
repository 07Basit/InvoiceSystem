import { useState, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Building2, CalendarDays, Download, FileDown, FileText, Package, Landmark, Pencil, Printer, Share2, FileCheck2, ArrowLeftRight, Receipt, Ship, ScrollText, Stamp, Truck, User,
} from 'lucide-react';
import { useCreateActualInvoice, useCreateCounterpartInvoice, useInvoice } from '../hooks/useInvoices';
import { useConfirm } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import { useInvoiceStore } from '../store/invoiceStore';
import { actualInvoiceState, canHaveActual, counterpartState, kindTag, printedNumberOf, type Invoice } from '../services/invoiceService';
import { useInvoiceDocuments } from '../hooks/useInvoiceDocuments';
import ShareInvoiceDialog, { toShareable } from '../components/ShareInvoiceDialog';
import InvoiceForm from '../components/InvoiceForm';
import ExchangeRatePanel from '../components/ExchangeRatePanel';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { formatCountry, formatNumber, formatPortCode } from '@/lib/format';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Tooltip from '@/components/ui/Tooltip';

function Section({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card">
      <h2 className="flex items-center gap-2 border-b px-5 py-3 text-sm font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" /> {title}
      </h2>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** One labelled value; an empty value is simply left blank so every field stays visible. */
function Item({ label, value, wide }: { label: string; value?: ReactNode; wide?: boolean }) {
  const empty = value === undefined || value === null || value === '';
  return (
    <div className={wide ? 'sm:col-span-2 lg:col-span-3' : undefined}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-h-5 text-sm font-medium break-words">{empty ? null : value}</dd>
    </div>
  );
}

const Grid = ({ children }: { children: ReactNode }) => (
  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
);

function HeaderAction({ label, text, onClick, icon: Icon, primary, disabled, greyed }: { label: string; text: string; onClick: () => void; icon: typeof Printer; primary?: boolean; disabled?: boolean; greyed?: boolean }) {
  return (
    <Tooltip label={label} align="end">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={primary
          ? 'flex items-center gap-2 px-3 py-2 text-sm bg-[hsl(var(--brand-accent))] text-white rounded-md hover:opacity-90 disabled:opacity-50'
          : cn('flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent disabled:opacity-50', greyed && 'cursor-not-allowed text-muted-foreground opacity-40 grayscale hover:bg-transparent')}
      >
        <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{text}</span>
      </button>
    </Tooltip>
  );
}

function money(value: number | string | null | undefined, currency: string) {
  return formatCurrency(Number(value ?? 0), currency);
}

function parties(invoice: Invoice) {
  const importer = invoice.importer;
  return {
    exporter: [invoice.exporterName, invoice.exporterAddress, invoice.exporterContact, invoice.exporterEmail],
    // the invoice's own copy (name falls back to the importer for safety); address/contact/email are only ever the copy
    importer: [invoice.importerName ?? importer.name, invoice.importerAddress, invoice.importerContact, invoice.importerEmail],
  };
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useInvoice(id ?? '');
  const { openEditForm } = useInvoiceStore();
  const documents = useInvoiceDocuments();
  const [shareOpen, setShareOpen] = useState(false);
  const confirm = useConfirm();
  const { showToast } = useToast();
  const createActualMutation = useCreateActualInvoice();
  const createCounterpartMutation = useCreateCounterpartInvoice();

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (isError || !data?.data) return <div className="text-center py-16 text-destructive">Invoice not found.</div>;

  const invoice = data.data;
  const actual = actualInvoiceState(invoice);
  const originalOfThis = invoice.actualOf ?? null;
  const actualOfThis = invoice.actuals?.[0] ?? null;
  const askCreateActual = async () => {
    const ok = await confirm({
      title: `Create the actual invoice for ${invoice.invoiceNumber}?`,
      message: `A full copy named ACTUAL ${invoice.invoiceNumber} is created with all the same details. Only one actual invoice can be made from an invoice.`,
      confirmLabel: 'Create actual invoice',
    });
    if (!ok) return;
    try {
      await createActualMutation.mutateAsync(invoice.id);
      showToast('Actual invoice created', `ACTUAL ${invoice.invoiceNumber} is ready.`, 'success');
    } catch (error) {
      showToast("Couldn't create the actual invoice", error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };
  const partnerState = counterpartState(invoice);
  // Both invoices: the party page is the invoice itself, the custom page is a hidden companion invoice shown as a second view.
  // Documents, sharing and editing always go through the party page.
  const isBoth = invoice.invoiceKind === 'BOTH';
  const isCompanion = !!invoice.isCompanion;
  const mainRef = isCompanion ? invoice.counterpartOf ?? null : null;
  const companionLink = isBoth ? invoice.counterparts?.[0] ?? null : isCompanion ? { id: invoice.id } : null;
  const docId = isCompanion ? mainRef?.id ?? invoice.id : invoice.id;
  const tag = isCompanion ? { label: 'Custom page', className: 'border-sky-200 bg-sky-50 text-sky-700' } : kindTag(invoice.invoiceKind);
  const partner = invoice.counterpartOf ?? invoice.counterparts?.[0] ?? null;
  const askCreateCounterpart = async () => {
    const target = partnerState.target.toLowerCase();
    const ok = await confirm({
      title: `Create the ${target} invoice for ${invoice.invoiceNumber}?`,
      message: `A full copy is created as a ${target} invoice with all the same details. Each invoice can have only one ${invoice.invoiceKind === 'CUSTOM' ? 'party' : 'custom'} partner.`,
      confirmLabel: `Create ${target} invoice`,
    });
    if (!ok) return;
    try {
      await createCounterpartMutation.mutateAsync(invoice.id);
      showToast(`${partnerState.target} invoice created`, `${invoice.invoiceNumber} (${partnerState.target}) is ready.`, 'success');
    } catch (error) {
      showToast(`Couldn't create the ${target} invoice`, error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };
  const cur = invoice.currency;
  const { importer } = invoice;
  const p = parties(invoice);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <Breadcrumbs items={[{ label: 'Invoices', to: '/invoices' }, { label: mainRef ? mainRef.invoiceNumber : invoice.invoiceNumber, ...(mainRef ? { to: `/invoices/${mainRef.id}` } : {}) }, ...(mainRef ? [{ label: 'Custom page' }] : [])]} />

      {/* A Both invoice has two pages; each is its own view, and they share the same documents */}
      {(isBoth || isCompanion) && (
        <div role="tablist" aria-label="Invoice pages" className="flex gap-2 print:hidden">
          <Link to={`/invoices/${docId}`} role="tab" aria-selected={!isCompanion} className={cn('rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors', !isCompanion ? 'border-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent))] text-white' : 'hover:bg-accent')}>Party page</Link>
          {companionLink ? (
            <Link to={`/invoices/${companionLink.id}`} role="tab" aria-selected={isCompanion} className={cn('rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors', isCompanion ? 'border-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent))] text-white' : 'hover:bg-accent')}>Custom page</Link>
          ) : null}
        </div>
      )}

      {/* Fixed panel: invoice number down to the invoice amount stays visible while the rest scrolls */}
      <div className="sticky -top-4 z-20 -mx-4 bg-background px-4 pb-2 pt-4 sm:-top-6 sm:-mx-6 sm:px-6 sm:pt-6 print:static">
        <div className="overflow-hidden rounded-xl border bg-card bg-gradient-to-r from-[hsl(var(--primary)/0.08)] to-[hsl(var(--brand-accent)/0.14)] shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-3 sm:px-5 [background-image:radial-gradient(hsl(var(--primary)/0.12)_0.7px,transparent_1px)] [background-size:16px_16px]">
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xl font-bold font-mono break-all sm:text-2xl">
                {isCompanion ? printedNumberOf(invoice) : invoice.invoiceNumber}
                {tag && <span className={cn('rounded-full border px-2.5 py-0.5 font-sans text-xs font-semibold uppercase tracking-wide', tag.className)}>{tag.label}</span>}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:text-sm">
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Invoice Date {formatDate(invoice.invoiceDate)}</span>
                <span className="hidden sm:inline">Created {formatDate(invoice.createdAt)}</span>
                <span className="hidden sm:inline">Updated {formatDate(invoice.updatedAt)}</span>
                {originalOfThis ? <Link to={`/invoices/${originalOfThis.id}`} className="font-semibold text-[hsl(var(--brand-accent))] hover:underline">Actual of {originalOfThis.invoiceNumber}</Link> : null}
                {partner && !isBoth && !isCompanion ? <Link to={`/invoices/${partner.id}`} className="font-semibold text-[hsl(var(--brand-accent))] hover:underline">{partner.invoiceKind === 'CUSTOM' ? 'Custom' : 'Party'} invoice: {partner.invoiceNumber}</Link> : null}
                {actualOfThis ? <Link to={`/invoices/${actualOfThis.id}`} className="font-semibold text-[hsl(var(--brand-accent))] hover:underline">Actual invoice: {actualOfThis.invoiceNumber}</Link> : null}
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <HeaderAction label="Print invoice" text="Print" icon={Printer} onClick={() => documents.print(docId)} disabled={documents.isBusy} />
              <HeaderAction label="Download PDF" text="PDF" icon={FileDown} onClick={() => documents.downloadPdf(docId)} disabled={documents.isBusy} />
              <HeaderAction label="Download Excel" text="Excel" icon={Download} onClick={() => documents.downloadExcel(docId)} disabled={documents.isBusy} />
              <HeaderAction label="Share invoice" text="Share" icon={Share2} onClick={() => setShareOpen(true)} />
              {!isCompanion && canHaveActual(invoice) && <HeaderAction label={actual.label} text="Actual" icon={FileCheck2} onClick={askCreateActual} disabled={!actual.canCreate || createActualMutation.isPending} greyed={!actual.canCreate} />}
              {partnerState.available && !isCompanion && <HeaderAction label={partnerState.label} text={partnerState.target} icon={ArrowLeftRight} onClick={askCreateCounterpart} disabled={!partnerState.canCreate || createCounterpartMutation.isPending} greyed={!partnerState.canCreate} />}
              <HeaderAction label="Edit invoice" text="Edit" icon={Pencil} primary onClick={() => openEditForm(docId)} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#a9bcbc] px-4 py-3 sm:px-5 [background-image:radial-gradient(hsl(var(--brand-accent)/0.18)_1px,transparent_1.4px)] [background-size:22px_22px]">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Invoice Total</p>
              <p className="text-2xl font-bold tracking-tight sm:text-3xl">{money(invoice.total, cur)}</p>
              {invoice.amountInWords && <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">{invoice.amountInWords}</p>}
            </div>
            <span className="shrink-0 rounded-full border border-[hsl(var(--brand-accent))]/30 bg-[hsl(var(--brand-accent))]/10 px-3 py-1 text-sm font-semibold text-[hsl(var(--brand-accent))]">
              {cur}
            </span>
          </div>
        </div>
      </div>

      <ExchangeRatePanel invoice={invoice} />

      {/* Parties */}
      <Section title="Exporter and Importer" icon={Building2}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exporter</p>
            <dl className="space-y-3">
              <Item label="Name" value={p.exporter[0]} />
              <Item label="Address" value={p.exporter[1]} />
              <Item label="Contact" value={p.exporter[2]} />
              <Item label="Email" value={p.exporter[3]} />
            </dl>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Importer (Consignee)</p>
            <dl className="space-y-3">
              <Item label="Name" value={p.importer[0]} />
              <Item label="Address" value={p.importer[1]} />
              <Item label="Contact" value={p.importer[2]} />
              <Item label="Email" value={p.importer[3]} />
            </dl>
          </div>
        </div>
        <div className="mt-5 border-t pt-4">
          <Grid>
            <Item label="Buyer (If Other Than Consignee)" value={invoice.buyerName} />
          </Grid>
        </div>
      </Section>

      <Section title="Shipping Details" icon={User}>
        <Grid>
          <Item label="Invoice No" value={printedNumberOf(invoice)} />
          <Item label="Invoice Date" value={formatDate(invoice.invoiceDate)} />
          <Item label="Exporter's Ref." value={invoice.exportersRef} />
          <Item label="Other Reference(s)" value={invoice.otherReferences} />
          <Item label="AWB No" value={invoice.awbNumber} />
          <Item label="Buyer's Order No. & Date" value={invoice.buyersOrder} />
          <Item label="Currency" value={cur} />
        </Grid>
      </Section>

      <Section title="Route and Ports" icon={Ship}>
        <Grid>
          <Item label="Pre-Carriage by" value={invoice.preCarriageBy} />
          <Item label="Place of Receipt by Pre-Carrier" value={invoice.placeOfReceiptByPreCarrier} />
          <Item label="Vessel / Flight No." value={invoice.vesselFlightNo} />
          <Item label="Port of Loading" value={formatPortCode(invoice.portOfLoading)} />
          <Item label="Port of Discharge" value={formatPortCode(invoice.portOfDischarge)} />
          <Item label="Final Destination" value={formatPortCode(invoice.finalDestination)} />
          <Item label="Country of Origin" value={formatCountry(invoice.countryOfOrigin)} />
          <Item label="Country of Destination" value={formatCountry(invoice.countryOfDestination)} />
          <Item label="Loading Location (Importer)" value={invoice.loadingLocation?.name} />
          <Item label="Landing Location (Importer)" value={invoice.landingLocation?.name} />
        </Grid>
      </Section>

      {/* Goods and terms */}
      <Section title="Goods and Terms" icon={Truck}>
        <Grid>
          <Item label="Description of Goods" value={invoice.descriptionOfGoods} wide />
          <Item label="HS Code" value={invoice.hsCode} />
          <Item label="Terms of Delivery" value={invoice.termsOfDelivery} />
          <Item label="Terms of Payment" value={invoice.termsOfPayment} />
        </Grid>
      </Section>

      {/* Line items */}
      <section className="rounded-xl border bg-card overflow-hidden">
        <h2 className="flex items-center gap-2 border-b px-5 py-3 text-sm font-semibold">
          <Package className="h-4 w-4 text-muted-foreground" /> Product Items
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{invoice.lineItems.length}</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Marks &amp; Nos / Container No.</th>
                <th className="px-4 py-3 text-left font-medium">Description of Goods</th>
                <th className="px-4 py-3 text-right font-medium">Nett Wt per Package</th>
                <th className="px-4 py-3 text-right font-medium">No of Boxes</th>
                <th className="px-4 py-3 text-right font-medium">Total Nett Wt (Kgs)</th>
                <th className="px-4 py-3 text-right font-medium">Rate per Kg</th>
                <th className="px-4 py-3 text-right font-medium">Total per Box</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoice.lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{item.marksAndNos || item.containerNo}</td>
                  <td className="px-4 py-3">{item.descriptionOfGoods}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatNumber(Number(item.netWeightPerPackage))}</td>
                  <td className="px-4 py-3 text-right">{item.numberOfBoxes}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatNumber(Number(item.totalNetWeight))}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{money(item.ratePerKg, cur)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{money(item.totalPerBox, cur)}</td>
                  <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{money(item.amount, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Totals */}
      <Section title="Totals" icon={Receipt}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <dl className="space-y-3">
            <Item label="No of Packages" value={invoice.totalBoxes} />
            <Item label="Total Nett Wt" value={`${formatNumber(Number(invoice.totalNetWeight))} KGS`} />
            <Item label="Total Gross Wt" value={invoice.totalGrossWeight != null ? `${formatNumber(Number(invoice.totalGrossWeight))} KGS` : undefined} />
            <Item label={`Amount in Words (${cur})`} value={invoice.amountInWords} />
          </dl>
          <div className="space-y-2 rounded-lg bg-muted/40 p-4 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Sub Total</span><span>{money(invoice.subTotal, cur)}</span></div>
            <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{money(invoice.total, cur)}</span></div>
          </div>
        </div>
      </Section>

      {/* Bank details: the invoice's own copy */}
      <Section title="Bank Details" icon={Landmark}>
        <Grid>
          <Item label="Bank Name" value={invoice.bankName} />
          <Item label="Account Number" value={invoice.bankAccountNumber} />
          <Item label="IFSC Code" value={invoice.bankIfscCode} />
          <Item label="SWIFT Code" value={invoice.bankSwiftCode} />
        </Grid>
      </Section>

      {invoice.declaration ? (
        <Section title="Declaration" icon={ScrollText}>
          <p className="whitespace-pre-line text-sm leading-relaxed">{invoice.declaration}</p>
        </Section>
      ) : null}

      {invoice.signImage ? (
        <Section title="Seal & Sign" icon={Stamp}>
          <img src={invoice.signImage} alt={invoice.signName ?? 'Seal and sign'} className="max-h-28 w-auto rounded-md border bg-white p-2 object-contain" />
          {invoice.signName ? <p className="mt-1 text-xs text-muted-foreground">{invoice.signName}</p> : null}
        </Section>
      ) : null}

      <p className="text-xs text-muted-foreground print:hidden">Importer: {invoice.importerName ?? importer.name} · Invoice ID {invoice.id}</p>

      <InvoiceForm />
      {shareOpen && <ShareInvoiceDialog invoice={toShareable({ ...invoice, id: docId })} onClose={() => setShareOpen(false)} />}
    </div>
  );
}
