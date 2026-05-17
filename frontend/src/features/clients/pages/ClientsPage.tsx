import { useState, type ReactNode } from 'react';
import { Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import type { CreateImporterDto } from 'shared';
import { useClients, useCreateClient, useDeleteClient, useUpdateClient } from '../hooks/useClients';
import type { Importer } from '../services/clientService';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/toast';
import { ApiClientError } from '@/services/api';

const emptyImporter: CreateImporterDto = {
  name: '',
  address: '',
  contact: '',
  email: '',
  buyerName: '',
  currency: '',
  landingLocations: [
    { name: '', portOfDischarge: '', finalDestination: '', countryOfDestination: '' },
  ],
  loadingLocations: [
    { name: '', portOfLoading: '', countryOfOrigin: '' },
  ],
};

const importerDraftKey = 'importer-form-draft-v1';
type FieldErrors = Record<string, string>;

const contactRegex = /^[0-9+()\-\s]{7,20}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ClientsPage() {
  const { data, isLoading, isError, error, refetch } = useClients({ limit: 100, sort: 'name' });
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const deleteMutation = useDeleteClient();
  const { showToast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Importer | null>(null);
  const [form, setForm] = useState<CreateImporterDto>(emptyImporter);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const importers = data?.data ?? [];

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setSubmitError(null);

    try {
      const rawDraft = localStorage.getItem(importerDraftKey);
      if (!rawDraft) {
        setForm(emptyImporter);
      } else {
        const draft = JSON.parse(rawDraft) as Partial<CreateImporterDto>;
        setForm({
          ...emptyImporter,
          ...draft,
          landingLocations: draft.landingLocations?.length
            ? draft.landingLocations
            : emptyImporter.landingLocations,
          loadingLocations: draft.loadingLocations?.length
            ? draft.loadingLocations
            : emptyImporter.loadingLocations,
        });
        showToast('Draft restored', 'Your previous importer draft has been loaded.', 'info');
      }
    } catch {
      setForm(emptyImporter);
    }

    setIsFormOpen(true);
  };

  const openEdit = (importer: Importer) => {
    setEditing(importer);
    setErrors({});
    setSubmitError(null);
    setForm({
      name: importer.name,
      address: importer.address,
      contact: importer.contact,
      email: importer.email ?? '',
      buyerName: importer.buyerName,
      currency: importer.currency,
      landingLocations: importer.landingLocations.map((item) => ({
        name: item.name,
        portOfDischarge: item.portOfDischarge,
        finalDestination: item.finalDestination,
        countryOfDestination: item.countryOfDestination,
      })),
      loadingLocations: importer.loadingLocations.map((item) => ({
        name: item.name,
        portOfLoading: item.portOfLoading,
        countryOfOrigin: item.countryOfOrigin,
      })),
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditing(null);
    setForm(emptyImporter);
    setErrors({});
    setSubmitError(null);
  };

  const clearFieldError = (key: string) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateForm = (): FieldErrors => {
    const nextErrors: FieldErrors = {};

    if (!form.name.trim()) nextErrors['name'] = 'Importer name is required.';
    if (!form.buyerName.trim()) nextErrors['buyerName'] = 'Buyer name is required.';
    if (!form.address.trim()) nextErrors['address'] = 'Address is required.';

    if (!form.contact.trim()) {
      nextErrors['contact'] = 'Phone/contact is required.';
    } else if (!contactRegex.test(form.contact.trim())) {
      nextErrors['contact'] = 'Contact must contain only numbers or + ( ) - and spaces.';
    }

    if (!form.currency.trim()) {
      nextErrors['currency'] = 'Currency is required.';
    } else if (form.currency.trim().length < 3) {
      nextErrors['currency'] = 'Currency must be at least 3 letters (e.g. CAD).';
    }

    if (form.email?.trim() && !emailRegex.test(form.email.trim())) {
      nextErrors['email'] = 'Enter a valid email address.';
    }

    form.landingLocations.forEach((loc, index) => {
      if (!loc.name.trim()) nextErrors[`landingLocations.${index}.name`] = 'Landing location name is required.';
      if (!loc.portOfDischarge.trim()) nextErrors[`landingLocations.${index}.portOfDischarge`] = 'Port of discharge is required.';
      if (!loc.finalDestination.trim()) nextErrors[`landingLocations.${index}.finalDestination`] = 'Final destination is required.';
      if (!loc.countryOfDestination.trim()) nextErrors[`landingLocations.${index}.countryOfDestination`] = 'Country of destination is required.';
    });

    form.loadingLocations.forEach((loc, index) => {
      if (!loc.name.trim()) nextErrors[`loadingLocations.${index}.name`] = 'Loading location name is required.';
      if (!loc.portOfLoading.trim()) nextErrors[`loadingLocations.${index}.portOfLoading`] = 'Port of loading is required.';
      if (!loc.countryOfOrigin.trim()) nextErrors[`loadingLocations.${index}.countryOfOrigin`] = 'Country of origin is required.';
    });

    return nextErrors;
  };

  const saveDraft = () => {
    localStorage.setItem(importerDraftKey, JSON.stringify(form));
    showToast('Draft saved', 'You can continue this importer later.', 'success');
  };

  const saveImporter = async () => {
    setSubmitError(null);

    const fieldErrors = validateForm();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      showToast('Validation failed', 'Please fix the highlighted fields.', 'error');
      return;
    }

    const payload: CreateImporterDto = {
      ...form,
      name: form.name.trim(),
      buyerName: form.buyerName.trim(),
      address: form.address.trim(),
      contact: form.contact.trim(),
      currency: form.currency.trim().toUpperCase(),
      email: form.email?.trim() ? form.email : undefined,
      landingLocations: form.landingLocations.map((item) => ({
        name: item.name.trim(),
        portOfDischarge: item.portOfDischarge.trim(),
        finalDestination: item.finalDestination.trim(),
        countryOfDestination: item.countryOfDestination.trim(),
      })),
      loadingLocations: form.loadingLocations.map((item) => ({
        name: item.name.trim(),
        portOfLoading: item.portOfLoading.trim(),
        countryOfOrigin: item.countryOfOrigin.trim(),
      })),
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, dto: payload });
        showToast('Importer updated', `${payload.name} was updated successfully.`, 'success');
      } else {
        await createMutation.mutateAsync(payload);
        showToast('Importer created', `${payload.name} is ready to use in invoices.`, 'success');
        localStorage.removeItem(importerDraftKey);
      }

      closeForm();
    } catch (error) {
      if (error instanceof ApiClientError && error.details) {
        const nextErrors: FieldErrors = {};
        Object.entries(error.details).forEach(([key, messages]) => {
          if (messages.length > 0) {
            nextErrors[key] = messages[0] ?? 'Invalid value';
          }
        });

        if (Object.keys(nextErrors).length > 0) {
          setErrors(nextErrors);
        }
      }

      const message = error instanceof Error ? error.message : 'Please try again.';
      setSubmitError(message);
      showToast('Unable to save importer', message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Importers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage importer master data and route mappings</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New Importer
        </button>
      </div>

      {isLoading && <div className="flex justify-center py-16"><LoadingSpinner /></div>}

      {!isLoading && isError && (
        <div className="border border-destructive/30 bg-destructive/5 rounded-md p-4 flex items-center justify-between">
          <div>
            <p className="text-destructive font-medium">Failed to load importers.</p>
            <p className="text-sm text-muted-foreground mt-1">{error instanceof Error ? error.message : 'Please check backend connection and try again.'}</p>
          </div>
          <button onClick={() => refetch()} className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent">Retry</button>
        </div>
      )}

      {!isLoading && !isError && importers.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">No importers found. Create one to start invoicing.</div>
      )}

      {!isError && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {importers.map((importer) => (
          <div key={importer.id} className="border rounded-lg p-5 bg-card space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{importer.name}</p>
                <p className="text-sm text-muted-foreground">Buyer: {importer.buyerName}</p>
                <p className="text-sm text-muted-foreground">Currency: {importer.currency}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(importer)} className="p-1.5 hover:bg-accent rounded-md">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete importer ${importer.name}?`)) {
                      deleteMutation.mutate(importer.id);
                    }
                  }}
                  className="p-1.5 hover:bg-destructive/10 rounded-md"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            </div>

            <div className="text-sm space-y-1">
              <p>{importer.address}</p>
              <p className="text-muted-foreground">{importer.contact}{importer.email ? ` | ${importer.email}` : ''}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="border rounded-md p-2">
                <p className="font-medium mb-1">Landing</p>
                {importer.landingLocations.map((loc) => (
                  <p key={loc.id} className="text-muted-foreground">{loc.name} ({loc.portOfDischarge})</p>
                ))}
              </div>
              <div className="border rounded-md p-2">
                <p className="font-medium mb-1">Loading</p>
                {importer.loadingLocations.map((loc) => (
                  <p key={loc.id} className="text-muted-foreground">{loc.name} ({loc.portOfLoading})</p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>}

      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Importer' : 'New Importer'}</h2>
              <div className="flex items-center gap-2">
                <button onClick={saveDraft} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-accent">
                  <Save className="h-3.5 w-3.5" /> Save Draft
                </button>
                <button onClick={closeForm} className="h-8 w-8 rounded-full border hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Close importer form">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {submitError && <div className="text-sm text-destructive bg-destructive/5 border border-destructive/30 rounded-md px-3 py-2">{submitError}</div>}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Name" value={form.name} error={errors['name']} onChange={(value) => { clearFieldError('name'); setForm((prev) => ({ ...prev, name: value })); }} />
              <Field label="Buyer Name" value={form.buyerName} error={errors['buyerName']} onChange={(value) => { clearFieldError('buyerName'); setForm((prev) => ({ ...prev, buyerName: value })); }} />
              <Field label="Contact" value={form.contact} error={errors['contact']} onChange={(value) => { clearFieldError('contact'); setForm((prev) => ({ ...prev, contact: value })); }} />
              <Field label="Email (optional)" value={form.email ?? ''} error={errors['email']} onChange={(value) => { clearFieldError('email'); setForm((prev) => ({ ...prev, email: value })); }} />
              <Field label="Currency" value={form.currency} error={errors['currency']} onChange={(value) => { clearFieldError('currency'); setForm((prev) => ({ ...prev, currency: value.toUpperCase() })); }} placeholder="e.g. CAD" />
              <Field label="Address" value={form.address} error={errors['address']} onChange={(value) => { clearFieldError('address'); setForm((prev) => ({ ...prev, address: value })); }} />
            </div>

            <LocationSection
              title="Landing Locations"
              onAdd={() =>
                setForm((prev) => ({
                  ...prev,
                  landingLocations: [
                    ...prev.landingLocations,
                    { name: '', portOfDischarge: '', finalDestination: '', countryOfDestination: '' },
                  ],
                }))
              }
            >
              {form.landingLocations.map((loc, index) => (
                <div key={`landing-${index}`} className="relative grid grid-cols-4 gap-2 border rounded-md p-3 bg-muted/20">
                  <button
                    type="button"
                    disabled={form.landingLocations.length <= 1}
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        landingLocations: prev.landingLocations.filter((_, i) => i !== index),
                      }));
                    }}
                    className="absolute right-2 top-2 p-1 rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Delete landing location"
                    title="Delete landing location"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <Field label="Name" value={loc.name} onChange={(value) => setForm((prev) => ({
                    ...prev,
                    landingLocations: prev.landingLocations.map((item, i) => i === index ? { ...item, name: value } : item),
                  }))} error={errors[`landingLocations.${index}.name`]} />
                  <Field label="Port of Discharge" value={loc.portOfDischarge} onChange={(value) => setForm((prev) => ({
                    ...prev,
                    landingLocations: prev.landingLocations.map((item, i) => i === index ? { ...item, portOfDischarge: value } : item),
                  }))} error={errors[`landingLocations.${index}.portOfDischarge`]} />
                  <Field label="Final Destination" value={loc.finalDestination} onChange={(value) => setForm((prev) => ({
                    ...prev,
                    landingLocations: prev.landingLocations.map((item, i) => i === index ? { ...item, finalDestination: value } : item),
                  }))} error={errors[`landingLocations.${index}.finalDestination`]} />
                  <Field label="Country of Destination" value={loc.countryOfDestination} onChange={(value) => setForm((prev) => ({
                    ...prev,
                    landingLocations: prev.landingLocations.map((item, i) => i === index ? { ...item, countryOfDestination: value } : item),
                  }))} error={errors[`landingLocations.${index}.countryOfDestination`]} />
                </div>
              ))}
            </LocationSection>

            <LocationSection
              title="Loading Locations"
              onAdd={() =>
                setForm((prev) => ({
                  ...prev,
                  loadingLocations: [
                    ...prev.loadingLocations,
                    { name: '', portOfLoading: '', countryOfOrigin: '' },
                  ],
                }))
              }
            >
              {form.loadingLocations.map((loc, index) => (
                <div key={`loading-${index}`} className="relative grid grid-cols-3 gap-2 border rounded-md p-3 bg-muted/20">
                  <button
                    type="button"
                    disabled={form.loadingLocations.length <= 1}
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        loadingLocations: prev.loadingLocations.filter((_, i) => i !== index),
                      }));
                    }}
                    className="absolute right-2 top-2 p-1 rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Delete loading location"
                    title="Delete loading location"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <Field label="Name" value={loc.name} onChange={(value) => setForm((prev) => ({
                    ...prev,
                    loadingLocations: prev.loadingLocations.map((item, i) => i === index ? { ...item, name: value } : item),
                  }))} error={errors[`loadingLocations.${index}.name`]} />
                  <Field label="Port of Loading" value={loc.portOfLoading} onChange={(value) => setForm((prev) => ({
                    ...prev,
                    loadingLocations: prev.loadingLocations.map((item, i) => i === index ? { ...item, portOfLoading: value } : item),
                  }))} error={errors[`loadingLocations.${index}.portOfLoading`]} />
                  <Field label="Country of Origin" value={loc.countryOfOrigin} onChange={(value) => setForm((prev) => ({
                    ...prev,
                    loadingLocations: prev.loadingLocations.map((item, i) => i === index ? { ...item, countryOfOrigin: value } : item),
                  }))} error={errors[`loadingLocations.${index}.countryOfOrigin`]} />
                </div>
              ))}
            </LocationSection>

            <div className="flex justify-end gap-3">
              <button onClick={closeForm} className="px-4 py-2 text-sm border rounded-md hover:bg-accent">Cancel</button>
              <button
                onClick={saveImporter}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
              >
                {editing ? 'Save Importer' : 'Create Importer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  error?: string | undefined;
}

function Field({ label, value, onChange, placeholder, error }: FieldProps) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 ${error ? 'border-destructive focus:ring-destructive/60' : 'focus:ring-ring'}`}
      />
      {error ? <p className="text-xs text-destructive mt-1">{error}</p> : null}
    </div>
  );
}

interface LocationSectionProps {
  title: string;
  onAdd: () => void;
  children: ReactNode;
}

function LocationSection({ title, onAdd, children }: LocationSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{title}</h3>
        <button onClick={onAdd} className="px-3 py-1.5 rounded-md border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors text-xs font-medium">
          + Add
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
