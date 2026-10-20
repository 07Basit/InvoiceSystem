import { useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff, Pencil, Plus, ScrollText, Star, Trash2, X } from 'lucide-react';
import { DECLARATION_MAX_CHARS, declarationProfileSchema } from 'shared';
import { useDeclarationProfileMutations, useDeclarationProfiles } from '@/features/invoices/hooks/useDeclarationProfiles';
import type { DeclarationProfile } from '@/features/invoices/services/declarationService';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm';
import Tooltip from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface FormState { name: string; text: string }
const empty: FormState = { name: '', text: '' };

/** Create and manage the declaration wordings that invoices pick from. */
export default function DeclarationProfilesSection() {
  const { data, isLoading, isError } = useDeclarationProfiles();
  const { create, update, setDefault, setActive, remove } = useDeclarationProfileMutations();
  const { showToast } = useToast();
  const confirm = useConfirm();

  // null = form closed, 'new' = adding, otherwise the id being edited
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const profiles = data?.data ?? [];
  const saving = create.isPending || update.isPending;

  const open = (profile?: DeclarationProfile) => {
    setErrors({});
    setForm(profile ? { name: profile.name, text: profile.text } : empty);
    setEditing(profile ? profile.id : 'new');
  };
  const close = () => { setEditing(null); setErrors({}); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = declarationProfileSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => { const k = String(issue.path[0]); if (!next[k]) next[k] = issue.message; });
      setErrors(next);
      return;
    }
    try {
      if (editing === 'new') await create.mutateAsync(parsed.data);
      else if (editing) await update.mutateAsync({ id: editing, dto: parsed.data });
      showToast(editing === 'new' ? 'Declaration added' : 'Declaration updated', parsed.data.name, 'success');
      close();
    } catch (err) {
      showToast('Unable to save declaration', err instanceof Error ? err.message : 'Please try again.', 'error');
    }
  };

  const makeDefault = async (profile: DeclarationProfile) => {
    try {
      await setDefault.mutateAsync(profile.id);
      showToast('Default declaration changed', `New invoices will start with ${profile.name}.`, 'success');
    } catch {
      showToast('Unable to change default', 'Please try again.', 'error');
    }
  };

  const toggleActive = async (profile: DeclarationProfile) => {
    const makeInactive = profile.isActive;
    try {
      await setActive.mutateAsync({ id: profile.id, isActive: !makeInactive });
      showToast(makeInactive ? 'Marked as not needed' : 'Declaration is active again', makeInactive ? `${profile.name} won't be offered on new invoices.` : `${profile.name} can be picked on invoices again.`, 'success');
    } catch {
      showToast('Unable to update declaration', 'Please try again.', 'error');
    }
  };

  const askRemove = async (profile: DeclarationProfile) => {
    const ok = await confirm({
      title: `Delete ${profile.name}?`,
      message: 'Existing invoices keep their own copy of this wording. Only the saved declaration is removed.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(profile.id);
      showToast('Declaration deleted', profile.name, 'success');
    } catch {
      showToast('Unable to delete declaration', 'Please try again.', 'error');
    }
  };

  return (
    <section className="card-enterprise">
      <div className="px-5 py-4 border-b flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Declarations</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            The declaration printed on invoices. Pick one on the invoice form; the default is preselected for new invoices, and you can still edit the wording there.
          </p>
        </div>
        {editing === null && (
          <button type="button" onClick={() => open()} className="btn-brand shrink-0"><Plus className="h-4 w-4" /> Add declaration</button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {editing !== null && (
          <form onSubmit={submit} className="rounded-lg border p-4 space-y-4" aria-label={editing === 'new' ? 'New declaration' : 'Edit declaration'} noValidate>
            <div>
              <label className="label" htmlFor="dc-name">Name</label>
              <input id="dc-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" placeholder="e.g. Standard declaration" aria-invalid={errors['name'] ? true : undefined} />
              {errors['name'] ? <p className="err">{errors['name']}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="dc-text">Declaration text</label>
              <textarea id="dc-text" rows={5} maxLength={DECLARATION_MAX_CHARS} value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} className="input resize-y leading-relaxed" aria-invalid={errors['text'] ? true : undefined} />
              <p className="mt-1 text-[11px] text-muted-foreground">Press Enter for a new line. {form.text.length}/{DECLARATION_MAX_CHARS}</p>
              {errors['text'] ? <p className="err">{errors['text']}</p> : null}
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50"><Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save declaration'}</button>
              <button type="button" onClick={close} className="btn-ghost"><X className="h-4 w-4" /> Cancel</button>
            </div>
          </form>
        )}

        {isLoading && <div className="flex justify-center py-8"><LoadingSpinner variant="exporter" message="Loading declarations…" /></div>}
        {isError && <p className="text-sm text-destructive">Failed to load declarations.</p>}
        {!isLoading && !isError && profiles.length === 0 && editing === null && (
          <div className="text-center py-6">
            <ScrollText className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-semibold mt-2">No declarations yet</p>
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
                <p className="text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-3">{profile.text}</p>
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
                <Tooltip label="Edit"><button type="button" aria-label={`Edit ${profile.name}`} onClick={() => open(profile)} className="btn-ghost !p-2"><Pencil className="h-4 w-4" /></button></Tooltip>
                <Tooltip label="Delete"><button type="button" aria-label={`Delete ${profile.name}`} onClick={() => askRemove(profile)} className="btn-ghost !p-2 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></button></Tooltip>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
