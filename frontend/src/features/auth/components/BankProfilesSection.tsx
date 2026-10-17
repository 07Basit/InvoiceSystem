import { useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff, Landmark, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { bankProfileSchema } from 'shared';
import { useBankProfileMutations, useBankProfiles } from '@/features/invoices/hooks/useBankProfiles';
import type { BankProfile } from '@/features/invoices/services/bankService';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm';
import Tooltip from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';

interface FormState { bankName: string; accountNumber: string; ifscCode: string; swiftCode: string }
const empty: FormState = { bankName: '', accountNumber: '', ifscCode: '', swiftCode: '' };

/** "HDFC BANK · ••••2323": enough to tell accounts apart without printing the full number everywhere. */
export const bankLabel = (p: { bankName: string; accountNumber: string }) => `${p.bankName} · ••••${p.accountNumber.slice(-4)}`;

/** Create and manage the bank accounts that invoices pick from. */
export default function BankProfilesSection() {
  const { data, isLoading, isError } = useBankProfiles();
  const { create, update, setDefault, setActive, remove } = useBankProfileMutations();
  const { showToast } = useToast();
  const confirm = useConfirm();

  // null = form closed, 'new' = adding, otherwise the id being edited
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const profiles = data?.data ?? [];
  const saving = create.isPending || update.isPending;

  const open = (profile?: BankProfile) => {
    setErrors({});
    setForm(profile ? { bankName: profile.bankName, accountNumber: profile.accountNumber, ifscCode: profile.ifscCode ?? '', swiftCode: profile.swiftCode ?? '' } : empty);
    setEditing(profile ? profile.id : 'new');
  };
  const close = () => { setEditing(null); setErrors({}); };
  const set = (field: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = bankProfileSchema.safeParse({ ...form, ifscCode: form.ifscCode.trim() || undefined, swiftCode: form.swiftCode.trim() || undefined });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => { const k = String(issue.path[0]); if (!next[k]) next[k] = issue.message; });
      setErrors(next);
      return;
    }
    try {
      if (editing === 'new') await create.mutateAsync(parsed.data);
      else if (editing) await update.mutateAsync({ id: editing, dto: parsed.data });
      showToast(editing === 'new' ? 'Bank account added' : 'Bank account updated', parsed.data.bankName, 'success');
      close();
    } catch (err) {
      showToast('Unable to save bank account', err instanceof Error ? err.message : 'Please try again.', 'error');
    }
  };

  const makeDefault = async (profile: BankProfile) => {
    try {
      await setDefault.mutateAsync(profile.id);
      showToast('Default bank changed', `New invoices will start with ${profile.bankName}.`, 'success');
    } catch {
      showToast('Unable to change default', 'Please try again.', 'error');
    }
  };

  const toggleActive = async (profile: BankProfile) => {
    const makeInactive = profile.isActive;
    try {
      await setActive.mutateAsync({ id: profile.id, isActive: !makeInactive });
      showToast(makeInactive ? 'Marked as not needed' : 'Bank account is active again', makeInactive ? `${profile.bankName} won't be offered on new invoices.` : `${profile.bankName} can be picked on invoices again.`, 'success');
    } catch {
      showToast('Unable to update bank account', 'Please try again.', 'error');
    }
  };

  const askRemove = async (profile: BankProfile) => {
    const ok = await confirm({
      title: `Delete ${profile.bankName}?`,
      message: 'Existing invoices keep their own copy of these bank details. Only the saved account is removed.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(profile.id);
      showToast('Bank account deleted', profile.bankName, 'success');
    } catch {
      showToast('Unable to delete bank account', 'Please try again.', 'error');
    }
  };

  return (
    <section className="card-enterprise">
      <div className="px-5 py-4 border-b flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Bank accounts</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            The bank details printed on invoices. Pick one on the invoice form; the default is preselected for new invoices.
          </p>
        </div>
        {editing === null && (
          <button type="button" onClick={() => open()} className="btn-brand shrink-0"><Plus className="h-4 w-4" /> Add account</button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {editing !== null && (
          <form onSubmit={submit} className="rounded-lg border p-4 space-y-4" aria-label={editing === 'new' ? 'New bank account' : 'Edit bank account'} noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="bk-name" label="Bank name" value={form.bankName} onChange={set('bankName')} error={errors['bankName']} />
              <Field id="bk-account" label="Account number" value={form.accountNumber} onChange={set('accountNumber')} error={errors['accountNumber']} />
              <Field id="bk-ifsc" label="IFSC code (optional)" value={form.ifscCode} onChange={set('ifscCode')} error={errors['ifscCode']} />
              <Field id="bk-swift" label="SWIFT code (optional)" value={form.swiftCode} onChange={set('swiftCode')} error={errors['swiftCode']} />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50"><Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save account'}</button>
              <button type="button" onClick={close} className="btn-ghost"><X className="h-4 w-4" /> Cancel</button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Loading bank accounts…</p>}
        {isError && <p className="text-sm text-destructive">Failed to load bank accounts.</p>}
        {!isLoading && !isError && profiles.length === 0 && editing === null && (
          <div className="text-center py-6">
            <Landmark className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-semibold mt-2">No bank accounts yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add one so it can be picked when you create an invoice.</p>
          </div>
        )}

        <ul className="space-y-3">
          {profiles.map((profile) => (
            <li key={profile.id} className={cn('rounded-lg border p-4 flex items-start justify-between gap-3', !profile.isActive && 'bg-muted/40 border-dashed')}>
              <div className={cn('min-w-0 text-sm', !profile.isActive && 'opacity-60')}>
                <p className="font-semibold truncate">
                  {profile.bankName}
                  {profile.isDefault && (
                    <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">Default</span>
                  )}
                </p>
                <p className="text-muted-foreground mt-0.5">A/C {profile.accountNumber}</p>
                <p className="text-muted-foreground">
                  {[profile.ifscCode && `IFSC ${profile.ifscCode}`, profile.swiftCode && `SWIFT ${profile.swiftCode}`].filter(Boolean).join(' · ') || 'No IFSC or SWIFT code'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!profile.isActive && (
                  <span className="mr-1 self-center text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">Not needed</span>
                )}
                {!profile.isDefault && profile.isActive && (
                  <Tooltip label="Make default">
                    <button type="button" aria-label={`Make ${profile.bankName} ending ${profile.accountNumber.slice(-4)} the default`} onClick={() => makeDefault(profile)} className="btn-ghost !p-2"><Star className="h-4 w-4" /></button>
                  </Tooltip>
                )}
                <Tooltip label={profile.isActive ? 'Mark as not needed (hide from invoice dropdown)' : 'Inactive. Click to make active again'}>
                  <button type="button" aria-label={profile.isActive ? `Mark ${profile.bankName} ending ${profile.accountNumber.slice(-4)} as not needed` : `Make ${profile.bankName} ending ${profile.accountNumber.slice(-4)} active again`} onClick={() => toggleActive(profile)} className="btn-ghost !p-2">
                    {profile.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-emerald-600" />}
                  </button>
                </Tooltip>
                <Tooltip label="Edit">
                  <button type="button" aria-label={`Edit ${profile.bankName} ending ${profile.accountNumber.slice(-4)}`} onClick={() => open(profile)} className="btn-ghost !p-2"><Pencil className="h-4 w-4" /></button>
                </Tooltip>
                <Tooltip label="Delete">
                  <button type="button" aria-label={`Delete ${profile.bankName} ending ${profile.accountNumber.slice(-4)}`} onClick={() => askRemove(profile)} className="btn-ghost !p-2 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </Tooltip>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Field({ id, label, value, onChange, error }: { id: string; label: string; value: string; onChange: (v: string) => void; error: string | undefined }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input" aria-invalid={error ? true : undefined} />
      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}
