import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, ExternalLink, FileText, Landmark, PenLine, Package, Plus, ScrollText, Ship, Trash2, Users, type LucideIcon } from 'lucide-react';
import { DEFAULT_DECLARATION, type CreateInvoiceDto } from 'shared';
import { useClients } from '@/features/clients/hooks/useClients';
import { useCreateInvoice, useInvoice, useUpdateInvoice } from '../hooks/useInvoices';
import { useExporterProfiles } from '../hooks/useExporterProfiles';
import { useBankProfiles } from '../hooks/useBankProfiles';
import { useDeclarationProfiles } from '../hooks/useDeclarationProfiles';
import ProductPicker from './ProductPicker';
import type { Product } from '../services/productService';
import { useDeleteDraft, useSaveDraft } from '@/features/drafts/hooks/useDrafts';
import { useSignProfiles } from '../hooks/useSignProfiles';
import type { SignProfile } from '../services/signService';
import { bankLabel } from '@/features/exporter/components/BankProfilesSection';
import type { BankProfile } from '../services/bankService';
import type { ExporterProfile } from '../services/exporterService';
import SearchCombobox from '@/components/ui/SearchCombobox';
import DatePicker, { formatYmd } from '@/components/ui/DatePicker';
import NumberInput from '@/components/ui/NumberInput';
import { fitRatesToTotal, parseAmount } from '../utils/targetTotal';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/format';
import { AirportSelect, CountrySelect, CurrencySelect } from '@/components/ui/PlacePickers';
import { useInvoiceStore } from '../store/invoiceStore';
import { useToast } from '@/components/ui/toast';
import { ApiClientError } from '@/services/api';


type FieldErrors = Record<string, string>;

