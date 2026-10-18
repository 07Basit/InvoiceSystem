import { useState, type FormEvent } from 'react';
import { Building2, Check, Eye, EyeOff, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exporterProfileSchema } from 'shared';
import { useExporterProfileMutations, useExporterProfiles } from '@/features/invoices/hooks/useExporterProfiles';
import type { ExporterProfile } from '@/features/invoices/services/exporterService';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm';
import Tooltip from '@/components/ui/Tooltip';
import { ApiClientError } from '@/services/api';

interface FormState { name: string; address: string; contact: string; email: string }
const empty: FormState = { name: '', address: '', contact: '', email: '' };

/** Create and manage the exporter profiles that invoices pick from. */
export default function ExporterProfilesSection() {
  const { data, isLoading, isError } = useExporterProfiles();
  const { create, update, setDefault, setActive, remove } = useExporterProfileMutations();
  const { showToast } = useToast();
  const confirm = useConfirm();

  // null = form closed, 'new' = adding, otherwise the id being edited
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const profiles = data?.data ?? [];
  const saving = create.isPending || update.isPending;

  const open = (profile?: ExporterProfile) => {
    setErrors({});
    setForm(profile ? { name: profile.name, address: profile.address, contact: profile.contact, email: profile.email ?? '' } : empty);
    setEditing(profile ? profile.id : 'new');
  };
  const close = () => { setEditing(null); setErrors({}); };
  const set = (field: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = exporterProfileSchema.safeParse({ ...form, email: form.email.trim() || undefined });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => { const k = String(issue.path[0]); if (!next[k]) next[k] = issue.message; });
      setErrors(next);
      return;
    }
    try {
      if (editing === 'new') await create.mutateAsync(parsed.data);
      else if (editing) await update.mutateAsync({ id: editing, dto: parsed.data });
      showToast(editing === 'new' ? 'Exporter profile added' : 'Exporter profile updated', parsed.data.name, 'success');
      close();
    } catch (err) {
      showToast('Unable to save exporter profile', err instanceof ApiClientError || err instanceof Error ? err.message : 'Please try again.', 'error');
    }
  };

  const makeDefault = async (profile: ExporterProfile) => {
    try {
      await setDefault.mutateAsync(profile.id);
      showToast('Default exporter changed', `New invoices will start with ${profile.name}.`, 'success');
    } catch {
      showToast('Unable to change default', 'Please try again.', 'error');
    }
  };

  const toggleActive = async (profile: ExporterProfile) => {
    const makeInactive = profile.isActive;
    try {
      await setActive.mutateAsync({ id: profile.id, isActive: !makeInactive });
      showToast(makeInactive ? 'Marked as not needed' : 'Exporter profile is active again', makeInactive ? `${profile.name} won't be offered on new invoices.` : `${profile.name} can be picked on invoices again.`, 'success');
    } catch {
      showToast('Unable to update exporter profile', 'Please try again.', 'error');
    }
  };

  const askRemove = async (profile: ExporterProfile) => {
    const ok = await confirm({
      title: `Delete ${profile.name}?`,
      message: 'Existing invoices keep their own copy of these details. Only the saved profile is removed.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(profile.id);
      showToast('Exporter profile deleted', profile.name, 'success');
    } catch {
      showToast('Unable to delete exporter profile', 'Please try again.', 'error');
    }
  };

  return (
    <section className="card-enterprise">
      <div className="px-5 py-4 border-b flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Exporter profiles</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your company details for invoices. Pick one on the invoice form; the default is preselected for new invoices.
          </p>
        </div>
        {editing === null && (
          <button type="button" onClick={() => open()} className="btn-brand shrink-0"><Plus className="h-4 w-4" /> Add profile</button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {editing !== null && (
          <form onSubmit={submit} className="rounded-lg border p-4 space-y-4" aria-label={editing === 'new' ? 'New exporter profile' : 'Edit exporter profile'} noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="ex-name" label="Exporter name" value={form.name} onChange={set('name')} error={errors['name']} />
              <Field id="ex-contact" label="Contact" value={form.contact} onChange={set('contact')} error={errors['contact']} />
              <div className="sm:col-span-2">
                <Field id="ex-address" label="Address" value={form.address} onChange={set('address')} error={errors['address']} />
              </div>
              <div className="sm:col-span-2">
                <Field id="ex-email" label="Email (optional)" type="email" value={form.email} onChange={set('email')} error={errors['email']} />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50"><Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save profile'}</button>
              <button type="button" onClick={close} className="btn-ghost"><X className="h-4 w-4" /> Cancel</button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Loading exporter profiles…</p>}
        {isError && <p className="text-sm text-destructive">Failed to load exporter profiles.</p>}
        {!isLoading && !isError && profiles.length === 0 && editing === null && (
          <div className="text-center py-6">
            <Building2 className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-semibold mt-2">No exporter profiles yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add one so it can be picked when you create an invoice.</p>
          </div>
        )}

        <ul className="space-y-3">
          {profiles.map((profile) => (
            <li key={profile.id} className={cn('rounded-lg border p-4 flex items-start justify-between gap-3', !profile.isActive && 'bg-muted/40 border-dashed')}>
              <div className={cn('min-w-0 text-sm', !profile.isActive && 'opacity-60')}>
                <p className="font-semibold truncate">
                  {profile.name}
                  {profile.isDefault && (
                    <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">Default</span>
                  )}
                </p>
                <p className="text-muted-foreground mt-0.5 break-words">{profile.address}</p>
                <p className="text-muted-foreground">{profile.contact}{profile.email ? ` · ${profile.email}` : ''}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!profile.isActive && (
                  <span className="mr-1 self-center text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">Not needed</span>
                )}
                {!profile.isDefault && profile.isActive && (
                  <Tooltip label="Make default">
                    <button type="button" aria-label={`Make ${profile.name} the default`} onClick={() => makeDefault(profile)} className="btn-ghost !p-2"><Star className="h-4 w-4" /></button>
                  </Tooltip>
                )}
                <Tooltip label={profile.isActive ? 'Mark as not needed (hide from invoice dropdown)' : 'Inactive. Click to make active again'}>
                  <button type="button" aria-label={profile.isActive ? `Mark ${profile.name} as not needed` : `Make ${profile.name} active again`} onClick={() => toggleActive(profile)} className="btn-ghost !p-2">
                    {profile.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-emerald-600" />}
                  </button>
                </Tooltip>
                <Tooltip label="Edit">
                  <button type="button" aria-label={`Edit ${profile.name}`} onClick={() => open(profile)} className="btn-ghost !p-2"><Pencil className="h-4 w-4" /></button>
                </Tooltip>
                <Tooltip label="Delete">
                  <button type="button" aria-label={`Delete ${profile.name}`} onClick={() => askRemove(profile)} className="btn-ghost !p-2 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </Tooltip>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Field({ id, label, value, onChange, error, type = 'text' }: {
  id: string; label: string; value: string; onChange: (v: string) => void; error: string | undefined; type?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input" aria-invalid={error ? true : undefined} />
      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}
