import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Save } from 'lucide-react';
import { createImporterSchema, type CreateImporterDto } from 'shared';
import { useClients, useCreateClient, useDeleteClient, useImporterSummary, useUpdateClient } from '../hooks/useClients';
import type { Importer } from '../services/clientService';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ImporterCard from '../components/ImporterCard';
import ImporterStats from '../components/ImporterStats';
import ImporterFilters, { type StatusFilter } from '../components/ImporterFilters';
import Pagination from '@/components/ui/Pagination';
import { IMPORTERS_TWO_COLUMNS_FROM, scrollMainToTop, usePageSize } from '@/lib/pagination';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm';
import { ApiClientError } from '@/services/api';
import { getCurrencyOptions, toComboOption } from '@/lib/currencies';
import { COMMON_AIRPORT_CODES, getCountryOptions, useAirportOptions } from '@/lib/places';
import SearchCombobox, { type ComboOption } from '@/components/ui/SearchCombobox';

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

const importerDraftListKey = 'importer-draft-list-v1';
type FieldErrors = Record<string, string>;

interface ImporterDraft {
  id: string;
  createdAt: string;
  data: CreateImporterDto;
}

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const pageSize = usePageSize(IMPORTERS_TWO_COLUMNS_FROM);
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 300);

  // Search, status and paging all happen on the server; active importers come first, then A to Z.
  const { data, isLoading, isError, error, refetch } = useClients({
    page,
    limit: pageSize,
    sort: 'name',
    order: 'asc',
    status: statusFilter,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });
  const { data: summaryData } = useImporterSummary();
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const deleteMutation = useDeleteClient();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Importer | null>(null);
  const [form, setForm] = useState<CreateImporterDto>(emptyImporter);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ImporterDraft[]>(() => {
    try {
      const raw = localStorage.getItem(importerDraftListKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ImporterDraft[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  const importers = data?.data ?? [];
  const meta = data?.meta;
  const summary = summaryData?.data ?? { total: 0, active: 0, inactive: 0 };
  // Drafts aren't importers yet: they only appear on the first page of "All", and still respect the search text.
  const visibleDrafts = statusFilter === 'all' && page === 1
    ? drafts.filter((d) => {
        const terms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const text = [d.data.name, d.data.buyerName, d.data.contact, d.data.email, d.data.currency].filter(Boolean).join(' ').toLowerCase();
        return terms.every((t) => text.includes(t));
      })
    : [];
  const isFiltering = searchQuery.trim() !== '' || statusFilter !== 'all';

  const changePage = (next: number) => {
    setPage(next);
    scrollMainToTop();
  };
  const changeSearch = (value: string) => { setSearchQuery(value); setPage(1); };
  const changeStatus = (value: StatusFilter) => { setStatusFilter(value); setPage(1); };

  // A different screen size means different page boundaries, so start again from page 1.
  const lastPageSize = useRef(pageSize);
  useEffect(() => {
    if (lastPageSize.current !== pageSize) {
      lastPageSize.current = pageSize;
      setPage(1);
    }
  }, [pageSize]);

  // If the last card on the last page was just deleted or deactivated, step back to the new last page.
  const totalPages = meta?.totalPages ?? 0;
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openCreate = () => {
    setEditing(null);
    setEditingDraftId(null);
    setErrors({});
    setSubmitError(null);
    setForm(emptyImporter);
    setIsFormOpen(true);
  };

  const openEdit = (importer: Importer) => {
    setEditing(importer);
    setEditingDraftId(null);
    setErrors({});
    setSubmitError(null);
    setForm({
      name: importer.name,
      address: importer.address,
      contact: importer.contact ?? '',
      email: importer.email ?? '',
      buyerName: importer.buyerName ?? '',
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

  const openDraft = (draft: ImporterDraft) => {
    setEditing(null);
    setEditingDraftId(draft.id);
    setErrors({});
    setSubmitError(null);
    setForm(draft.data);
    setIsFormOpen(true);
  };

  const deleteDraft = (draftId: string) => {
    const next = drafts.filter((item) => item.id !== draftId);
    setDrafts(next);
    localStorage.setItem(importerDraftListKey, JSON.stringify(next));
    showToast('Draft deleted', 'Importer draft was removed.', 'info');
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditing(null);
    setEditingDraftId(null);
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

  // Same schema the API uses, so the form and the server can never disagree.
  const buildPayload = (): CreateImporterDto => ({
    ...form,
    name: form.name.trim(),
    buyerName: (form.buyerName ?? '').trim(),
    address: form.address.trim(),
    contact: (form.contact ?? '').trim(),
    currency: form.currency.trim().toUpperCase(),
    email: form.email?.trim() ? form.email.trim() : undefined,
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
  });

  const validateForm = (payload: CreateImporterDto): FieldErrors => {
    const result = createImporterSchema.safeParse(payload);
    if (result.success) return {};
    const nextErrors: FieldErrors = {};
    for (const issue of result.error.issues) {
      // "landingLocations.0.name" etc. match the keys the fields look up
      const key = issue.path.join('.');
      if (!nextErrors[key]) nextErrors[key] = issue.message;
    }
    return nextErrors;
  };

  const toggleActive = async (importer: Importer) => {
    const makeInactive = importer.isActive !== false;
    try {
      await updateMutation.mutateAsync({ id: importer.id, dto: { isActive: !makeInactive } });
      showToast(
        makeInactive ? 'Marked as not needed' : 'Importer is active again',
        makeInactive
          ? `${importer.name} stays in this list but won't appear when creating invoices.`
          : `${importer.name} can be selected when creating invoices again.`,
        'success',
      );
    } catch (error) {
      showToast('Unable to update importer', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const saveDraft = () => {
    const now = new Date().toISOString();
    const draft: ImporterDraft = {
      id: editingDraftId ?? `draft-${Date.now()}`,
      createdAt: now,
      data: form,
    };

    const next = editingDraftId
      ? drafts.map((item) => (item.id === editingDraftId ? draft : item))
      : [draft, ...drafts];

    setDrafts(next);
    localStorage.setItem(importerDraftListKey, JSON.stringify(next));
    showToast('Draft saved', 'Draft importer added to the list.', 'success');
    closeForm();
  };

  const saveImporter = async () => {
    setSubmitError(null);

    const payload = buildPayload();
    const fieldErrors = validateForm(payload);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      showToast('Validation failed', 'Please fix the highlighted fields.', 'error');
      return;
    }

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, dto: payload });
        showToast('Importer updated', `${payload.name} was updated successfully.`, 'success');
      } else {
        await createMutation.mutateAsync(payload);
        showToast('Importer created', `${payload.name} is ready to use in invoices.`, 'success');
        if (editingDraftId) {
          const next = drafts.filter((item) => item.id !== editingDraftId);
          setDrafts(next);
          localStorage.setItem(importerDraftListKey, JSON.stringify(next));
        }
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Importers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage importer master data and route mappings</p>
        </div>
        <button
          onClick={openCreate}
          className="btn-brand self-start"
        >
          <Plus className="h-4 w-4" /> New Importer
        </button>
      </div>

      {!isLoading && !isError && (
        <ImporterStats total={summary.total} active={summary.active} inactive={summary.inactive} />
      )}

      {!isLoading && !isError && summary.total > 0 && (
        <ImporterFilters
          query={searchQuery}
          onQueryChange={changeSearch}
          status={statusFilter}
          onStatusChange={changeStatus}
          counts={{ all: summary.total, active: summary.active, inactive: summary.inactive }}
        />
      )}

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

      {!isLoading && !isError && summary.total === 0 && visibleDrafts.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">No importers found. Create one to start invoicing.</div>
      )}

      {!isLoading && !isError && summary.total > 0 && isFiltering && importers.length === 0 && visibleDrafts.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No importers match your search or filter.</p>
          <button onClick={() => { changeSearch(''); changeStatus('all'); }} className="mt-2 text-sm font-semibold underline">Clear filters</button>
        </div>
      )}

      {!isError && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visibleDrafts.map((draft) => (
          <ImporterCard
            key={draft.id}
            draft
            name={draft.data.name}
            buyerName={draft.data.buyerName}
            currency={draft.data.currency}
            address={draft.data.address}
            contact={draft.data.contact}
            email={draft.data.email}
            landing={draft.data.landingLocations}
            loading={draft.data.loadingLocations}
            footnote={`Draft saved ${new Date(draft.createdAt).toLocaleString()}`}
            editLabel="Edit draft"
            deleteLabel="Delete draft"
            onEdit={() => openDraft(draft)}
            onDelete={() => deleteDraft(draft.id)}
          />
        ))}

        {importers.map((importer) => (
          <ImporterCard
            key={importer.id}
            name={importer.name}
            inactive={importer.isActive === false}
            onToggleActive={() => toggleActive(importer)}
            buyerName={importer.buyerName}
            currency={importer.currency}
            address={importer.address}
            contact={importer.contact}
            email={importer.email}
            landing={importer.landingLocations}
            loading={importer.loadingLocations}
            editLabel="Edit importer"
            deleteLabel="Delete importer"
            onEdit={() => openEdit(importer)}
            onDelete={async () => {
              const ok = await confirm({
                title: `Delete ${importer.name}?`,
                message: 'The importer moves to the Recycle Bin and no longer shows up when creating invoices. Invoices already created are not changed.',
                confirmLabel: 'Delete',
                destructive: true,
              });
              if (!ok) return;
              try {
                await deleteMutation.mutateAsync(importer.id);
                showToast('Importer deleted', `${importer.name} was moved to the Recycle Bin.`, 'success');
              } catch (error) {
                showToast('Unable to delete importer', error instanceof Error ? error.message : 'Please try again.', 'error');
              }
            }}
          />
        ))}
      </div>}

      {!isError && meta && (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.limit} onPageChange={changePage} noun="importers" />
      )}

      {isFormOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-background w-full max-w-5xl max-h-[96dvh] sm:max-h-[94dvh] rounded-lg shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-center p-3 border-b shrink-0">
              <h2 className="text-base font-semibold text-center">{editing ? 'Edit Importer' : editingDraftId ? 'Edit Draft Importer' : 'New Importer'}</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-5">
            {submitError && <div className="text-sm text-destructive bg-destructive/5 border border-destructive/30 rounded-md px-3 py-2">{submitError}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name" value={form.name} error={errors['name']} onChange={(value) => { clearFieldError('name'); setForm((prev) => ({ ...prev, name: value })); }} />
              <Field label="Buyer Name (optional)" value={form.buyerName ?? ''} error={errors['buyerName']} onChange={(value) => { clearFieldError('buyerName'); setForm((prev) => ({ ...prev, buyerName: value })); }} />
              <Field label="Contact (optional)" value={form.contact ?? ''} error={errors['contact']} onChange={(value) => { clearFieldError('contact'); setForm((prev) => ({ ...prev, contact: value })); }} />
              <Field label="Email (optional)" value={form.email ?? ''} error={errors['email']} onChange={(value) => { clearFieldError('email'); setForm((prev) => ({ ...prev, email: value })); }} />
              <CurrencySelect label="Currency" value={form.currency} error={errors['currency']} onChange={(value) => { clearFieldError('currency'); setForm((prev) => ({ ...prev, currency: value })); }} />
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
                <div key={`landing-${index}`} className="relative grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 border rounded-md p-3 bg-muted/20">
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
                  <AirportSelect label="Port of Discharge" value={loc.portOfDischarge} onChange={(value) => setForm((prev) => ({
                    ...prev,
                    landingLocations: prev.landingLocations.map((item, i) => i === index ? { ...item, portOfDischarge: value } : item),
                  }))} error={errors[`landingLocations.${index}.portOfDischarge`]} />
                  <AirportSelect label="Final Destination" value={loc.finalDestination} onChange={(value) => setForm((prev) => ({
                    ...prev,
                    landingLocations: prev.landingLocations.map((item, i) => i === index ? { ...item, finalDestination: value } : item),
                  }))} error={errors[`landingLocations.${index}.finalDestination`]} />
                  <CountrySelect label="Country of Destination" value={loc.countryOfDestination} onChange={(value) => setForm((prev) => ({
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
                <div key={`loading-${index}`} className="relative grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 border rounded-md p-3 bg-muted/20">
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
                  <AirportSelect label="Port of Loading" value={loc.portOfLoading} onChange={(value) => setForm((prev) => ({
                    ...prev,
                    loadingLocations: prev.loadingLocations.map((item, i) => i === index ? { ...item, portOfLoading: value } : item),
                  }))} error={errors[`loadingLocations.${index}.portOfLoading`]} />
                  <CountrySelect label="Country of Origin" value={loc.countryOfOrigin} onChange={(value) => setForm((prev) => ({
                    ...prev,
                    loadingLocations: prev.loadingLocations.map((item, i) => i === index ? { ...item, countryOfOrigin: value } : item),
                  }))} error={errors[`loadingLocations.${index}.countryOfOrigin`]} />
                </div>
              ))}
            </LocationSection>

            </div>

            <div className="border-t bg-background/95 backdrop-blur-sm p-3 shrink-0">
              <div className="flex items-center justify-end gap-2 flex-wrap">
                <button onClick={closeForm} className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent shrink-0">Cancel</button>
                <button onClick={saveDraft} className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-accent shrink-0">
                  <Save className="h-3.5 w-3.5" /> Save Draft
                </button>
                <button
                  onClick={saveImporter}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-3 py-1.5 text-xs bg-[hsl(var(--brand-accent))] text-white rounded-md hover:opacity-90 disabled:opacity-50 shrink-0"
                >
                  {editing ? 'Save Importer' : 'Create Importer'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
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

interface PickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  common?: ComboOption[];
  error?: string | undefined;
  placeholder: string;
  searchPlaceholder: string;
  labelClassName?: string;
  loading?: boolean;
}

/** A labelled, searchable dropdown that looks like the text fields around it. */
function PickerField({ label, value, onChange, options, common, error, placeholder, searchPlaceholder, labelClassName, loading }: PickerFieldProps) {
  // a value saved earlier that isn't in the list (e.g. an old free-text entry) still shows when editing
  const withCurrent = value && !loading && !options.some((o) => o.value === value)
    ? [{ value, label: value }, ...options]
    : options;

  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <SearchCombobox
        value={value}
        onChange={onChange}
        options={withCurrent}
        {...(common ? { common } : {})}
        ariaLabel={label}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        {...(labelClassName ? { labelClassName } : {})}
        loading={!!loading}
        hasError={!!error}
        className="w-full border rounded-md px-3 py-2 text-sm bg-background focus-visible:ring-2"
      />
      {error ? <p className="text-xs text-destructive mt-1">{error}</p> : null}
    </div>
  );
}

interface SimplePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}

function CurrencySelect(props: SimplePickerProps) {
  const { common, all } = getCurrencyOptions();
  return (
    <PickerField
      {...props}
      options={all.map(toComboOption)}
      common={common.map(toComboOption)}
      placeholder="Select currency"
      searchPlaceholder="Search code or name, e.g. INR"
    />
  );
}

function AirportSelect(props: SimplePickerProps) {
  const airports = useAirportOptions();
  const common = airports ? COMMON_AIRPORT_CODES.map((c) => airports.find((a) => a.value === c)).filter((a): a is ComboOption => !!a) : [];
  return (
    <PickerField
      {...props}
      options={airports ?? []}
      common={common}
      loading={!airports}
      placeholder="Select airport code"
      searchPlaceholder="Code, city or airport, e.g. BOM or Mumbai"
      labelClassName="w-10"
    />
  );
}

function CountrySelect(props: SimplePickerProps) {
  return (
    <PickerField
      {...props}
      options={getCountryOptions()}
      placeholder="Select country"
      searchPlaceholder="Search country, e.g. India"
      labelClassName="w-auto"
    />
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
        <button onClick={onAdd} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[hsl(var(--brand-accent))] text-white hover:opacity-90 shadow-sm transition-all text-xs font-semibold">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
