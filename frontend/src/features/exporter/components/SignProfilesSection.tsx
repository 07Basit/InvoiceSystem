import { useRef, useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff, ImagePlus, PenLine, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { signProfileSchema } from 'shared';
import { useSignProfileMutations, useSignProfiles } from '@/features/invoices/hooks/useSignProfiles';
import type { SignProfile } from '@/features/invoices/services/signService';
import { fileToSignDataUrl } from '@/lib/image';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm';
import Tooltip from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

/** Create and manage the seal & sign images that invoices pick from. */
export default function SignProfilesSection() {
  const { data, isLoading, isError } = useSignProfiles();
  const { create, update, setDefault, setActive, remove } = useSignProfileMutations();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  // null = form closed, 'new' = adding, otherwise the id being edited
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reading, setReading] = useState(false);

  const profiles = data?.data ?? [];
  const saving = create.isPending || update.isPending;

  const open = (profile?: SignProfile) => {
    setErrors({});
    setName(profile?.name ?? '');
    setImage(profile?.image ?? '');
    setEditing(profile ? profile.id : 'new');
  };
  const close = () => { setEditing(null); setErrors({}); };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setErrors((e) => ({ ...e, image: '' }));
    setReading(true);
    try {
      setImage(await fileToSignDataUrl(file));
    } catch (err) {
      setErrors((e) => ({ ...e, image: err instanceof Error ? err.message : 'Could not use that image.' }));
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = signProfileSchema.safeParse({ name, image });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => { const k = String(issue.path[0]); if (!next[k]) next[k] = k === 'image' && !image ? 'Choose an image.' : issue.message; });
      setErrors(next);
      return;
    }
    try {
      if (editing === 'new') await create.mutateAsync(parsed.data);
      else if (editing) await update.mutateAsync({ id: editing, dto: parsed.data });
      showToast(editing === 'new' ? 'Seal & sign added' : 'Seal & sign updated', parsed.data.name, 'success');
      close();
    } catch (err) {
      showToast('Unable to save seal & sign', err instanceof Error ? err.message : 'Please try again.', 'error');
    }
  };

  const makeDefault = async (profile: SignProfile) => {
    try {
      await setDefault.mutateAsync(profile.id);
      showToast('Default seal & sign changed', `New invoices will start with ${profile.name}.`, 'success');
    } catch {
      showToast('Unable to change default', 'Please try again.', 'error');
    }
  };

  const toggleActive = async (profile: SignProfile) => {
    const makeInactive = profile.isActive;
    try {
      await setActive.mutateAsync({ id: profile.id, isActive: !makeInactive });
      showToast(makeInactive ? 'Marked as not needed' : 'Seal & sign is active again', makeInactive ? `${profile.name} won't be offered on new invoices.` : `${profile.name} can be picked on invoices again.`, 'success');
    } catch {
      showToast('Unable to update seal & sign', 'Please try again.', 'error');
    }
  };

  const askRemove = async (profile: SignProfile) => {
    const ok = await confirm({
      title: `Delete ${profile.name}?`,
      message: 'Existing invoices keep their own copy of this image. Only the saved profile is removed.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(profile.id);
      showToast('Seal & sign deleted', profile.name, 'success');
    } catch {
      showToast('Unable to delete seal & sign', 'Please try again.', 'error');
    }
  };

  return (
    <section className="card-enterprise">
      <div className="px-5 py-4 border-b flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Seal &amp; Sign</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Images printed at the foot of invoices. Pick one on the invoice form; the default is preselected for new invoices.
          </p>
        </div>
        {editing === null && (
          <button type="button" onClick={() => open()} className="btn-brand shrink-0"><Plus className="h-4 w-4" /> Add seal &amp; sign</button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {editing !== null && (
          <form onSubmit={submit} className="rounded-lg border p-4 space-y-4" aria-label={editing === 'new' ? 'New seal and sign' : 'Edit seal and sign'} noValidate>
            <div>
              <label className="label" htmlFor="sg-name">Name</label>
              <input id="sg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Proprietor sign, Company seal" className="input" aria-invalid={errors['name'] ? true : undefined} />
              {errors['name'] ? <p className="err">{errors['name']}</p> : null}
            </div>
            <div>
              <span className="label">Image</span>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-24 w-56 items-center justify-center rounded-md border border-dashed bg-muted/30">
                  {image ? <img src={image} alt="Seal and sign preview" className="max-h-20 max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No image yet</span>}
                </div>
                <div>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Seal and sign image file" onChange={(e) => pickFile(e.target.files?.[0])} />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={reading} className="btn-ghost"><ImagePlus className="h-4 w-4" /> {reading ? 'Reading…' : image ? 'Replace image' : 'Choose image'}</button>
                  <p className="mt-1 text-[11px] text-muted-foreground">PNG, JPEG or WebP. A transparent PNG looks best.<br />It is resized automatically.</p>
                </div>
              </div>
              {errors['image'] ? <p className="err">{errors['image']}</p> : null}
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving || reading} className="btn-brand disabled:opacity-50"><Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save seal & sign'}</button>
              <button type="button" onClick={close} className="btn-ghost"><X className="h-4 w-4" /> Cancel</button>
            </div>
          </form>
        )}

        {isLoading && <div className="flex justify-center py-8"><LoadingSpinner variant="exporter" message="Loading seals &amp; signs…" /></div>}
        {isError && <p className="text-sm text-destructive">Failed to load seals &amp; signs.</p>}
        {!isLoading && !isError && profiles.length === 0 && editing === null && (
          <div className="text-center py-6">
            <PenLine className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-semibold mt-2">No seal &amp; sign yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add one so it can be picked when you create an invoice.</p>
          </div>
        )}

        <ul className="space-y-3">
          {profiles.map((profile) => (
            <li key={profile.id} className={cn('rounded-lg border p-4 flex items-center justify-between gap-3', !profile.isActive && 'bg-muted/40 border-dashed')}>
              <div className={cn('flex min-w-0 items-center gap-4', !profile.isActive && 'opacity-60')}>
                <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-md border bg-white">
                  <img src={profile.image} alt={`${profile.name} preview`} className="max-h-14 max-w-full object-contain" />
                </div>
                <p className="min-w-0 truncate text-sm font-semibold">
                  {profile.name}
                  {profile.isDefault && (
                    <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">Default</span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!profile.isActive && (
                  <span className="mr-1 self-center text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">Not needed</span>
                )}
                {!profile.isDefault && profile.isActive && (
                  <Tooltip label="Make default">
                    <button type="button" aria-label={`Make ${profile.name} the default seal and sign`} onClick={() => makeDefault(profile)} className="btn-ghost !p-2"><Star className="h-4 w-4" /></button>
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