const initialInvoice: CreateInvoiceDto = {
  importerId: '',
  invoiceNumber: '',
  invoiceDate: new Date().toISOString(),
  exportersRef: '',
  otherReferences: '',
  awbNumber: '',
  buyersOrder: '',
  preCarriageBy: 'TRUCK BY ROAD',
  placeOfReceiptByPreCarrier: 'N/A',
  vesselFlightNo: 'By Air',
  loadingLocationId: undefined,
  landingLocationId: undefined,
  portOfLoading: '',
  portOfDischarge: '',
  finalDestination: '',
  buyerName: '',
  importerName: '',
  importerAddress: '',
  importerContact: '',
  importerEmail: '',
  countryOfOrigin: '',
  countryOfDestination: '',
  descriptionOfGoods: 'FRUITS & VEGETABLES',
  hsCode: '709',
  termsOfDelivery: 'CNF',
  termsOfPayment: 'ADVANCE',
  currency: '',
  exporterName: '',
  exporterAddress: '',
  exporterContact: '',
  exporterEmail: '',
  bankName: '',
  bankAccountNumber: '',
  bankIfscCode: '',
  bankSwiftCode: '',
  lineItems: [
    { marksAndNos: '', containerNo: '', descriptionOfGoods: '', netWeightPerPackage: 0, numberOfBoxes: 0, ratePerKg: 0 },
  ],
  totalGrossWeight: undefined,
  roundOff: 0,
  amountInWords: '',
  notes: '',
  declaration: DEFAULT_DECLARATION,
  signName: '',
  signImage: '',
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

/** Terms of Delivery are always "CNF" followed by the final destination's code (e.g. "CNF YYZ"). */
export const cnfTerms = (finalDestination?: string | null) => `CNF${finalDestination?.trim() ? ` ${finalDestination.trim().toUpperCase()}` : ''}`;

const signFields = (p: SignProfile) => ({ signName: p.name, signImage: p.image });

const bankFields = (p: BankProfile) => ({ bankName: p.bankName, bankAccountNumber: p.accountNumber, bankIfscCode: p.ifscCode ?? '', bankSwiftCode: p.swiftCode ?? '' });

const exporterFields = (p: ExporterProfile) => ({ exporterName: p.name, exporterAddress: p.address, exporterContact: p.contact, exporterEmail: p.email ?? '' });

export default function InvoiceForm() {
  const { isFormOpen, editingId, draftId, draftData, closeForm } = useInvoiceStore();
  const { data: invoiceData } = useInvoice(editingId ?? '');
  const { data: importersData } = useClients({ limit: 100, sort: 'name' });
  const { data: exporterData } = useExporterProfiles();
  const { data: signData } = useSignProfiles();
  // "Not needed" seals & signs are hidden from new invoices (an edited invoice keeps its own copy)
  const signProfiles = (signData?.data ?? []).filter((p) => p.isActive);
  const { data: bankData } = useBankProfiles();
  // "Not needed" accounts are hidden from new invoices (an edited invoice keeps its own copy)
  const bankProfiles = (bankData?.data ?? []).filter((p) => p.isActive);
  const { data: declarationData } = useDeclarationProfiles();
  const declarationProfiles = (declarationData?.data ?? []).filter((p) => p.isActive);
  const allExporterProfiles = exporterData?.data ?? [];
  // "Not needed" profiles are hidden from new invoices (an edited invoice's own copy is unaffected)
  const exporterProfiles = allExporterProfiles.filter((p) => p.isActive);
  const saveDraftMutation = useSaveDraft<CreateInvoiceDto>('invoice');
  const deleteDraftMutation = useDeleteDraft('invoice');
  const createMutation = useCreateInvoice();
  const updateMutation = useUpdateInvoice();
  const { showToast } = useToast();

  const [form, setForm] = useState<CreateInvoiceDto>(initialInvoice);
  const [exporterProfileId, setExporterProfileId] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bankProfileId, setBankProfileId] = useState('');
  const [signProfileId, setSignProfileId] = useState('');
  const [declarationProfileId, setDeclarationProfileId] = useState('');

  const isEditing = Boolean(editingId);
  const invoice = invoiceData?.data;
  const allImporters = importersData?.data ?? [];
  // "Not needed" importers aren't offered for new invoices; an invoice being edited keeps its own importer selectable.
  const importers = allImporters.filter((i) => i.isActive !== false || i.id === form.importerId);
  const selectedImporter = useMemo(() => importers.find((i) => i.id === form.importerId), [form.importerId, importers]);

  useEffect(() => {
    if (!invoice || !isEditing) return;
    setForm({
      importerId: invoice.importerId, invoiceNumber: invoice.invoiceNumber, invoiceDate: invoice.invoiceDate,
      exportersRef: invoice.exportersRef ?? '', otherReferences: invoice.otherReferences ?? '', awbNumber: invoice.awbNumber ?? '', buyersOrder: invoice.buyersOrder ?? '',
      preCarriageBy: invoice.preCarriageBy ?? 'TRUCK BY ROAD', placeOfReceiptByPreCarrier: invoice.placeOfReceiptByPreCarrier ?? 'N/A',
      vesselFlightNo: invoice.vesselFlightNo ?? 'By Air', loadingLocationId: invoice.loadingLocationId ?? undefined,
      landingLocationId: invoice.landingLocationId ?? undefined, portOfLoading: invoice.portOfLoading ?? '',
      portOfDischarge: invoice.portOfDischarge ?? '', finalDestination: invoice.finalDestination ?? '',
      buyerName: invoice.buyerName ?? '',
      // the invoice's own copy of the importer's details, not the importer's current ones
      importerName: invoice.importerName ?? invoice.importer.name, importerAddress: invoice.importerAddress ?? '',
      importerContact: invoice.importerContact ?? '', importerEmail: invoice.importerEmail ?? '',
      countryOfOrigin: invoice.countryOfOrigin ?? '', countryOfDestination: invoice.countryOfDestination ?? '',
      descriptionOfGoods: invoice.descriptionOfGoods ?? 'FRUITS & VEGETABLES', hsCode: invoice.hsCode ?? '709',
      termsOfDelivery: invoice.termsOfDelivery ?? cnfTerms(invoice.finalDestination), termsOfPayment: invoice.termsOfPayment ?? 'ADVANCE',
      currency: invoice.currency, exporterName: invoice.exporterName ?? '', exporterAddress: invoice.exporterAddress ?? '',
      exporterContact: invoice.exporterContact ?? '', exporterEmail: invoice.exporterEmail ?? '',
      bankName: invoice.bankName ?? '', bankAccountNumber: invoice.bankAccountNumber ?? '', bankIfscCode: invoice.bankIfscCode ?? '', bankSwiftCode: invoice.bankSwiftCode ?? '',
      lineItems: invoice.lineItems.map((item) => {
        const combined = item.marksAndNos || item.containerNo || '';
        return { marksAndNos: combined, containerNo: combined, descriptionOfGoods: item.descriptionOfGoods, netWeightPerPackage: Number(item.netWeightPerPackage), numberOfBoxes: item.numberOfBoxes, ratePerKg: Number(item.ratePerKg) };
      }),
      totalGrossWeight: invoice.totalGrossWeight ?? undefined, roundOff: 0,
      amountInWords: invoice.amountInWords ?? '', notes: invoice.notes ?? '', declaration: invoice.declaration ?? DEFAULT_DECLARATION, signName: invoice.signName ?? '', signImage: invoice.signImage ?? '',
    });
  }, [invoice, isEditing]);

  useEffect(() => {
    if (!isFormOpen) { setForm(initialInvoice); setErrors({}); setSubmitError(null); setExporterProfileId(''); setBankProfileId(''); setSignProfileId(''); setDeclarationProfileId(''); return; }
    if (!isEditing && draftData) { setForm(draftData); setErrors({}); setSubmitError(null); }
  }, [isFormOpen, isEditing, draftData]);

  // A NEW invoice starts from the default exporter profile (or the only one). Editing never does this:
  // an existing invoice keeps the exporter details it was saved with.
  useEffect(() => {
    if (!isFormOpen || isEditing || exporterProfiles.length === 0) return;
    const start = exporterProfiles.find((p) => p.isDefault) ?? (exporterProfiles.length === 1 ? exporterProfiles[0] : undefined);
    if (!start) return;
    setForm((prev) => (prev.exporterName || prev.exporterAddress || prev.exporterContact || prev.exporterEmail ? prev : { ...prev, ...exporterFields(start) }));
    setExporterProfileId(start.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFormOpen, isEditing, exporterData]);

  // Same for the bank account: a NEW invoice starts from the default (or only) account.
  useEffect(() => {
    if (!isFormOpen || isEditing || bankProfiles.length === 0) return;
    const start = bankProfiles.find((p) => p.isDefault) ?? (bankProfiles.length === 1 ? bankProfiles[0] : undefined);
    if (!start) return;
    setForm((prev) => (prev.bankName || prev.bankAccountNumber || prev.bankIfscCode || prev.bankSwiftCode ? prev : { ...prev, ...bankFields(start) }));
    setBankProfileId(start.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFormOpen, isEditing, bankData]);

  // And the seal & sign: a NEW invoice starts from the default (or only) one.
  useEffect(() => {
    if (!isFormOpen || isEditing || signProfiles.length === 0) return;
    const start = signProfiles.find((p) => p.isDefault) ?? (signProfiles.length === 1 ? signProfiles[0] : undefined);
    if (!start) return;
    setForm((prev) => (prev.signImage ? prev : { ...prev, ...signFields(start) }));
    setSignProfileId(start.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFormOpen, isEditing, signData]);

  // And the declaration: a NEW invoice starts from the default (or only) one, unless its wording was already changed.
  useEffect(() => {
    if (!isFormOpen || isEditing || declarationProfiles.length === 0) return;
    const start = declarationProfiles.find((p) => p.isDefault) ?? (declarationProfiles.length === 1 ? declarationProfiles[0] : undefined);
    if (!start) return;
    setForm((prev) => (prev.declaration && prev.declaration !== DEFAULT_DECLARATION ? prev : { ...prev, declaration: start.text }));
    setDeclarationProfileId(start.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFormOpen, isEditing, declarationData]);

  const chooseDeclarationProfile = (id: string) => {
    setDeclarationProfileId(id);
    const profile = declarationProfiles.find((p) => p.id === id);
    if (profile) setForm((prev) => ({ ...prev, declaration: profile.text }));
  };

  const chooseSignProfile = (id: string) => {
    setSignProfileId(id);
    const profile = signProfiles.find((p) => p.id === id);
    if (profile) setForm((prev) => ({ ...prev, ...signFields(profile) }));
  };

  const chooseBankProfile = (id: string) => {
    setBankProfileId(id);
    const profile = bankProfiles.find((p) => p.id === id);
    if (profile) setForm((prev) => ({ ...prev, ...bankFields(profile) }));
  };

  const chooseExporterProfile = (id: string) => {
    setExporterProfileId(id);
    const profile = exporterProfiles.find((p) => p.id === id);
    if (profile) {
      clearFieldError('exporterName'); clearFieldError('exporterAddress'); clearFieldError('exporterContact');
      setForm((prev) => ({ ...prev, ...exporterFields(profile) }));
    }
  };

  const [targetText, setTargetText] = useState('');
  const [targetNote, setTargetNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  /** Sets the rate per kg of every product so the invoice adds up to the pasted total. */
  const applyTargetTotal = () => {
    const target = parseAmount(targetText);
    if (!(target > 0)) { setTargetNote({ kind: 'error', text: 'Enter a total above zero.' }); return; }
    const result = fitRatesToTotal(form.lineItems.map((item) => ({ kg: Number(item.netWeightPerPackage) * Number(item.numberOfBoxes), rate: Number(item.ratePerKg) })), target);
    if (!result) { setTargetNote({ kind: 'error', text: 'Enter the boxes and weight of the products first.' }); return; }
    setForm((p) => ({ ...p, lineItems: p.lineItems.map((item, i) => ({ ...item, ratePerKg: result.rates[i]! })) }));
    form.lineItems.forEach((_, i) => clearFieldError(`lineItems.${i}.ratePerKg`));
    setTargetText(formatNumber(target));
    setTargetNote({ kind: 'ok', text: `Rates updated${result.oddIndex >= 0 ? `. Product ${result.oddIndex + 1} has a slightly different rate so the total matches exactly` : ''}. You can fix or rearrange any rate by hand if you want.` });
  };

  const lineDetails = form.lineItems.map((item) => {
    const totalNetWeight = Number(item.netWeightPerPackage) * Number(item.numberOfBoxes);
    const totalPerBox = Number(item.netWeightPerPackage) * Number(item.ratePerKg);
    const amount = totalNetWeight * Number(item.ratePerKg);
    return { totalNetWeight, totalPerBox, amount };
  });

  const totalNetWeight = lineDetails.reduce((s, i) => s + i.totalNetWeight, 0);
  const totalBoxes = form.lineItems.reduce((s, i) => s + Number(i.numberOfBoxes), 0);
  const subTotal = lineDetails.reduce((s, i) => s + i.amount, 0);
  const total = subTotal; // no round off on invoices
  const resolvedCurrency = form.currency;
  const autoAmountInWords = useMemo(() => formatAmountInWords(total, resolvedCurrency || form.currency || 'USD'), [total, resolvedCurrency, form.currency]);

  useEffect(() => { setForm((prev) => ({ ...prev, amountInWords: autoAmountInWords })); }, [autoAmountInWords]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const clearFieldError = (key: string) => setErrors((prev) => { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });

  const applyImporterDefaults = (importerId: string) => {
    clearFieldError('importerId');
    const importer = importers.find((i) => i.id === importerId);
    if (!importer) return;
    const fl = importer.landingLocations[0]; const lo = importer.loadingLocations[0];
    setForm((prev) => ({
      ...prev, importerId, buyerName: importer.buyerName ?? '', currency: importer.currency,
      importerName: importer.name, importerAddress: importer.address ?? '', importerContact: importer.contact ?? '', importerEmail: importer.email ?? '',
      landingLocationId: fl?.id, loadingLocationId: lo?.id,
      portOfDischarge: fl?.portOfDischarge ?? '', finalDestination: fl?.finalDestination ?? '', termsOfDelivery: cnfTerms(fl?.finalDestination), countryOfDestination: fl?.countryOfDestination ?? '',
      portOfLoading: lo?.portOfLoading ?? '', countryOfOrigin: lo?.countryOfOrigin ?? '',
    }));
  };

  // Picking one of the importer's saved locations copies its values into this invoice; they stay editable
  // here and never change the importer.
  const chooseLanding = (id: string) => {
    const loc = selectedImporter?.landingLocations.find((l) => l.id === id);
    if (!loc) return;
    ['portOfDischarge', 'finalDestination', 'countryOfDestination'].forEach(clearFieldError);
    setForm((p) => ({ ...p, landingLocationId: loc.id, portOfDischarge: loc.portOfDischarge, finalDestination: loc.finalDestination, termsOfDelivery: cnfTerms(loc.finalDestination), countryOfDestination: loc.countryOfDestination }));
  };
  const chooseLoading = (id: string) => {
    const loc = selectedImporter?.loadingLocations.find((l) => l.id === id);
    if (!loc) return;
    ['portOfLoading', 'countryOfOrigin'].forEach(clearFieldError);
    setForm((p) => ({ ...p, loadingLocationId: loc.id, portOfLoading: loc.portOfLoading, countryOfOrigin: loc.countryOfOrigin }));
  };

  /** Saves the form as a draft in the database (updating it when this form was opened from a draft). */
  const saveDraft = async () => {
    try {
      await saveDraftMutation.mutateAsync({
        id: draftId,
        // the (large) seal & sign image is not kept in the draft; the default is filled in again when it is reopened
        data: { ...form, signName: '', signImage: '', currency: (resolvedCurrency || form.currency || '').toUpperCase() },
      });
      showToast('Draft saved', 'Invoice draft saved to your account.', 'success');
      closeForm();
    } catch (error) {
      showToast("Couldn't save the draft", error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const validateForm = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!form.importerId) e.importerId = 'Importer is required.';
    if ((form.importerEmail ?? '').trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((form.importerEmail ?? '').trim())) e.importerEmail = 'Enter a valid email address.';
    if (!form.invoiceNumber.trim()) e.invoiceNumber = 'Invoice number is required.';
    if (!form.invoiceDate) e.invoiceDate = 'Invoice date is required.';
    if (!isEditing) {
      if (!(form.exporterName ?? '').trim()) e.exporterName = 'Exporter name is required.';
      if (!(form.exporterAddress ?? '').trim()) e.exporterAddress = 'Exporter address is required.';
      if (!(form.exporterContact ?? '').trim()) e.exporterContact = 'Exporter contact is required.';
    }
    if ((form.exporterEmail ?? '').trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((form.exporterEmail ?? '').trim())) e.exporterEmail = 'Enter a valid email address.';
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
    if (!(form.termsOfPayment ?? '').trim()) e.termsOfPayment = 'Terms of Payment is required.';
    if (!(resolvedCurrency || form.currency).trim()) e.currency = 'Currency is required.';
    if (form.totalGrossWeight !== undefined && form.totalGrossWeight < totalNetWeight) e.totalGrossWeight = `Gross weight can't be less than the total nett weight (${formatNumber(totalNetWeight)} KGS).`;
    form.lineItems.forEach((item, index) => {
      if (!(item.descriptionOfGoods ?? '').trim()) e[`lineItems.${index}.descriptionOfGoods`] = 'Description is required.';
      if (Number(item.netWeightPerPackage) <= 0) e[`lineItems.${index}.netWeightPerPackage`] = 'Must be > 0.';
      if (!Number.isInteger(Number(item.numberOfBoxes)) || Number(item.numberOfBoxes) < 1) e[`lineItems.${index}.numberOfBoxes`] = 'Enter a whole number, 1 or more.';
      if (!(Number(item.ratePerKg) > 0)) e[`lineItems.${index}.ratePerKg`] = 'Must be > 0.';
    });
    return e;
  };

  const submitInvoice = async () => {
    setSubmitError(null);
    const fieldErrors = validateForm();
    if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }
    const payload: CreateInvoiceDto = {
      ...form, invoiceDate: form.invoiceDate,
      currency: (resolvedCurrency || form.currency).toUpperCase(),
      exporterName: form.exporterName?.trim() || undefined, exporterAddress: form.exporterAddress?.trim() || undefined,
      exporterContact: form.exporterContact?.trim() || undefined, exporterEmail: form.exporterEmail?.trim() || undefined,
      declaration: form.declaration?.trim() || DEFAULT_DECLARATION,
      signName: form.signName?.trim() || undefined, signImage: form.signImage || undefined,
      bankName: form.bankName?.trim() || undefined, bankAccountNumber: form.bankAccountNumber?.trim() || undefined,
      bankIfscCode: form.bankIfscCode?.trim() || undefined, bankSwiftCode: form.bankSwiftCode?.trim() || undefined,
      amountInWords: autoAmountInWords, roundOff: 0,
      lineItems: form.lineItems.map((item) => ({ ...item, containerNo: item.marksAndNos, netWeightPerPackage: Number(item.netWeightPerPackage), numberOfBoxes: Number(item.numberOfBoxes), ratePerKg: Number(item.ratePerKg) })),
    };
    try {
      if (isEditing && editingId) {
        await updateMutation.mutateAsync({ id: editingId, dto: payload });
        showToast('Invoice updated', `${payload.invoiceNumber} updated.`, 'success');
      } else {
        await createMutation.mutateAsync(payload);
        showToast('Invoice created', `${payload.invoiceNumber} created.`, 'success');
        if (draftId) deleteDraftMutation.mutate(draftId); // the draft became a real invoice
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

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div className="bg-background w-full max-w-7xl max-h-[96dvh] sm:max-h-[94dvh] rounded-lg shadow-xl flex flex-col overflow-hidden">
        <div className="shrink-0 min-w-0 border-b bg-gradient-to-r from-[hsl(var(--primary)/0.08)] to-[hsl(var(--brand-accent)/0.12)] px-3 py-3 sm:px-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-white"><FileText className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--primary))]">
                  {isEditing ? 'Edit Invoice' : draftId ? 'Edit Draft Invoice' : 'New Invoice'}
                </p>
                <h2 className={cn('truncate text-lg font-bold leading-tight', !form.invoiceNumber.trim() && 'font-medium text-muted-foreground')}>
                  {form.invoiceNumber.trim() || 'Invoice no. not set'}
                </h2>
                <p className="truncate text-xs text-muted-foreground" title={form.importerName ?? ''}>
                  {(form.importerName ?? '').trim() || 'Choose an importer to begin'}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Invoice total</p>
              <p className="text-lg font-bold text-[hsl(var(--brand-accent))]">{form.currency} {formatNumber(total)}</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            {form.invoiceDate ? <span className="rounded-md border bg-background/70 px-2 py-1 text-muted-foreground">{formatYmd(toDateInput(form.invoiceDate))}</span> : null}
            {form.currency ? <span className="rounded-md border bg-background/70 px-2 py-1 font-semibold">{form.currency}</span> : null}
            <span className="rounded-md border bg-background/70 px-2 py-1 text-muted-foreground">{totalBoxes} {totalBoxes === 1 ? 'box' : 'boxes'}</span>
            <span className="rounded-md border bg-background/70 px-2 py-1 text-muted-foreground">{formatNumber(totalNetWeight)} KGS nett</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 bg-gradient-to-b from-[hsl(var(--primary)/0.07)] via-[hsl(var(--primary)/0.02)] to-[hsl(var(--brand-accent)/0.10)]">
          {submitError ? <div className="text-xs text-destructive bg-destructive/5 border border-destructive/30 rounded-md px-3 py-2">{submitError}</div> : null}

          <Section title="Exporter" icon={Building2} tone="teal" action={<ManageLink to="/exporter" label="Manage exporter profiles" />}>
            <div className="max-w-sm">
              <label className="label">Exporter profile</label>
              <SearchCombobox
                ariaLabel="Exporter profile"
                value={exporterProfileId}
                onChange={chooseExporterProfile}
                options={exporterProfiles.map((p) => ({ value: p.id, label: p.name, description: p.isDefault ? 'Default' : p.contact }))}
                placeholder={isEditing ? "Keep this invoice's exporter" : exporterProfiles.length ? 'Select an exporter profile' : 'No profiles yet'}
                searchPlaceholder="Search exporter profiles…"
                labelClassName="w-auto max-w-[65%] truncate"
                className="input"
              />
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
              <LabeledInput label="Name" value={form.exporterName ?? ''} error={errors.exporterName} onChange={(v) => { clearFieldError('exporterName'); setForm((p) => ({ ...p, exporterName: v })); }} />
              <LabeledInput label="Address" value={form.exporterAddress ?? ''} error={errors.exporterAddress} onChange={(v) => { clearFieldError('exporterAddress'); setForm((p) => ({ ...p, exporterAddress: v })); }} />
              <LabeledInput label="Contact" value={form.exporterContact ?? ''} error={errors.exporterContact} onChange={(v) => { clearFieldError('exporterContact'); setForm((p) => ({ ...p, exporterContact: v })); }} />
              <LabeledInput label="Email" value={form.exporterEmail ?? ''} error={errors.exporterEmail} onChange={(v) => { clearFieldError('exporterEmail'); setForm((p) => ({ ...p, exporterEmail: v })); }} />
            </div>
            <p className="text-[11px] text-muted-foreground">This invoice keeps its own copy of these details. Changing them here does not change the saved profile.</p>
          </Section>

          <Section title="Importer" icon={Users} tone="teal" action={<ManageLink to="/importers" label="Manage importers" />}>
            <div className="max-w-sm">
              <label className="label">Importer</label>
              <SearchCombobox
                ariaLabel="Importer"
                value={form.importerId}
                onChange={applyImporterDefaults}
                options={[
                  ...(form.importerId && !importers.some((i) => i.id === form.importerId) ? [{ value: form.importerId, label: form.importerName || 'Current importer' }] : []),
                  ...importers.map((i) => ({ value: i.id, label: i.name, description: i.currency })),
                ]}
                placeholder="Select importer"
                searchPlaceholder="Search importers…"
                labelClassName="w-auto max-w-[65%] truncate"
                hasError={!!errors.importerId}
                className="input"
              />
              {errors.importerId ? <p className="err">{errors.importerId}</p> : null}
            </div>
            {/* Filled from the importer you pick (like the ports below) and saved with this invoice: editing the importer later never changes it. */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
              <LabeledInput label="Name" value={form.importerName ?? ''} onChange={(v) => setForm((p) => ({ ...p, importerName: v }))} />
              <LabeledInput label="Address" value={form.importerAddress ?? ''} onChange={(v) => setForm((p) => ({ ...p, importerAddress: v }))} />
              <LabeledInput label="Contact" value={form.importerContact ?? ''} onChange={(v) => setForm((p) => ({ ...p, importerContact: v }))} />
              <LabeledInput label="Email" value={form.importerEmail ?? ''} error={errors.importerEmail} onChange={(v) => { clearFieldError('importerEmail'); setForm((p) => ({ ...p, importerEmail: v })); }} />
            </div>
          </Section>

          <Section title="Invoice Details" icon={FileText} tone="teal">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Invoice No" value={form.invoiceNumber} error={errors.invoiceNumber} onChange={(v) => { clearFieldError('invoiceNumber'); setForm((p) => ({ ...p, invoiceNumber: v })); }} />
                <div>
                  <label className="label">Invoice Date</label>
                  <DatePicker ariaLabel="Invoice Date" value={toDateInput(form.invoiceDate)} hasError={!!errors.invoiceDate} onChange={(v) => { clearFieldError('invoiceDate'); setForm((p) => ({ ...p, invoiceDate: toIsoDate(v) })); }} />
                  {errors.invoiceDate ? <p className="err">{errors.invoiceDate}</p> : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Exporter's Ref." value={form.exportersRef ?? ''} error={errors.exportersRef} onChange={(v) => { clearFieldError('exportersRef'); setForm((p) => ({ ...p, exportersRef: v })); }} />
                <Field label="Buyer's Order No. & Date" value={form.buyersOrder ?? ''} onChange={(v) => setForm((p) => ({ ...p, buyersOrder: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Other Reference(s)" value={form.otherReferences ?? ''} error={errors.otherReferences} onChange={(v) => { clearFieldError('otherReferences'); setForm((p) => ({ ...p, otherReferences: v })); }} />
                <Field label="Buyer (If other than consignee)" value={form.buyerName ?? ''} onChange={(v) => setForm((p) => ({ ...p, buyerName: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="AWB NO" value={form.awbNumber ?? ''} error={errors.awbNumber} onChange={(v) => { clearFieldError('awbNumber'); setForm((p) => ({ ...p, awbNumber: v })); }} />
                <div className="rounded-md border border-[hsl(var(--brand-accent))]/30 border-l-4 border-l-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent))]/5 px-2 pb-2">
                  <CurrencySelect variant="form" label="Currency" value={form.currency} error={errors.currency} onChange={(v) => { clearFieldError('currency'); setForm((p) => ({ ...p, currency: v })); }} />
                </div>
              </div>
            </div>
          </Section>

          <Section title="Shipping Details" icon={Ship} tone="orange">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Field label="Pre-Carriage by" value={form.preCarriageBy ?? ''} error={errors.preCarriageBy} onChange={(v) => { clearFieldError('preCarriageBy'); setForm((p) => ({ ...p, preCarriageBy: v })); }} />
                <Field label="Place of Receipt by Pre-Carrier" value={form.placeOfReceiptByPreCarrier ?? ''} error={errors.placeOfReceiptByPreCarrier} onChange={(v) => { clearFieldError('placeOfReceiptByPreCarrier'); setForm((p) => ({ ...p, placeOfReceiptByPreCarrier: v })); }} />
                <Field label="Vessel Flight No." value={form.vesselFlightNo ?? ''} error={errors.vesselFlightNo} onChange={(v) => { clearFieldError('vesselFlightNo'); setForm((p) => ({ ...p, vesselFlightNo: v })); }} />
              </div>
              <LocationGroup title="Loading" hint="Origin">
                <LocationPicker label="Loading location" ariaLabel="Loading location" value={form.loadingLocationId ?? ''} onChange={chooseLoading} importerChosen={!!form.importerId}
                  options={(selectedImporter?.loadingLocations ?? []).map((l) => ({ value: l.id, label: l.name || l.portOfLoading, description: [l.portOfLoading, l.countryOfOrigin].filter(Boolean).join(' · ') }))} />
                <div className="grid grid-cols-2 gap-2">
                  <AirportSelect variant="form" label="Port of Loading" value={form.portOfLoading ?? ''} error={errors.portOfLoading} onChange={(v) => { clearFieldError('portOfLoading'); setForm((p) => ({ ...p, portOfLoading: v })); }} />
                  <CountrySelect variant="form" label="Country of Origin" value={form.countryOfOrigin ?? ''} error={errors.countryOfOrigin} onChange={(v) => { clearFieldError('countryOfOrigin'); setForm((p) => ({ ...p, countryOfOrigin: v })); }} />
                </div>
              </LocationGroup>
              <LocationGroup title="Landing" hint="Destination">
                <LocationPicker label="Landing location" ariaLabel="Landing location" value={form.landingLocationId ?? ''} onChange={chooseLanding} importerChosen={!!form.importerId}
                  options={(selectedImporter?.landingLocations ?? []).map((l) => ({ value: l.id, label: l.name || l.portOfDischarge, description: [l.portOfDischarge, l.finalDestination, l.countryOfDestination].filter(Boolean).join(' · ') }))} />
                <div className="grid grid-cols-3 gap-2">
                  <AirportSelect variant="form" label="Port of Discharge" value={form.portOfDischarge ?? ''} error={errors.portOfDischarge} onChange={(v) => { clearFieldError('portOfDischarge'); setForm((p) => ({ ...p, portOfDischarge: v })); }} />
                  <AirportSelect variant="form" label="Final Destination" value={form.finalDestination ?? ''} error={errors.finalDestination} onChange={(v) => { clearFieldError('finalDestination'); setForm((p) => ({ ...p, finalDestination: v, termsOfDelivery: cnfTerms(v) })); }} />
                  <CountrySelect variant="form" label="Country of Destination" value={form.countryOfDestination ?? ''} error={errors.countryOfDestination} onChange={(v) => { clearFieldError('countryOfDestination'); setForm((p) => ({ ...p, countryOfDestination: v })); }} />
                </div>
              </LocationGroup>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Description of Goods" value={form.descriptionOfGoods ?? ''} error={errors.descriptionOfGoods} onChange={(v) => { clearFieldError('descriptionOfGoods'); setForm((p) => ({ ...p, descriptionOfGoods: v })); }} />
                <Field label="HS Code" value={form.hsCode ?? ''} error={errors.hsCode} onChange={(v) => { clearFieldError('hsCode'); setForm((p) => ({ ...p, hsCode: v })); }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Terms of Delivery (CNF + destination code)" readOnly value={form.termsOfDelivery ?? ''} onChange={() => {}} />
                <Field label="Terms of Payment" value={form.termsOfPayment ?? ''} error={errors.termsOfPayment} onChange={(v) => { clearFieldError('termsOfPayment'); setForm((p) => ({ ...p, termsOfPayment: v })); }} />
              </div>
            </div>
          </Section>

          <Section title="Product Details" icon={Package} tone="orange">
            <div className="space-y-4">
              <div className="rounded-lg border border-[hsl(var(--brand-accent))]/30 bg-[hsl(var(--brand-accent))]/5 p-3">
                <label className="label" htmlFor="target-total">Target total{form.currency ? ` (${form.currency})` : ''}</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="target-total"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="Paste the invoice total"
                    value={targetText}
                    onChange={(e) => { setTargetText(e.target.value); setTargetNote(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyTargetTotal(); } }}
                    className="input min-w-[180px] flex-1"
                  />
                  <button type="button" onClick={applyTargetTotal} className="rounded-lg border bg-background px-3 py-2 text-sm font-semibold hover:bg-accent">Update rates</button>
                </div>
                <p className={cn('mt-1.5 text-xs', targetNote?.kind === 'error' ? 'text-destructive' : 'text-muted-foreground')} aria-live="polite">
                  {targetNote?.text ?? 'Sets the rate per kg of each product so the invoice adds up to this total. Boxes and weights stay as they are.'}
                </p>
              </div>
              <div className="space-y-2">
                {/* Phones: one stacked card per product */}
                <div className="space-y-3 sm:hidden">
                  {form.lineItems.map((item, index) => (
                    <div key={`card-${index}`} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold">Product {index + 1}</p>
                        {form.lineItems.length > 1 ? (
                          <button type="button" aria-label={`Remove product ${index + 1}`} onClick={() => removeLine(index)} className="p-1 hover:bg-destructive/10 rounded-md"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                        ) : null}
                      </div>
                      <div><label className="label">Marks & Nos / Container No.</label>{lineField(index, 'marks')}</div>
                      <div><label className="label">Description of Goods</label>{lineField(index, 'description')}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="label">Nett wt per package</label>{lineField(index, 'weight')}</div>
                        <div><label className="label">No of boxes</label>{lineField(index, 'boxes')}</div>
                        <div><label className="label">Rate per KG</label>{lineField(index, 'rate')}</div>
                        <div><label className="label">Total nett wt</label><p className="text-sm py-1.5">{formatNumber(lineDetails[index]?.totalNetWeight ?? 0)} KGS</p></div>
                      </div>
                      <div className="flex justify-between border-t pt-2 text-sm">
                        <span className="text-muted-foreground">Total per box: {form.currency} {formatNumber(lineDetails[index]?.totalPerBox ?? 0)}</span>
                        <span className="font-semibold">{form.currency} {formatNumber(lineDetails[index]?.amount ?? 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Larger screens: table */}
                <div className="hidden sm:block overflow-x-auto border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left p-2 whitespace-nowrap">Marks & Nos / Container No.</th>
                        <th className="text-left p-2 whitespace-nowrap">Description of Goods</th>
                        <th className="text-left p-2"><span className="block">NETT WT PER</span><span className="block">PACKAGES</span></th>
                        <th className="text-left p-2">NO OF BOXES</th>
                        <th className="text-left p-2"><span className="block">TOTAL</span><span className="block">NETT WT KGS</span></th>
                        <th className="text-left p-2"><span className="block">RATE PER</span><span className="block">KGS</span></th>
                        <th className="text-left p-2"><span className="block">TOTAL PER</span><span className="block">BOX</span></th>
                        <th className="text-left p-2"><span className="block">Amount</span><span className="block">({form.currency})</span></th>
                        <th className="p-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.lineItems.map((item, index) => (
                        <tr key={`line-${index}`} className="border-t align-top">
                          <td className="p-2 min-w-[200px]">{lineField(index, 'marks')}</td>
                          <td className="p-2 min-w-[160px]">{lineField(index, 'description')}</td>
                          <td className="p-2 min-w-[110px]">{lineField(index, 'weight')}</td>
                          <td className="p-2 min-w-[90px]">{lineField(index, 'boxes')}</td>
                          <td className="p-2 min-w-[110px] whitespace-nowrap">{formatNumber(lineDetails[index]?.totalNetWeight ?? 0)} KGS</td>
                          <td className="p-2 min-w-[110px]">{lineField(index, 'rate')}</td>
                          <td className="p-2 min-w-[110px] whitespace-nowrap">{form.currency} {formatNumber(lineDetails[index]?.totalPerBox ?? 0)}</td>
                          <td className="p-2 min-w-[110px] whitespace-nowrap">{form.currency} {formatNumber(lineDetails[index]?.amount ?? 0)}</td>
                          <td className="p-2">
                            {form.lineItems.length > 1 ? (
                              <button type="button" aria-label={`Remove product ${index + 1}`} onClick={() => removeLine(index)} className="p-1 hover:bg-destructive/10 rounded-md"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, lineItems: [...p.lineItems, { marksAndNos: '', containerNo: '', descriptionOfGoods: '', netWeightPerPackage: 0, numberOfBoxes: 0, ratePerKg: 0 }] }))}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[hsl(var(--brand-accent))] text-white hover:opacity-90 shadow-sm transition-all text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" /> Add product
                </button>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 border rounded-md p-3">
                {/* Left column */}
                <div>
                  <label className="label">No of Pckgs</label>
                  <input readOnly value={String(totalBoxes)} className="w-16 border rounded-md px-2 py-1 text-xs bg-muted/40 text-center" />
                </div>
                <div>
                  <label className="label">SUB TOTAL</label>
                  <input readOnly value={`${form.currency} ${formatNumber(subTotal)}`} className="input bg-muted/40" />
                </div>

                <div>
                  <label className="label">TOTAL NETT WT</label>
                  <input readOnly value={`${formatNumber(totalNetWeight)} KGS`} className="input bg-muted/40" />
                </div>
                <div>
                  <label className="label">Total</label>
                  <input readOnly value={`${form.currency} ${formatNumber(total)}`} className="input bg-muted/40" />
                </div>

                <div>
                  <label className="label">TOTAL GROSS WT</label>
                  <div className="relative">
                    <NumberInput ariaLabel="Total gross weight" hasError={!!errors.totalGrossWeight} value={form.totalGrossWeight} onChange={(v) => { clearFieldError('totalGrossWeight'); setForm((p) => { const { totalGrossWeight: _drop, ...rest } = p; return v === undefined ? rest : { ...rest, totalGrossWeight: v }; }); }} className="input pr-9" />
                    {form.totalGrossWeight ? <span className="absolute right-2 top-[11px] text-[11px] text-muted-foreground pointer-events-none">KGS</span> : null}
                  </div>
                  {errors.totalGrossWeight ? <p className="err">{errors.totalGrossWeight}</p> : null}
                </div>

                <div className="col-span-2">
                  <label className="label">Amount in words ({form.currency})</label>
                  <input readOnly value={form.amountInWords ?? ''} className="input bg-muted/40" />
                </div>
              </div>
            </div>
          </Section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <Section title="Bank Detail" icon={Landmark} tone="teal" action={<ManageLink to="/exporter" label="Manage bank accounts" />}>
                <div className="max-w-sm">
                  <label className="label">Bank account</label>
                  <SearchCombobox
                    ariaLabel="Bank account"
                    value={bankProfileId}
                    onChange={chooseBankProfile}
                    options={bankProfiles.map((p) => ({ value: p.id, label: bankLabel(p), description: p.isDefault ? 'Default' : '' }))}
                    placeholder={isEditing ? "Keep this invoice's bank details" : bankProfiles.length ? 'Select a bank account' : 'No bank accounts yet'}
                    searchPlaceholder="Search bank accounts…"
                    labelClassName="w-auto max-w-[70%] truncate"
                    className="input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <LabeledInput label="BANK NAME" value={form.bankName ?? ''} onChange={(v) => setForm((p) => ({ ...p, bankName: v }))} />
                  <LabeledInput label="ACCOUNT NUMBER" value={form.bankAccountNumber ?? ''} onChange={(v) => setForm((p) => ({ ...p, bankAccountNumber: v }))} />
                  <LabeledInput label="IFSC CODE" value={form.bankIfscCode ?? ''} onChange={(v) => setForm((p) => ({ ...p, bankIfscCode: v }))} />
                  <LabeledInput label="SWIFT CODE" value={form.bankSwiftCode ?? ''} onChange={(v) => setForm((p) => ({ ...p, bankSwiftCode: v }))} />
                </div>
                <p className="text-[11px] text-muted-foreground">This invoice keeps its own copy of these details. Changing them here does not change the saved account.</p>
              </Section>

              <Section title="Declaration" icon={ScrollText} tone="teal" action={<ManageLink to="/exporter" label="Manage declarations" />}>
                <div className="max-w-sm">
                  <label className="label">Declaration</label>
                  <SearchCombobox
                    ariaLabel="Declaration"
                    value={declarationProfileId}
                    onChange={chooseDeclarationProfile}
                    options={declarationProfiles.map((p) => ({ value: p.id, label: p.name, description: p.isDefault ? 'Default' : '' }))}
                    placeholder={isEditing ? "Keep this invoice's declaration" : declarationProfiles.length ? 'Select a declaration' : 'No declarations yet'}
                    searchPlaceholder="Search declarations…"
                    labelClassName="w-auto max-w-[70%] truncate"
                    className="input"
                  />
                </div>
                <textarea
                  aria-label="Declaration text"
                  rows={4}
                  maxLength={2000}
                  value={form.declaration ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, declaration: e.target.value }))}
                  className="input resize-y text-xs leading-relaxed"
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Press Enter for a new line. This invoice keeps its own wording.</span>
                  {(() => {
                    const saved = declarationProfiles.find((p) => p.id === declarationProfileId)?.text ?? DEFAULT_DECLARATION;
                    return (form.declaration ?? '') !== saved ? (
                      <button type="button" onClick={() => setForm((p) => ({ ...p, declaration: saved }))} className="font-semibold text-[hsl(var(--brand-accent))] hover:underline">
                        {declarationProfileId ? 'Reset to saved text' : 'Reset to standard text'}
                      </button>
                    ) : null;
                  })()}
                </div>
              </Section>
            </div>

            <Section title="Seal & Sign" icon={PenLine} tone="teal" action={<ManageLink to="/exporter" label="Manage seal & sign" />}>
              <div className="max-w-sm">
                <label className="label">Seal &amp; sign</label>
                <SearchCombobox
                  ariaLabel="Seal and sign"
                  value={signProfileId}
                  onChange={chooseSignProfile}
                  options={signProfiles.map((p) => ({ value: p.id, label: p.name, description: p.isDefault ? 'Default' : '' }))}
                  placeholder={isEditing ? "Keep this invoice's seal & sign" : signProfiles.length ? 'Select a seal & sign' : 'No seal & sign yet'}
                  searchPlaceholder="Search seals & signs…"
                  labelClassName="w-auto max-w-[70%] truncate"
                  className="input"
                />
              </div>
              <div className="border rounded-md p-2 flex items-center justify-center bg-white h-28">
                {form.signImage
                  ? <img src={form.signImage} alt={form.signName || 'Seal and sign'} className="max-h-24 w-auto object-contain" />
                  : <span className="text-xs text-muted-foreground">No seal &amp; sign on this invoice</span>}
              </div>
              <p className="text-[11px] text-muted-foreground">This invoice keeps its own copy. Changing the saved seal &amp; sign later does not change it.</p>
            </Section>
          </div>
        </div>

        <div className="sticky bottom-0 shrink-0 border-t bg-gradient-to-r from-[hsl(var(--primary)/0.08)] to-[hsl(var(--brand-accent)/0.12)] p-3">
          <div className="flex items-center justify-end gap-2">
            <button onClick={closeForm} className="px-3 py-1.5 text-xs border rounded-md bg-background hover:bg-accent">Cancel</button>
            <button onClick={saveDraft} disabled={saveDraftMutation.isPending} className="px-3 py-1.5 text-xs border rounded-md bg-background hover:bg-accent disabled:opacity-50">{saveDraftMutation.isPending ? 'Saving…' : 'Save Draft'}</button>
            <button onClick={submitInvoice} disabled={isPending} className="px-3 py-1.5 text-xs bg-[hsl(var(--brand-accent))] text-white rounded-md hover:opacity-90 disabled:opacity-50">
              {isEditing ? 'Save Invoice' : 'Create Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  , document.body);

  /** One input per product field, shared by the phone cards and the desktop table. */
  function lineField(index: number, field: 'marks' | 'description' | 'weight' | 'boxes' | 'rate') {
    const item = form.lineItems[index]!;
    const cls = 'w-full border rounded px-2 py-1 text-xs';
    const err = (key: string) => (errors[`lineItems.${index}.${key}`] ? <p className="err">{errors[`lineItems.${index}.${key}`]}</p> : null);
    const num = (key: 'netWeightPerPackage' | 'numberOfBoxes' | 'ratePerKg', name: string, opts: { integer?: boolean; decimals?: number }) => (
      <>
        <NumberInput ariaLabel={`${name} for product ${index + 1}`} hasError={!!errors[`lineItems.${index}.${key}`]} value={item[key]} className={cls}
          {...opts} onChange={(v) => { clearFieldError(`lineItems.${index}.${key}`); updateLine(index, { [key]: v ?? 0 }); }} />
        {err(key)}
      </>
    );
    if (field === 'marks') return (<><input aria-label={`Marks and container no for product ${index + 1}`} value={item.marksAndNos ?? ''} onChange={(e) => { clearFieldError(`lineItems.${index}.marksAndNos`); updateLine(index, { marksAndNos: e.target.value, containerNo: e.target.value }); }} placeholder="Marks & Nos / Container No" className={cls} />{err('marksAndNos')}</>);
    if (field === 'description') return (
      <>
        <ProductPicker
          ariaLabel={`Description of goods for product ${index + 1}`}
          value={item.descriptionOfGoods}
          scope={{ importerId: form.importerId || undefined, currency: form.currency || undefined, locationName: selectedImporter?.landingLocations.find((l) => l.id === form.landingLocationId)?.name || undefined }}
          hasError={!!errors[`lineItems.${index}.descriptionOfGoods`]}
          onSelect={(text, product) => { clearFieldError(`lineItems.${index}.descriptionOfGoods`); pickProduct(index, text, product); }}
        />
        {err('descriptionOfGoods')}
      </>
    );
    if (field === 'weight') return num('netWeightPerPackage', 'Nett weight per package', { decimals: 3 });
    if (field === 'boxes') return num('numberOfBoxes', 'Number of boxes', { integer: true });
    return num('ratePerKg', 'Rate per kg', { decimals: 4 });
  }

  /** Sets the product name on a line and fills the usual weight and rate (and HS code) where they are still empty. */
  function pickProduct(index: number, text: string, product: Product | undefined) {
    setForm((p) => {
      const lineItems = p.lineItems.map((item, i) => {
        if (i !== index) return item;
        const filled = { ...item, descriptionOfGoods: text };
        if (product?.nettWeightPerPackage != null && !Number(item.netWeightPerPackage)) filled.netWeightPerPackage = Number(product.nettWeightPerPackage);
        if (product?.ratePerKg != null && !Number(item.ratePerKg)) filled.ratePerKg = Number(product.ratePerKg);
        return filled;
      });
      return { ...p, lineItems, ...(product?.hsCode && !p.hsCode ? { hsCode: product.hsCode } : {}) };
    });
    if (product?.hsCode) clearFieldError('hsCode');
    if (product?.nettWeightPerPackage != null) clearFieldError(`lineItems.${index}.netWeightPerPackage`);
    if (product?.ratePerKg != null) clearFieldError(`lineItems.${index}.ratePerKg`);
  }

  function updateLine(index: number, patch: Partial<CreateInvoiceDto['lineItems'][number]>) {
    setForm((p) => ({ ...p, lineItems: p.lineItems.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));
  }
  function removeLine(index: number) {
    setForm((p) => ({ ...p, lineItems: p.lineItems.filter((_, i) => i !== index) }));
  }
}

function ManageLink({ to, label }: { to: string; label: string }) {
  return (
    <a href={to} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
      {label} <ExternalLink className="h-3 w-3" />
    </a>
  );
}

type SectionTone = 'teal' | 'orange';

/** A form block with a tinted header band (teal for people and references, orange for shipping and goods). */
function Section({ title, icon: Icon, tone = 'teal', children, action }: {
  title: string; icon: LucideIcon; tone?: SectionTone; children: React.ReactNode; action?: React.ReactNode;
}) {
  const band = tone === 'orange' ? 'bg-[hsl(var(--brand-accent)/0.09)] border-[hsl(var(--brand-accent)/0.25)]' : 'bg-[hsl(var(--primary)/0.06)]';
  const tile = tone === 'orange' ? 'bg-[hsl(var(--brand-accent))]' : 'bg-[hsl(var(--primary))]';
  return (
    <section className="overflow-hidden rounded-md border bg-background shadow-sm">
      <div className={cn('flex items-center justify-between gap-2 border-b px-3 py-2', band)}>
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className={cn('flex h-6 w-6 items-center justify-center rounded-md text-white', tile)}><Icon className="h-3.5 w-3.5" /></span>
          {title}
        </h3>
        {action}
      </div>
      <div className="space-y-2 p-3">{children}</div>
    </section>
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

/** A tinted block that keeps the loading and landing details visually apart. */
function LocationGroup({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-md border border-[hsl(var(--brand-accent))]/30 border-l-4 border-l-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent))]/5 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--brand-accent))]">
        {title} <span className="text-sm font-semibold normal-case tracking-normal text-muted-foreground">({hint})</span>
      </p>
      {children}
    </div>
  );
}

/** Picker for the importer's saved loading/landing locations (managed on the Importers page). */
function LocationPicker({ label, ariaLabel, value, onChange, options, importerChosen }: {
  label: string; ariaLabel: string; value: string; onChange: (id: string) => void; options: { value: string; label: string; description: string }[]; importerChosen: boolean;
}) {
  const empty = options.length === 0;
  return (
    <div className="max-w-sm">
      <label className="label">{label}</label>
      <SearchCombobox
        ariaLabel={ariaLabel}
        value={value}
        onChange={onChange}
        options={options}
        disabled={empty}
        placeholder={!importerChosen ? 'Select an importer first' : empty ? "No saved locations for this importer" : 'Choose a saved location'}
        searchPlaceholder="Search saved locations…"
        labelClassName="w-auto max-w-[55%] truncate"
        className="input"
      />
    </div>
  );
}

function LabeledInput({ label, value, onChange, disabled, error }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; error?: string | undefined }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className="input disabled:bg-muted/40" />
      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}
