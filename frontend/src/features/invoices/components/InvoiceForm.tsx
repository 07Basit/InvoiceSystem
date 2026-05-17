import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X, Lock, Unlock } from 'lucide-react';
import type { CreateInvoiceDto, UpsertExporterProfileDto } from 'shared';
import { useClients } from '@/features/clients/hooks/useClients';
import { useCreateInvoice, useInvoice, useUpdateInvoice } from '../hooks/useInvoices';
import { useExporterProfile, useSaveExporterProfile } from '../hooks/useExporterProfile';
import { useInvoiceStore } from '../store/invoiceStore';
import { useToast } from '@/components/ui/toast';

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
    {
      marksAndNos: '',
      containerNo: '',
      descriptionOfGoods: '',
      netWeightPerPackage: 0,
      numberOfBoxes: 0,
      ratePerKg: 0,
    },
  ],
  totalGrossWeight: undefined,
  roundOff: 0,
  amountInWords: '',
  notes: '',
  status: 'DRAFT',
};

const emptyExporter: UpsertExporterProfileDto = {
  name: '',
  address: '',
  contact: '',
  email: '',
  isLocked: false,
};

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

function toIsoDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00.000Z`).toISOString();
}

function toWords(value: number) {
  if (!Number.isFinite(value)) return '';

  const belowTwenty = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const toChunkWords = (n: number): string => {
    if (n < 20) return belowTwenty[n] ?? '';
    if (n < 100) {
      const t = Math.floor(n / 10);
      const u = n % 10;
      return `${tens[t]}${u ? ` ${belowTwenty[u]}` : ''}`;
    }

    const h = Math.floor(n / 100);
    const rest = n % 100;
    return `${belowTwenty[h]} Hundred${rest ? ` ${toChunkWords(rest)}` : ''}`;
  };

  const integer = Math.floor(Math.abs(value));
  const fraction = Math.round((Math.abs(value) - integer) * 100);

  if (integer === 0 && fraction === 0) return 'Zero only';

  const scales = ['', 'Thousand', 'Million', 'Billion'];
  let remaining = integer;
  let scaleIndex = 0;
  const parts: string[] = [];

  while (remaining > 0 && scaleIndex < scales.length) {
    const chunk = remaining % 1000;
    if (chunk > 0) {
      const chunkWords = toChunkWords(chunk);
      const suffix = scales[scaleIndex] ? ` ${scales[scaleIndex]}` : '';
      parts.unshift(`${chunkWords}${suffix}`.trim());
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex += 1;
  }

  const integerWords = parts.join(' ');
  if (fraction > 0) {
    return `${integerWords} and ${fraction}/100 only`;
  }

  return `${integerWords} only`;
}

export default function InvoiceForm() {
  const { isFormOpen, editingId, closeForm } = useInvoiceStore();
  const { data: invoiceData } = useInvoice(editingId ?? '');
  const { data: importersData } = useClients({ limit: 200 });
  const { data: exporterData } = useExporterProfile();
  const saveExporterMutation = useSaveExporterProfile();
  const createMutation = useCreateInvoice();
  const updateMutation = useUpdateInvoice();
  const { showToast } = useToast();

  const [form, setForm] = useState<CreateInvoiceDto>(initialInvoice);
  const [exporter, setExporter] = useState<UpsertExporterProfileDto>(emptyExporter);
  const [exporterLocked, setExporterLocked] = useState(false);

  const isEditing = Boolean(editingId);
  const invoice = invoiceData?.data;
  const importers = importersData?.data ?? [];

  const selectedImporter = useMemo(() => importers.find((item) => item.id === form.importerId), [form.importerId, importers]);
  const selectedLanding = selectedImporter?.landingLocations.find((item) => item.id === form.landingLocationId);
  const selectedLoading = selectedImporter?.loadingLocations.find((item) => item.id === form.loadingLocationId);

  useEffect(() => {
    if (exporterData?.data) {
      setExporter({
        name: exporterData.data.name,
        address: exporterData.data.address,
        contact: exporterData.data.contact,
        email: exporterData.data.email ?? '',
        isLocked: exporterData.data.isLocked,
      });
      setExporterLocked(Boolean(exporterData.data.isLocked));
    }
  }, [exporterData]);

  useEffect(() => {
    if (!invoice || !isEditing) {
      return;
    }

    setForm({
      importerId: invoice.importerId,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      exportersRef: invoice.exportersRef ?? '',
      otherReferences: invoice.otherReferences ?? '',
      awbNumber: invoice.awbNumber ?? '',
      preCarriageBy: invoice.preCarriageBy ?? 'TRUCK BY ROAD',
      placeOfReceiptByPreCarrier: invoice.placeOfReceiptByPreCarrier ?? 'N/A',
      vesselFlightNo: invoice.vesselFlightNo ?? 'By Air',
      loadingLocationId: invoice.loadingLocationId ?? undefined,
      landingLocationId: invoice.landingLocationId ?? undefined,
      portOfLoading: invoice.portOfLoading ?? '',
      portOfDischarge: invoice.portOfDischarge ?? '',
      finalDestination: invoice.finalDestination ?? '',
      buyerName: invoice.buyerName ?? '',
      countryOfOrigin: invoice.countryOfOrigin ?? '',
      countryOfDestination: invoice.countryOfDestination ?? '',
      descriptionOfGoods: invoice.descriptionOfGoods ?? 'FRUITS & VEGETABLES',
      hsCode: invoice.hsCode ?? '709',
      termsOfDelivery: invoice.termsOfDelivery ?? 'CNF YUL',
      termsOfPayment: invoice.termsOfPayment ?? 'ADVANCE',
      currency: invoice.currency,
      exporterName: invoice.exporterName ?? '',
      exporterAddress: invoice.exporterAddress ?? '',
      exporterContact: invoice.exporterContact ?? '',
      exporterEmail: invoice.exporterEmail ?? '',
      lineItems: invoice.lineItems.map((item) => ({
        marksAndNos: item.marksAndNos ?? '',
        containerNo: item.containerNo ?? '',
        descriptionOfGoods: item.descriptionOfGoods,
        netWeightPerPackage: Number(item.netWeightPerPackage),
        numberOfBoxes: item.numberOfBoxes,
        ratePerKg: Number(item.ratePerKg),
      })),
      totalGrossWeight: invoice.totalGrossWeight ?? undefined,
      roundOff: Number(invoice.roundOff),
      amountInWords: invoice.amountInWords ?? '',
      notes: invoice.notes ?? '',
      status: invoice.status,
    });
  }, [invoice, isEditing]);

  useEffect(() => {
    if (!isFormOpen) {
      setForm(initialInvoice);
    }
  }, [isFormOpen]);

  const lineDetails = form.lineItems.map((item) => {
    const totalNetWeight = Number(item.netWeightPerPackage) * Number(item.numberOfBoxes);
    const totalPerBox = Number(item.netWeightPerPackage) * Number(item.ratePerKg);
    const amount = totalNetWeight * Number(item.ratePerKg);

    return { totalNetWeight, totalPerBox, amount };
  });

  const totalNetWeight = lineDetails.reduce((sum, item) => sum + item.totalNetWeight, 0);
  const totalBoxes = form.lineItems.reduce((sum, item) => sum + Number(item.numberOfBoxes), 0);
  const subTotal = lineDetails.reduce((sum, item) => sum + item.amount, 0);
  const roundOff = Number(form.roundOff ?? 0);
  const total = subTotal + roundOff;
  const resolvedCurrency = selectedImporter?.currency ?? form.currency;

  useEffect(() => {
    if (form.amountInWords?.trim()) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      amountInWords: `${resolvedCurrency} ${toWords(total)}`,
    }));
  }, [form.amountInWords, resolvedCurrency, total]);

  const isPending = createMutation.isPending || updateMutation.isPending || saveExporterMutation.isPending;

  const applyImporterDefaults = (importerId: string) => {
    const importer = importers.find((item) => item.id === importerId);
    if (!importer) {
      return;
    }

    const firstLanding = importer.landingLocations[0];
    const firstLoading = importer.loadingLocations[0];

    setForm((prev) => ({
      ...prev,
      importerId,
      buyerName: importer.buyerName,
      currency: importer.currency,
      landingLocationId: firstLanding?.id,
      loadingLocationId: firstLoading?.id,
      portOfDischarge: firstLanding?.portOfDischarge ?? '',
      finalDestination: firstLanding?.finalDestination ?? '',
      countryOfDestination: firstLanding?.countryOfDestination ?? '',
      portOfLoading: firstLoading?.portOfLoading ?? '',
      countryOfOrigin: firstLoading?.countryOfOrigin ?? '',
    }));
  };

  const applyLanding = (landingLocationId: string) => {
    const nextId = landingLocationId || undefined;
    const landing = selectedImporter?.landingLocations.find((item) => item.id === nextId);
    setForm((prev) => ({
      ...prev,
      landingLocationId: nextId,
      portOfDischarge: landing?.portOfDischarge ?? prev.portOfDischarge,
      finalDestination: landing?.finalDestination ?? prev.finalDestination,
      countryOfDestination: landing?.countryOfDestination ?? prev.countryOfDestination,
    }));
  };

  const applyLoading = (loadingLocationId: string) => {
    const nextId = loadingLocationId || undefined;
    const loading = selectedImporter?.loadingLocations.find((item) => item.id === nextId);
    setForm((prev) => ({
      ...prev,
      loadingLocationId: nextId,
      portOfLoading: loading?.portOfLoading ?? prev.portOfLoading,
      countryOfOrigin: loading?.countryOfOrigin ?? prev.countryOfOrigin,
    }));
  };

  const saveExporter = async () => {
    try {
      await saveExporterMutation.mutateAsync({ ...exporter, isLocked: exporterLocked });
      setForm((prev) => ({
        ...prev,
        exporterName: exporter.name,
        exporterAddress: exporter.address,
        exporterContact: exporter.contact,
        exporterEmail: exporter.email,
      }));
      showToast('Exporter profile saved', 'Exporter details are updated for future invoices.', 'success');
    } catch (error) {
      showToast('Unable to save exporter profile', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const submitInvoice = async () => {
    const payload: CreateInvoiceDto = {
      ...form,
      invoiceDate: form.invoiceDate,
      currency: resolvedCurrency,
      status: 'DRAFT',
      exporterName: form.exporterName || exporter.name,
      exporterAddress: form.exporterAddress || exporter.address,
      exporterContact: form.exporterContact || exporter.contact,
      exporterEmail: form.exporterEmail || exporter.email || undefined,
      amountInWords: form.amountInWords?.trim() ? form.amountInWords : `${resolvedCurrency} ${toWords(total)}`,
      roundOff,
      lineItems: form.lineItems.map((item) => ({
        ...item,
        netWeightPerPackage: Number(item.netWeightPerPackage),
        numberOfBoxes: Number(item.numberOfBoxes),
        ratePerKg: Number(item.ratePerKg),
      })),
    };

    try {
      if (isEditing && editingId) {
        await updateMutation.mutateAsync({ id: editingId, dto: payload });
        showToast('Invoice updated', `${payload.invoiceNumber} was updated successfully.`, 'success');
      } else {
        await createMutation.mutateAsync(payload);
        showToast('Invoice created', `${payload.invoiceNumber} is now available in the invoice list.`, 'success');
      }

      closeForm();
      setForm(initialInvoice);
    } catch (error) {
      showToast('Unable to save invoice', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  if (!isFormOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background w-full max-w-7xl max-h-[94vh] rounded-lg shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{isEditing ? 'Edit Invoice' : 'Invoice'}</h2>
          <button onClick={closeForm} className="p-1 hover:bg-accent rounded-md"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          <div className="border rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Exporter (Common)</h3>
              <button
                onClick={() => setExporterLocked((prev) => !prev)}
                className="flex items-center gap-1 text-xs border rounded-md px-2 py-1"
              >
                {exporterLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                {exporterLocked ? 'Locked' : 'Unlocked'}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <input disabled={exporterLocked} placeholder="Name" value={exporter.name} onChange={(event) => setExporter((prev) => ({ ...prev, name: event.target.value }))} className="border rounded-md px-3 py-2" />
              <input disabled={exporterLocked} placeholder="Address" value={exporter.address} onChange={(event) => setExporter((prev) => ({ ...prev, address: event.target.value }))} className="border rounded-md px-3 py-2" />
              <input disabled={exporterLocked} placeholder="Contact" value={exporter.contact} onChange={(event) => setExporter((prev) => ({ ...prev, contact: event.target.value }))} className="border rounded-md px-3 py-2" />
              <input disabled={exporterLocked} placeholder="Email (optional)" value={exporter.email ?? ''} onChange={(event) => setExporter((prev) => ({ ...prev, email: event.target.value }))} className="border rounded-md px-3 py-2" />
            </div>
            <button onClick={saveExporter} className="text-xs text-primary hover:underline">Save Exporter Profile</button>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <Field label="Invoice No" value={form.invoiceNumber} onChange={(value) => setForm((prev) => ({ ...prev, invoiceNumber: value }))} />
            <DateField label="Invoice Date" value={toDateInput(form.invoiceDate)} onChange={(value) => setForm((prev) => ({ ...prev, invoiceDate: toIsoDate(value) }))} />
            <Field label="Exporter's Ref." value={form.exportersRef ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, exportersRef: value }))} />
            <Field label="Other Reference(s)" value={form.otherReferences ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, otherReferences: value }))} />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Importer</label>
              <select value={form.importerId} onChange={(event) => applyImporterDefaults(event.target.value)} className="w-full border rounded-md px-3 py-2">
                <option value="">Select importer</option>
                {importers.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <Field label="AWB NO" value={form.awbNumber ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, awbNumber: value }))} />
            <Field label="Pre-Carriage by" value={form.preCarriageBy ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, preCarriageBy: value }))} />
            <Field label="Place of Receipt by Pre-Carrier" value={form.placeOfReceiptByPreCarrier ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, placeOfReceiptByPreCarrier: value }))} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Vessel Flight No." value={form.vesselFlightNo ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, vesselFlightNo: value }))} />
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Loading Location</label>
              <select value={form.loadingLocationId ?? ''} onChange={(event) => applyLoading(event.target.value)} className="w-full border rounded-md px-3 py-2">
                <option value="">Select loading location</option>
                {(selectedImporter?.loadingLocations ?? []).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Landing Location</label>
              <select value={form.landingLocationId ?? ''} onChange={(event) => applyLanding(event.target.value)} className="w-full border rounded-md px-3 py-2">
                <option value="">Select landing location</option>
                {(selectedImporter?.landingLocations ?? []).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <Field label="Port of loading" value={form.portOfLoading ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, portOfLoading: value }))} />
            <Field label="Port of discharge" value={form.portOfDischarge ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, portOfDischarge: value }))} />
            <Field label="Final Destination" value={form.finalDestination ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, finalDestination: value }))} />
            <Field label="Buyer" value={form.buyerName ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, buyerName: value }))} />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <Field label="Country of Origin" value={form.countryOfOrigin ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, countryOfOrigin: value }))} />
            <Field label="Country of Destination" value={form.countryOfDestination ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, countryOfDestination: value }))} />
            <Field label="DESCRIPTION OF GOODS" value={form.descriptionOfGoods ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, descriptionOfGoods: value }))} />
            <Field label="HS CODE" value={form.hsCode ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, hsCode: value }))} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="TERMS OF DELIVERY" value={form.termsOfDelivery ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, termsOfDelivery: value }))} />
            <Field label="TERMS OF PAYMENT" value={form.termsOfPayment ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, termsOfPayment: value }))} />
            <Field label="No Of Pckgs" value={String(totalBoxes)} onChange={() => undefined} readOnly />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Add Items</h3>
              <button
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    lineItems: [
                      ...prev.lineItems,
                      {
                        marksAndNos: '',
                        containerNo: '',
                        descriptionOfGoods: '',
                        netWeightPerPackage: 0,
                        numberOfBoxes: 0,
                        ratePerKg: 0,
                      },
                    ],
                  }))
                }
                className="text-xs flex items-center gap-1 text-primary hover:underline"
              >
                <Plus className="h-3 w-3" /> Add row
              </button>
            </div>
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-2">Marks & Nos / Container No.</th>
                    <th className="text-left p-2">Description of Goods</th>
                    <th className="text-left p-2">NETT WT PER PACKAGES</th>
                    <th className="text-left p-2">NO OF BOXES</th>
                    <th className="text-left p-2">TOTAL NETT WT KGS</th>
                    <th className="text-left p-2">RATE PER KGS</th>
                    <th className="text-left p-2">TOTAL PER BOX</th>
                    <th className="text-left p-2">Amount ({selectedImporter?.currency ?? form.currency})</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {form.lineItems.map((item, index) => (
                    <tr key={`line-${index}`} className="border-t">
                      <td className="p-2 space-y-1 min-w-[220px]">
                        <input value={item.marksAndNos ?? ''} onChange={(event) => updateLine(index, { marksAndNos: event.target.value })} placeholder="Marks & Nos" className="w-full border rounded px-2 py-1" />
                        <input value={item.containerNo ?? ''} onChange={(event) => updateLine(index, { containerNo: event.target.value })} placeholder="Container No" className="w-full border rounded px-2 py-1" />
                      </td>
                      <td className="p-2 min-w-[180px]"><input value={item.descriptionOfGoods} onChange={(event) => updateLine(index, { descriptionOfGoods: event.target.value })} className="w-full border rounded px-2 py-1" /></td>
                      <td className="p-2 min-w-[140px]"><input type="number" step="0.01" value={item.netWeightPerPackage} onChange={(event) => updateLine(index, { netWeightPerPackage: Number(event.target.value) })} className="w-full border rounded px-2 py-1" /></td>
                      <td className="p-2 min-w-[110px]"><input type="number" step="1" value={item.numberOfBoxes} onChange={(event) => updateLine(index, { numberOfBoxes: Number(event.target.value) })} className="w-full border rounded px-2 py-1" /></td>
                      <td className="p-2 min-w-[120px]">KGS {lineDetails[index]?.totalNetWeight.toFixed(2)}</td>
                      <td className="p-2 min-w-[110px]"><input type="number" step="0.01" value={item.ratePerKg} onChange={(event) => updateLine(index, { ratePerKg: Number(event.target.value) })} className="w-full border rounded px-2 py-1" /></td>
                      <td className="p-2 min-w-[120px]">{selectedImporter?.currency ?? form.currency} {lineDetails[index]?.totalPerBox.toFixed(2)}</td>
                      <td className="p-2 min-w-[120px]">{selectedImporter?.currency ?? form.currency} {lineDetails[index]?.amount.toFixed(2)}</td>
                      <td className="p-2">
                        {form.lineItems.length > 1 && (
                          <button onClick={() => removeLine(index)} className="p-1 hover:bg-destructive/10 rounded-md">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 border rounded-md p-4">
            <Field label="TOTAL NETT WT" value={totalNetWeight.toFixed(2)} onChange={() => undefined} readOnly />
            <Field label="TOTAL GROSS WT" value={form.totalGrossWeight ? String(form.totalGrossWeight) : ''} onChange={(value) => setForm((prev) => ({ ...prev, totalGrossWeight: value ? Number(value) : undefined }))} />
            <Field label="SUB TOTAL" value={`${selectedImporter?.currency ?? form.currency} ${subTotal.toFixed(2)}`} onChange={() => undefined} readOnly />
            <Field label="Round OFF" value={String(form.roundOff ?? 0)} onChange={(value) => setForm((prev) => ({ ...prev, roundOff: Number(value || 0) }))} />
            <Field label="Total" value={`${selectedImporter?.currency ?? form.currency} ${total.toFixed(2)}`} onChange={() => undefined} readOnly />
            <Field label={`Amount in words (${selectedImporter?.currency ?? form.currency})`} value={form.amountInWords ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, amountInWords: value }))} />
            <Field label="Notes" value={form.notes ?? ''} onChange={(value) => setForm((prev) => ({ ...prev, notes: value }))} />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t">
          <button onClick={closeForm} className="px-4 py-2 text-sm border rounded-md hover:bg-accent">Cancel</button>
          <button onClick={submitInvoice} disabled={isPending} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50">
            {isEditing ? 'Save Invoice' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );

  function updateLine(index: number, patch: Partial<CreateInvoiceDto['lineItems'][number]>) {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function removeLine(index: number) {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index),
    }));
  }
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

function Field({ label, value, onChange, readOnly }: FieldProps) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring read-only:bg-muted/40"
      />
    </div>
  );
}

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function DateField({ label, value, onChange }: DateFieldProps) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
