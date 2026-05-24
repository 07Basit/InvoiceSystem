import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Lock, Unlock, Save, Upload } from 'lucide-react';
import type { CreateInvoiceDto, UpsertExporterProfileDto } from 'shared';
import { useClients } from '@/features/clients/hooks/useClients';
import { useCreateInvoice, useInvoice, useUpdateInvoice } from '../hooks/useInvoices';
import { useExporterProfile, useSaveExporterProfile } from '../hooks/useExporterProfile';
import { useInvoiceStore } from '../store/invoiceStore';
import { useToast } from '@/components/ui/toast';
import { ApiClientError } from '@/services/api';
import defaultInvoiceSign from '@/assets/invoice/InvoiceSign.png';

const invoiceDraftListKey = 'invoice-draft-list-v1';
const bankDetailsStorageKey = 'invoice-bank-details-v1';
const invoiceSignStorageKey = 'invoice-sign-v2';

type FieldErrors = Record<string, string>;

interface InvoiceDraft {
  id: string;
  createdAt: string;
  data: CreateInvoiceDto;
}

interface BankDetails {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  swiftCode: string;
}

const initialInvoice: CreateInvoiceDto = {
  importerId: '',
  invoiceNumber: '',
  invoiceDate: new Date().toISOString(),
  exportersRef: '',
  otherReferences: '',
  awbNumber: '',
  preCarriageBy: 'TRUCK BY ROAD',
  placeOfReceiptByPreCarrier: 'N/A',
  vesselFlightNo: 'By Air',
  loadingLocationId: undefined,
  landingLocationId: undefined,
  portOfLoading: '',
  portOfDischarge: '',
  finalDestination: '',
  buyerName: '',
  countryOfOrigin: '',
  countryOfDestination: '',
  descriptionOfGoods: 'FRUITS & VEGETABLES',
  hsCode: '709',
  termsOfDelivery: 'CNF YUL',
  termsOfPayment: 'ADVANCE',
  currency: '',
  exporterName: '',
  exporterAddress: '',
  exporterContact: '',
  exporterEmail: '',
  lineItems: [
    { marksAndNos: '', containerNo: '', descriptionOfGoods: '', netWeightPerPackage: 0, numberOfBoxes: 0, ratePerKg: 0 },
  ],
  totalGrossWeight: undefined,
  roundOff: 0,
  amountInWords: '',
  notes: '',
  status: 'DRAFT',
};

const emptyExporter: UpsertExporterProfileDto = { name: '', address: '', contact: '', email: '', isLocked: false };

const defaultBankDetails: BankDetails = {
  bankName: 'HDFC BANK',
  accountNumber: '5036834342323',
  ifscCode: 'HDFC45300321',
  swiftCode: 'HDFCINDFBXXX',
};

function toDateInput(iso: string) { return iso.slice(0, 10); }
function toIsoDate(v: string) { return new Date(`${v}T00:00:00.000Z`).toISOString(); }
function parseNumber(v: string) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function toWords(value: number): string {
  if (!Number.isFinite(value)) return '';
  const b20 = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const chunk = (n: number): string => {
    if (n < 20) return b20[n] ?? '';
    if (n < 100) { const t = Math.floor(n/10); const u = n%10; return `${tens[t]}${u ? ` ${b20[u]}` : ''}`; }
    const h = Math.floor(n/100); const rest = n%100;
    return `${b20[h]} Hundred${rest ? ` ${chunk(rest)}` : ''}`;
  };
  const integer = Math.floor(Math.abs(value));
  if (integer === 0) return 'Zero';
  const scales = ['','Thousand','Million','Billion'];
  let rem = integer; let si = 0; const parts: string[] = [];
  while (rem > 0 && si < scales.length) {
    const c = rem % 1000;
    if (c > 0) { const s = scales[si] ? ` ${scales[si]}` : ''; parts.unshift(`${chunk(c)}${s}`.trim()); }
    rem = Math.floor(rem/1000); si++;
  }
  return parts.join(' ');
}

function fractionLabel(currency: string) {
  const c = currency.toUpperCase();
  if (c === 'GBP') return 'Pence'; if (c === 'INR') return 'Paise'; if (c === 'AED') return 'Fils'; return 'Cents';
}

function formatAmountInWords(amount: number, currency: string) {
  if (!Number.isFinite(amount)) return '';
  const abs = Math.abs(amount); const major = Math.floor(abs); const minor = Math.round((abs - major) * 100);
  const mw = toWords(major);
  if (minor === 0) return mw;
  return `${mw} and ${toWords(minor)} ${fractionLabel(currency)}`;
}

