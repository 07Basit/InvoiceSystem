import type { ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, CalendarDays, Download, FileDown, FileText, Package, Pencil, Printer, Receipt, Ship, StickyNote, Truck, User,
} from 'lucide-react';
import { useInvoice } from '../hooks/useInvoices';
import { useInvoiceStore } from '../store/invoiceStore';
import { invoiceService, type Invoice } from '../services/invoiceService';
import InvoiceForm from '../components/InvoiceForm';
import ExchangeRatePanel from '../components/ExchangeRatePanel';
import { formatCurrency, formatDate } from '@/lib/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
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

/** One labelled value; an empty value shows a dash so every field is visible, filled or not. */
function Item({ label, value, wide }: { label: string; value?: ReactNode; wide?: boolean }) {
  const empty = value === undefined || value === null || value === '';
  return (
    <div className={wide ? 'sm:col-span-2 lg:col-span-3' : undefined}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={empty ? 'mt-0.5 text-sm text-muted-foreground' : 'mt-0.5 text-sm font-medium break-words'}>{empty ? '—' : value}</dd>
    </div>
  );
}

const Grid = ({ children }: { children: ReactNode }) => (
  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
);

function HeaderAction({ label, text, onClick, icon: Icon, primary }: { label: string; text: string; onClick: () => void; icon: typeof Printer; primary?: boolean }) {
  return (
    <Tooltip label={label} align="end">
      <button
        onClick={onClick}
        aria-label={label}
        className={primary
          ? 'flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90'
          : 'flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent'}
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
    importer: [importer.name, importer.address, importer.contact, importer.email],
  };
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useInvoice(id ?? '');
  const { openEditForm } = useInvoiceStore();

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (isError || !data?.data) return <div className="text-center py-16 text-destructive">Invoice not found.</div>;

  const invoice = data.data;
  const cur = invoice.currency;
  const { importer } = invoice;
  const p = parties(invoice);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <Link to="/invoices" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground print:hidden">
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-mono break-all">{invoice.invoiceNumber}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> Invoice date {formatDate(invoice.invoiceDate)}</span>
            <span>Created {formatDate(invoice.createdAt)}</span>
            <span>Updated {formatDate(invoice.updatedAt)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <HeaderAction label="Print invoice" text="Print" icon={Printer} onClick={() => window.print()} />
          <HeaderAction label="Download PDF" text="PDF" icon={FileDown} onClick={() => invoiceService.downloadPdf(invoice.id)} />
          <HeaderAction label="Download Excel" text="Excel" icon={Download} onClick={() => invoiceService.downloadExcel(invoice.id)} />
          <HeaderAction label="Edit invoice" text="Edit" icon={Pencil} primary onClick={() => openEditForm(invoice.id)} />
        </div>
      </div>

      {/* Big total */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-5 py-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Invoice total</p>
          <p className="text-3xl font-bold tracking-tight">{money(invoice.total, cur)}</p>
          {invoice.amountInWords && <p className="mt-0.5 text-sm text-muted-foreground">{invoice.amountInWords}</p>}
        </div>
        <span className="rounded-full border border-[hsl(var(--brand-accent))]/30 bg-[hsl(var(--brand-accent))]/10 px-3 py-1 text-sm font-semibold text-[hsl(var(--brand-accent))]">
          {cur}
        </span>
      </div>

      <ExchangeRatePanel invoice={invoice} />

      {/* Parties */}
      <Section title="Exporter and importer" icon={Building2}>
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
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Importer (consignee)</p>
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
            <Item label="Buyer (if other than consignee)" value={invoice.buyerName} />
          </Grid>
        </div>
      </Section>

      {/* References */}
      <Section title="References" icon={User}>
        <Grid>
          <Item label="Invoice No" value={invoice.invoiceNumber} />
          <Item label="Invoice Date" value={formatDate(invoice.invoiceDate)} />
          <Item label="Exporter's Ref." value={invoice.exportersRef} />
          <Item label="Other Reference(s)" value={invoice.otherReferences} />
          <Item label="AWB No" value={invoice.awbNumber} />
          <Item label="Currency" value={cur} />
        </Grid>
      </Section>

      {/* Shipment */}
      <Section title="Shipment and route" icon={Ship}>
        <Grid>
          <Item label="Pre-Carriage by" value={invoice.preCarriageBy} />
          <Item label="Place of Receipt by Pre-Carrier" value={invoice.placeOfReceiptByPreCarrier} />
          <Item label="Vessel / Flight No." value={invoice.vesselFlightNo} />
          <Item label="Port of Loading" value={invoice.portOfLoading} />
          <Item label="Port of Discharge" value={invoice.portOfDischarge} />
          <Item label="Final Destination" value={invoice.finalDestination} />
          <Item label="Country of Origin" value={invoice.countryOfOrigin} />
          <Item label="Country of Destination" value={invoice.countryOfDestination} />
          <Item label="Loading location (importer)" value={invoice.loadingLocation?.name} />
          <Item label="Landing location (importer)" value={invoice.landingLocation?.name} />
        </Grid>
      </Section>

      {/* Goods and terms */}
      <Section title="Goods and terms" icon={Truck}>
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
          <Package className="h-4 w-4 text-muted-foreground" /> Line items
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{invoice.lineItems.length}</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Marks &amp; Nos / Container No.</th>
                <th className="px-4 py-3 text-left font-medium">Description of Goods</th>
                <th className="px-4 py-3 text-right font-medium">Nett wt per package</th>
                <th className="px-4 py-3 text-right font-medium">No of boxes</th>
                <th className="px-4 py-3 text-right font-medium">Total nett wt (kgs)</th>
                <th className="px-4 py-3 text-right font-medium">Rate per kg</th>
                <th className="px-4 py-3 text-right font-medium">Total per box</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoice.lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{item.marksAndNos || item.containerNo || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">{item.descriptionOfGoods}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{Number(item.netWeightPerPackage).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">{item.numberOfBoxes}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{Number(item.totalNetWeight).toFixed(2)}</td>
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
            <Item label="Total Nett Wt" value={`${Number(invoice.totalNetWeight).toFixed(2)} KGS`} />
            <Item label="Total Gross Wt" value={invoice.totalGrossWeight != null ? `${Number(invoice.totalGrossWeight).toFixed(2)} KGS` : undefined} />
            <Item label={`Amount in words (${cur})`} value={invoice.amountInWords} />
          </dl>
          <div className="space-y-2 rounded-lg bg-muted/40 p-4 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Sub Total</span><span>{money(invoice.subTotal, cur)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Round Off</span><span>{money(invoice.roundOff, cur)}</span></div>
            <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{money(invoice.total, cur)}</span></div>
          </div>
        </div>
      </Section>

      {/* Notes */}
      <Section title="Notes" icon={StickyNote}>
        {invoice.notes ? <p className="whitespace-pre-wrap text-sm">{invoice.notes}</p> : <p className="text-sm text-muted-foreground">No notes.</p>}
      </Section>

      <p className="text-xs text-muted-foreground print:hidden">Importer: {importer.name} · Invoice ID {invoice.id}</p>

      <InvoiceForm />
    </div>
  );
}