function readInvoiceDrafts(): InvoiceDraft[] {
  try { const raw = localStorage.getItem(invoiceDraftListKey); if (!raw) return []; const p = JSON.parse(raw) as InvoiceDraft[]; return Array.isArray(p) ? p : []; } catch { return []; }
}
function readBankDetails(): BankDetails {
  try { const raw = localStorage.getItem(bankDetailsStorageKey); if (!raw) return defaultBankDetails; const p = JSON.parse(raw) as BankDetails; return p ? { ...defaultBankDetails, ...p } : defaultBankDetails; } catch { return defaultBankDetails; }
}
function readSignImage() { return localStorage.getItem(invoiceSignStorageKey) || defaultInvoiceSign; }

export default function InvoiceForm() {
  const { isFormOpen, editingId, draftId, draftData, closeForm } = useInvoiceStore();
  const { data: invoiceData } = useInvoice(editingId ?? '');
  const { data: importersData } = useClients({ limit: 100, sort: 'name' });
  const { data: exporterData } = useExporterProfile();
  const saveExporterMutation = useSaveExporterProfile();
  const createMutation = useCreateInvoice();
  const updateMutation = useUpdateInvoice();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<CreateInvoiceDto>(initialInvoice);
  const [exporter, setExporter] = useState<UpsertExporterProfileDto>(emptyExporter);
  const [exporterLocked, setExporterLocked] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [buyerOrderNoAndDate, setBuyerOrderNoAndDate] = useState('');
  const [bankDetails, setBankDetails] = useState<BankDetails>(() => readBankDetails());
  const [isBankLocked, setIsBankLocked] = useState(true);
  const [signImage, setSignImage] = useState<string>(() => readSignImage());
  const [isSignLocked, setIsSignLocked] = useState(true);

  const isEditing = Boolean(editingId);
  const invoice = invoiceData?.data;
  const importers = importersData?.data ?? [];
  const selectedImporter = useMemo(() => importers.find((i) => i.id === form.importerId), [form.importerId, importers]);

  useEffect(() => {
    if (exporterData?.data) {
      setExporter({ name: exporterData.data.name, address: exporterData.data.address, contact: exporterData.data.contact, email: exporterData.data.email ?? '', isLocked: exporterData.data.isLocked });
      setExporterLocked(Boolean(exporterData.data.isLocked));
    }
  }, [exporterData]);

  useEffect(() => {
    if (!invoice || !isEditing) return;
    setForm({
      importerId: invoice.importerId, invoiceNumber: invoice.invoiceNumber, invoiceDate: invoice.invoiceDate,
      exportersRef: invoice.exportersRef ?? '', otherReferences: invoice.otherReferences ?? '', awbNumber: invoice.awbNumber ?? '',
      preCarriageBy: invoice.preCarriageBy ?? 'TRUCK BY ROAD', placeOfReceiptByPreCarrier: invoice.placeOfReceiptByPreCarrier ?? 'N/A',
      vesselFlightNo: invoice.vesselFlightNo ?? 'By Air', loadingLocationId: invoice.loadingLocationId ?? undefined,
      landingLocationId: invoice.landingLocationId ?? undefined, portOfLoading: invoice.portOfLoading ?? '',
      portOfDischarge: invoice.portOfDischarge ?? '', finalDestination: invoice.finalDestination ?? '',
      buyerName: invoice.buyerName ?? '', countryOfOrigin: invoice.countryOfOrigin ?? '', countryOfDestination: invoice.countryOfDestination ?? '',
      descriptionOfGoods: invoice.descriptionOfGoods ?? 'FRUITS & VEGETABLES', hsCode: invoice.hsCode ?? '709',
      termsOfDelivery: invoice.termsOfDelivery ?? 'CNF YUL', termsOfPayment: invoice.termsOfPayment ?? 'ADVANCE',
      currency: invoice.currency, exporterName: invoice.exporterName ?? '', exporterAddress: invoice.exporterAddress ?? '',
      exporterContact: invoice.exporterContact ?? '', exporterEmail: invoice.exporterEmail ?? '',
      lineItems: invoice.lineItems.map((item) => {
        const combined = item.marksAndNos || item.containerNo || '';
        return { marksAndNos: combined, containerNo: combined, descriptionOfGoods: item.descriptionOfGoods, netWeightPerPackage: Number(item.netWeightPerPackage), numberOfBoxes: item.numberOfBoxes, ratePerKg: Number(item.ratePerKg) };
      }),
      totalGrossWeight: invoice.totalGrossWeight ?? undefined, roundOff: Number(invoice.roundOff),
      amountInWords: invoice.amountInWords ?? '', notes: invoice.notes ?? '', status: invoice.status,
    });
    setBuyerOrderNoAndDate('');
  }, [invoice, isEditing]);

  useEffect(() => {
    if (!isFormOpen) { setForm(initialInvoice); setErrors({}); setSubmitError(null); setBuyerOrderNoAndDate(''); return; }
    if (!isEditing && draftData) { setForm(draftData); setErrors({}); setSubmitError(null); }
  }, [isFormOpen, isEditing, draftData]);

  const lineDetails = form.lineItems.map((item) => {
    const totalNetWeight = Number(item.netWeightPerPackage) * Number(item.numberOfBoxes);
    const totalPerBox = Number(item.netWeightPerPackage) * Number(item.ratePerKg);
    const amount = totalNetWeight * Number(item.ratePerKg);
    return { totalNetWeight, totalPerBox, amount };
  });

  const totalNetWeight = lineDetails.reduce((s, i) => s + i.totalNetWeight, 0);
  const totalBoxes = form.lineItems.reduce((s, i) => s + Number(i.numberOfBoxes), 0);
  const subTotal = lineDetails.reduce((s, i) => s + i.amount, 0);
  const roundOff = Number(form.roundOff ?? 0);
  const total = subTotal + roundOff;
  const resolvedCurrency = selectedImporter?.currency ?? form.currency;
  const autoAmountInWords = useMemo(() => formatAmountInWords(total, resolvedCurrency || form.currency || 'USD'), [total, resolvedCurrency, form.currency]);

  useEffect(() => { setForm((prev) => ({ ...prev, amountInWords: autoAmountInWords })); }, [autoAmountInWords]);

  const isPending = createMutation.isPending || updateMutation.isPending || saveExporterMutation.isPending;

  const clearFieldError = (key: string) => setErrors((prev) => { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });

  const applyImporterDefaults = (importerId: string) => {
    clearFieldError('importerId');
    const importer = importers.find((i) => i.id === importerId);
    if (!importer) return;
    const fl = importer.landingLocations[0]; const lo = importer.loadingLocations[0];
    setForm((prev) => ({
      ...prev, importerId, buyerName: '', currency: importer.currency,
      landingLocationId: fl?.id, loadingLocationId: lo?.id,
      portOfDischarge: fl?.portOfDischarge ?? '', finalDestination: fl?.finalDestination ?? '', countryOfDestination: fl?.countryOfDestination ?? '',
      portOfLoading: lo?.portOfLoading ?? '', countryOfOrigin: lo?.countryOfOrigin ?? '',
    }));
  };

  const saveExporter = async () => {
    try {
      await saveExporterMutation.mutateAsync({ ...exporter, isLocked: exporterLocked });
      setForm((prev) => ({ ...prev, exporterName: exporter.name, exporterAddress: exporter.address, exporterContact: exporter.contact, exporterEmail: exporter.email }));
      showToast('Exporter saved', 'Exporter details updated.', 'success');
    } catch (error) { showToast('Unable to save exporter', error instanceof Error ? error.message : 'Please try again.', 'error'); }
  };

  const saveBankDetails = () => { localStorage.setItem(bankDetailsStorageKey, JSON.stringify(bankDetails)); showToast('Bank details saved', 'Bank details were updated.', 'success'); };
  const saveSignImage = () => { localStorage.setItem(invoiceSignStorageKey, signImage); showToast('Sign saved', 'Sign and stamp image was updated.', 'success'); };

  const handleSignUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') setSignImage(reader.result); };
    reader.readAsDataURL(file);
  };

  const saveDraft = () => {
    const draft: InvoiceDraft = {
      id: draftId ?? `draft-${Date.now()}`, createdAt: new Date().toISOString(),
      data: { ...form, currency: (resolvedCurrency || form.currency || '').toUpperCase(), status: 'DRAFT' },
    };
    const existing = readInvoiceDrafts();
    const next = draftId ? existing.map((i) => (i.id === draft.id ? draft : i)) : [draft, ...existing];
    localStorage.setItem(invoiceDraftListKey, JSON.stringify(next));
    window.dispatchEvent(new Event('invoice-drafts-updated'));
    showToast('Draft saved', 'Invoice draft saved.', 'success');
    closeForm();
  };

  const validateForm = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!form.importerId) e.importerId = 'Importer is required.';
    if (!form.invoiceNumber.trim()) e.invoiceNumber = 'Invoice number is required.';
    if (!form.invoiceDate) e.invoiceDate = 'Invoice date is required.';
    if (!(form.exportersRef ?? '').trim()) e.exportersRef = 'Exporter\'s Ref. is required.';
    if (!(form.otherReferences ?? '').trim()) e.otherReferences = 'Other Reference(s) is required.';
    if (!(form.awbNumber ?? '').trim()) e.awbNumber = 'AWB NO is required.';
    if (!(form.preCarriageBy ?? '').trim()) e.preCarriageBy = 'Pre-Carriage by is required.';
    if (!(form.placeOfReceiptByPreCarrier ?? '').trim()) e.placeOfReceiptByPreCarrier = 'Place of Receipt is required.';
    if (!(form.vesselFlightNo ?? '').trim()) e.vesselFlightNo = 'Vessel Flight No. is required.';
    if (!(form.portOfLoading ?? '').trim()) e.portOfLoading = 'Port of Loading is required.';
    if (!(form.portOfDischarge ?? '').trim()) e.portOfDischarge = 'Port of Discharge is required.';
    if (!(form.finalDestination ?? '').trim()) e.finalDestination = 'Final Destination is required.';
    if (!(form.countryOfOrigin ?? '').trim()) e.countryOfOrigin = 'Country of Origin is required.';
    if (!(form.countryOfDestination ?? '').trim()) e.countryOfDestination = 'Country of Destination is required.';
    if (!(form.descriptionOfGoods ?? '').trim()) e.descriptionOfGoods = 'Description of Goods is required.';
    if (!(form.hsCode ?? '').trim()) e.hsCode = 'HS Code is required.';
    if (!(form.termsOfDelivery ?? '').trim()) e.termsOfDelivery = 'Terms of Delivery is required.';
    if (!(form.termsOfPayment ?? '').trim()) e.termsOfPayment = 'Terms of Payment is required.';
    if (!(resolvedCurrency || form.currency).trim()) e.currency = 'Currency is required.';
    form.lineItems.forEach((item, index) => {
      if (!(item.marksAndNos ?? '').trim()) e[`lineItems.${index}.marksAndNos`] = 'Marks/Container is required.';
      if (!(item.descriptionOfGoods ?? '').trim()) e[`lineItems.${index}.descriptionOfGoods`] = 'Description is required.';
      if (Number(item.netWeightPerPackage) <= 0) e[`lineItems.${index}.netWeightPerPackage`] = 'Must be > 0.';
      if (Number(item.numberOfBoxes) < 0) e[`lineItems.${index}.numberOfBoxes`] = 'Cannot be negative.';
      if (Number(item.ratePerKg) < 0) e[`lineItems.${index}.ratePerKg`] = 'Cannot be negative.';
    });
    return e;
  };

  const submitInvoice = async () => {
    setSubmitError(null);
    const fieldErrors = validateForm();
    if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }
    const payload: CreateInvoiceDto = {
      ...form, invoiceDate: form.invoiceDate,
      currency: (resolvedCurrency || form.currency).toUpperCase(), status: 'DRAFT',
      exporterName: form.exporterName || exporter.name, exporterAddress: form.exporterAddress || exporter.address,
      exporterContact: form.exporterContact || exporter.contact, exporterEmail: form.exporterEmail || exporter.email || undefined,
      amountInWords: autoAmountInWords, roundOff,
      lineItems: form.lineItems.map((item) => ({ ...item, containerNo: item.marksAndNos, netWeightPerPackage: Number(item.netWeightPerPackage), numberOfBoxes: Number(item.numberOfBoxes), ratePerKg: Number(item.ratePerKg) })),
    };
    try {
      if (isEditing && editingId) {
        await updateMutation.mutateAsync({ id: editingId, dto: payload });
        showToast('Invoice updated', `${payload.invoiceNumber} updated.`, 'success');
      } else {
        await createMutation.mutateAsync(payload);
        showToast('Invoice created', `${payload.invoiceNumber} created.`, 'success');
        if (draftId) {
          const nd = readInvoiceDrafts().filter((i) => i.id !== draftId);
          localStorage.setItem(invoiceDraftListKey, JSON.stringify(nd));
          window.dispatchEvent(new Event('invoice-drafts-updated'));
        }
      }
      closeForm(); setForm(initialInvoice); setErrors({});
    } catch (error) {
      if (error instanceof ApiClientError && error.details) {
        const ne: FieldErrors = {};
        Object.entries(error.details).forEach(([key, msgs]) => { if (msgs.length > 0) ne[key] = msgs[0] ?? 'Invalid value'; });
        if (Object.keys(ne).length > 0) setErrors(ne);
      }
      const message = error instanceof Error ? error.message : 'Please try again.';
      setSubmitError(message);
      showToast('Unable to save invoice', message, 'error');
    }
  };

  if (!isFormOpen) return null;

  const lockBtn = (locked: boolean, onToggle: () => void) => (
    <button
      onClick={onToggle}
      className={[
        'inline-flex items-center gap-1.5 text-[11px] border rounded-md px-2 py-1 transition-colors',
        locked ? 'bg-muted border-border text-muted-foreground' : 'bg-emerald-50 border-emerald-200 text-emerald-700',
      ].join(' ')}
    >
      {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
      {locked ? 'Locked' : 'Unlocked'}
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background w-full max-w-7xl max-h-[94vh] rounded-lg shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-center p-3 border-b shrink-0">
          <h2 className="text-base font-semibold">{isEditing ? `Edit Invoice — ${invoice?.invoiceNumber ?? ''}` : draftId ? 'Edit Draft Invoice' : 'New Invoice'}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {submitError ? <div className="text-xs text-destructive bg-destructive/5 border border-destructive/30 rounded-md px-3 py-2">{submitError}</div> : null}

          <Section title="Exporter">
            <div className="flex items-center justify-between mb-2">
              <span />
              {lockBtn(exporterLocked, () => setExporterLocked((p) => !p))}
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
              <LabeledInput label="Name" disabled={exporterLocked} value={exporter.name} onChange={(v) => setExporter((p) => ({ ...p, name: v }))} />
              <LabeledInput label="Address" disabled={exporterLocked} value={exporter.address} onChange={(v) => setExporter((p) => ({ ...p, address: v }))} />
              <LabeledInput label="Contact" disabled={exporterLocked} value={exporter.contact} onChange={(v) => setExporter((p) => ({ ...p, contact: v }))} />
              <LabeledInput label="Email" disabled={exporterLocked} value={exporter.email ?? ''} onChange={(v) => setExporter((p) => ({ ...p, email: v }))} />
            </div>
            <button onClick={saveExporter} className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:opacity-90">
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          </Section>

          <Section title="Importer">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
              <StatReadOnly label="Name" value={selectedImporter?.name ?? '-'} />
              <StatReadOnly label="Address" value={selectedImporter?.address ?? '-'} />
              <StatReadOnly label="Contact" value={selectedImporter?.contact ?? '-'} />
              <StatReadOnly label="Email" value={selectedImporter?.email ?? '-'} />
            </div>
          </Section>

          <Section title="Invoice Details">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Invoice No" value={form.invoiceNumber} error={errors.invoiceNumber} onChange={(v) => { clearFieldError('invoiceNumber'); setForm((p) => ({ ...p, invoiceNumber: v })); }} />
                <DateField label="Invoice Date" value={toDateInput(form.invoiceDate)} error={errors.invoiceDate} onChange={(v) => { clearFieldError('invoiceDate'); setForm((p) => ({ ...p, invoiceDate: toIsoDate(v) })); }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Exporter's Ref." value={form.exportersRef ?? ''} error={errors.exportersRef} onChange={(v) => { clearFieldError('exportersRef'); setForm((p) => ({ ...p, exportersRef: v })); }} />
                <Field label="Buyer's Order No. & Date" value={buyerOrderNoAndDate} onChange={setBuyerOrderNoAndDate} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Importer</label>
                  <select value={form.importerId} onChange={(e) => applyImporterDefaults(e.target.value)} className="input">
                    <option value="">Select importer</option>
                    {importers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  {errors.importerId ? <p className="err">{errors.importerId}</p> : null}
                </div>
                <Field label="Buyer (If other than consignee :" value={form.buyerName ?? ''} onChange={(v) => setForm((p) => ({ ...p, buyerName: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Other Reference(s)" value={form.otherReferences ?? ''} error={errors.otherReferences} onChange={(v) => { clearFieldError('otherReferences'); setForm((p) => ({ ...p, otherReferences: v })); }} />
                <Field label="AWB NO" value={form.awbNumber ?? ''} error={errors.awbNumber} onChange={(v) => { clearFieldError('awbNumber'); setForm((p) => ({ ...p, awbNumber: v })); }} />
              </div>
            </div>
          </Section>

          <Section title="Shipping Details">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Field label="Pre-Carriage by" value={form.preCarriageBy ?? ''} error={errors.preCarriageBy} onChange={(v) => { clearFieldError('preCarriageBy'); setForm((p) => ({ ...p, preCarriageBy: v })); }} />
                <Field label="Place of Receipt by Pre-Carrier" value={form.placeOfReceiptByPreCarrier ?? ''} error={errors.placeOfReceiptByPreCarrier} onChange={(v) => { clearFieldError('placeOfReceiptByPreCarrier'); setForm((p) => ({ ...p, placeOfReceiptByPreCarrier: v })); }} />
                <Field label="Vessel Flight No." value={form.vesselFlightNo ?? ''} error={errors.vesselFlightNo} onChange={(v) => { clearFieldError('vesselFlightNo'); setForm((p) => ({ ...p, vesselFlightNo: v })); }} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Port of Loading" value={form.portOfLoading ?? ''} error={errors.portOfLoading} onChange={(v) => { clearFieldError('portOfLoading'); setForm((p) => ({ ...p, portOfLoading: v })); }} />
                <Field label="Port of Discharge" value={form.portOfDischarge ?? ''} error={errors.portOfDischarge} onChange={(v) => { clearFieldError('portOfDischarge'); setForm((p) => ({ ...p, portOfDischarge: v })); }} />
                <Field label="Final Destination" value={form.finalDestination ?? ''} error={errors.finalDestination} onChange={(v) => { clearFieldError('finalDestination'); setForm((p) => ({ ...p, finalDestination: v })); }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Country of Origin" value={form.countryOfOrigin ?? ''} error={errors.countryOfOrigin} onChange={(v) => { clearFieldError('countryOfOrigin'); setForm((p) => ({ ...p, countryOfOrigin: v })); }} />
                <Field label="Country of Destination" value={form.countryOfDestination ?? ''} error={errors.countryOfDestination} onChange={(v) => { clearFieldError('countryOfDestination'); setForm((p) => ({ ...p, countryOfDestination: v })); }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Description of Goods" value={form.descriptionOfGoods ?? ''} error={errors.descriptionOfGoods} onChange={(v) => { clearFieldError('descriptionOfGoods'); setForm((p) => ({ ...p, descriptionOfGoods: v })); }} />
                <Field label="HS Code" value={form.hsCode ?? ''} error={errors.hsCode} onChange={(v) => { clearFieldError('hsCode'); setForm((p) => ({ ...p, hsCode: v })); }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Terms of Delivery" value={form.termsOfDelivery ?? ''} error={errors.termsOfDelivery} onChange={(v) => { clearFieldError('termsOfDelivery'); setForm((p) => ({ ...p, termsOfDelivery: v })); }} />
                <Field label="Terms of Payment" value={form.termsOfPayment ?? ''} error={errors.termsOfPayment} onChange={(v) => { clearFieldError('termsOfPayment'); setForm((p) => ({ ...p, termsOfPayment: v })); }} />
              </div>
            </div>
          </Section>

          <Section title="Product Details">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => setForm((p) => ({ ...p, lineItems: [...p.lineItems, { marksAndNos: '', containerNo: '', descriptionOfGoods: '', netWeightPerPackage: 0, numberOfBoxes: 0, ratePerKg: 0 }] }))}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-slate-900 to-slate-700 text-white hover:from-slate-800 hover:to-slate-600 shadow-sm transition-all text-xs font-semibold border border-slate-800/20"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
                <div className="overflow-x-auto border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left p-2 whitespace-nowrap">Marks & Nos / Container No.</th>
                        <th className="text-left p-2 whitespace-nowrap">Description of Goods</th>
                        <th className="text-left p-2"><span className="block">NETT WT PER</span><span className="block">PACKAGES</span></th>
                        <th className="text-left p-2">NO OF BOXES</th>
                        <th className="text-left p-2"><span className="block">TOTAL</span><span className="block">NETT WT KGS</span></th>
                        <th className="text-left p-2"><span className="block">RATE PER</span><span className="block">KGS</span></th>
                        <th className="text-left p-2">TOTAL PER BOX</th>
                        <th className="text-left p-2"><span className="block">Amount</span><span className="block">({selectedImporter?.currency ?? form.currency})</span></th>
                        <th className="p-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.lineItems.map((item, index) => (
                        <tr key={`line-${index}`} className="border-t align-top">
                          <td className="p-2 min-w-[200px]">
                            <input value={item.marksAndNos ?? ''} onChange={(e) => { clearFieldError(`lineItems.${index}.marksAndNos`); updateLine(index, { marksAndNos: e.target.value, containerNo: e.target.value }); }} placeholder="Marks & Nos / Container No" className="w-full border rounded px-2 py-1 text-xs" />
                            {errors[`lineItems.${index}.marksAndNos`] ? <p className="err">{errors[`lineItems.${index}.marksAndNos`]}</p> : null}
                          </td>
                          <td className="p-2 min-w-[160px]">
                            <input value={item.descriptionOfGoods} onChange={(e) => { clearFieldError(`lineItems.${index}.descriptionOfGoods`); updateLine(index, { descriptionOfGoods: e.target.value }); }} className="w-full border rounded px-2 py-1 text-xs" />
                            {errors[`lineItems.${index}.descriptionOfGoods`] ? <p className="err">{errors[`lineItems.${index}.descriptionOfGoods`]}</p> : null}
                          </td>
                          <td className="p-2 min-w-[110px]">
                            <input type="number" step="0.01" value={item.netWeightPerPackage} onChange={(e) => { clearFieldError(`lineItems.${index}.netWeightPerPackage`); updateLine(index, { netWeightPerPackage: parseNumber(e.target.value) }); }} className="w-full border rounded px-2 py-1 text-xs" />
                            {errors[`lineItems.${index}.netWeightPerPackage`] ? <p className="err">{errors[`lineItems.${index}.netWeightPerPackage`]}</p> : null}
                          </td>
                          <td className="p-2 min-w-[90px]">
                            <input type="number" step="1" value={item.numberOfBoxes} onChange={(e) => { clearFieldError(`lineItems.${index}.numberOfBoxes`); updateLine(index, { numberOfBoxes: parseNumber(e.target.value) }); }} className="w-full border rounded px-2 py-1 text-xs" />
                            {errors[`lineItems.${index}.numberOfBoxes`] ? <p className="err">{errors[`lineItems.${index}.numberOfBoxes`]}</p> : null}
                          </td>
                          <td className="p-2 min-w-[110px] whitespace-nowrap">{lineDetails[index]?.totalNetWeight.toFixed(2)} KGS</td>
                          <td className="p-2 min-w-[110px]">
                            <input type="number" step="0.01" value={item.ratePerKg} onChange={(e) => { clearFieldError(`lineItems.${index}.ratePerKg`); updateLine(index, { ratePerKg: parseNumber(e.target.value) }); }} className="w-full border rounded px-2 py-1 text-xs" />
                            {errors[`lineItems.${index}.ratePerKg`] ? <p className="err">{errors[`lineItems.${index}.ratePerKg`]}</p> : null}
                          </td>
                          <td className="p-2 min-w-[110px] whitespace-nowrap">{selectedImporter?.currency ?? form.currency} {lineDetails[index]?.totalPerBox.toFixed(2)}</td>
                          <td className="p-2 min-w-[110px] whitespace-nowrap">{selectedImporter?.currency ?? form.currency} {lineDetails[index]?.amount.toFixed(2)}</td>
                          <td className="p-2">
                            {form.lineItems.length > 1 ? (
                              <button onClick={() => removeLine(index)} className="p-1 hover:bg-destructive/10 rounded-md"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 border rounded-md p-3">
                {/* Left column */}
                <div>
                  <label className="label">No of Pckgs</label>
                  <input readOnly value={String(totalBoxes)} className="w-16 border rounded-md px-2 py-1 text-xs bg-muted/40 text-center" />
                </div>
                <div>
                  <label className="label">SUB TOTAL</label>
                  <input readOnly value={`${selectedImporter?.currency ?? form.currency} ${subTotal.toFixed(2)}`} className="input bg-muted/40" />
                </div>

                <div>
                  <label className="label">TOTAL NETT WT</label>
                  <input readOnly value={`${totalNetWeight.toFixed(2)} KGS`} className="input bg-muted/40" />
                </div>
                <div>
                  <label className="label">ROUND OFF</label>
                  <input value={String(form.roundOff ?? 0)} onChange={(e) => setForm((p) => ({ ...p, roundOff: parseNumber(e.target.value) }))} className="input" />
                </div>

                <div>
                  <label className="label">TOTAL GROSS WT</label>
                  <div className="relative">
                    <input
                      value={form.totalGrossWeight !== undefined ? String(form.totalGrossWeight) : ''}
                      onChange={(e) => setForm((p) => ({ ...p, totalGrossWeight: e.target.value ? parseNumber(e.target.value) : undefined }))}
                      className="input pr-9"
                    />
                    {form.totalGrossWeight !== undefined && String(form.totalGrossWeight) !== '' ? (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">KGS</span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <label className="label">Total</label>
                  <input readOnly value={`${selectedImporter?.currency ?? form.currency} ${total.toFixed(2)}`} className="input bg-muted/40" />
                </div>

                <div className="col-span-2">
                  <label className="label">Amount in words ({selectedImporter?.currency ?? form.currency})</label>
                  <input readOnly value={form.amountInWords ?? ''} className="input bg-muted/40" />
                </div>
              </div>
            </div>
          </Section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <Section title="Bank Detail">
                <div className="flex items-center justify-between mb-2">
                  <span />
                  {lockBtn(isBankLocked, () => setIsBankLocked((p) => !p))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <LabeledInput label="BANK NAME" disabled={isBankLocked} value={bankDetails.bankName} onChange={(v) => setBankDetails((p) => ({ ...p, bankName: v }))} />
                  <LabeledInput label="ACCOUNT NUMBER" disabled={isBankLocked} value={bankDetails.accountNumber} onChange={(v) => setBankDetails((p) => ({ ...p, accountNumber: v }))} />
                  <LabeledInput label="IFSC CODE" disabled={isBankLocked} value={bankDetails.ifscCode} onChange={(v) => setBankDetails((p) => ({ ...p, ifscCode: v }))} />
                  <LabeledInput label="SWIFT CODE" disabled={isBankLocked} value={bankDetails.swiftCode} onChange={(v) => setBankDetails((p) => ({ ...p, swiftCode: v }))} />
                </div>
                <button onClick={saveBankDetails} className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:opacity-90">
                  <Save className="h-3.5 w-3.5" /> Save
                </button>
              </Section>

              <Section title="Declaration">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We declare that this Invoice shows the actual price of the goods described and that all particulars are true and correct.
                </p>
              </Section>
            </div>

            <Section title="Sign & Stamp">
              <div className="flex items-center justify-between mb-2">
                <span />
                {lockBtn(isSignLocked, () => setIsSignLocked((p) => !p))}
              </div>
              <div className="border rounded-md p-2 flex items-center justify-center bg-muted/10 h-28">
                <img src={signImage} alt="Invoice signature" className="max-h-24 w-auto object-contain" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" disabled={isSignLocked} onChange={handleSignUpload} className="hidden" />
                <button
                  disabled={isSignLocked}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-md hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Upload className="h-3.5 w-3.5" />
                </button>
                <button onClick={saveSignImage} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:opacity-90">
                  <Save className="h-3.5 w-3.5" /> Save
                </button>
              </div>
            </Section>
          </div>
        </div>

        <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur-sm p-3 shrink-0">
          <div className="flex items-center justify-end gap-2">
            <button onClick={closeForm} className="px-3 py-1.5 text-xs border rounded-md hover:bg-accent">Cancel</button>
            <button onClick={saveDraft} className="px-3 py-1.5 text-xs border rounded-md hover:bg-accent">Save Draft</button>
            <button onClick={submitInvoice} disabled={isPending} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50">
              {isEditing ? 'Save Invoice' : 'Create Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  , document.body);

  function updateLine(index: number, patch: Partial<CreateInvoiceDto['lineItems'][number]>) {
    setForm((p) => ({ ...p, lineItems: p.lineItems.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));
  }
  function removeLine(index: number) {
    setForm((p) => ({ ...p, lineItems: p.lineItems.filter((_, i) => i !== index) }));
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-md p-3 space-y-2">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {children}
    </div>
  );
}

interface FieldProps { label: string; value: string; onChange: (v: string) => void; readOnly?: boolean; error?: string | undefined; }
function Field({ label, value, onChange, readOnly, error }: FieldProps) {
  return (
    <div>
      <label className="label">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} className="input read-only:bg-muted/40" />
      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}

interface DateFieldProps { label: string; value: string; onChange: (v: string) => void; error?: string | undefined; }
function DateField({ label, value, onChange, error }: DateFieldProps) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="input" />
      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}

function StatReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input value={value} readOnly className="input bg-muted/40" />
    </div>
  );
}

function LabeledInput({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className="input disabled:bg-muted/40" />
    </div>
  );
}
