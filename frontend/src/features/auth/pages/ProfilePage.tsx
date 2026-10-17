import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Eye, EyeOff, LogOut, ShieldCheck } from 'lucide-react';
import { changePasswordSchema } from 'shared';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { userInitial } from '../components/UserMenu';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm';
import { ApiClientError } from '@/services/api';
import ExporterProfilesSection from '../components/ExporterProfilesSection';
import BankProfilesSection from '../components/BankProfilesSection';
import SignProfilesSection from '../components/SignProfilesSection';

const dateTime = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '';

export default function ProfilePage() {
  const { user, rememberMe, expiresAt, setUser, applySession, logout } = useAuthStore();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) return null;

  const profileDirty = displayName.trim() !== user.displayName || email.trim() !== (user.email ?? '');

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setProfileErrors({});
    setSavingProfile(true);
    try {
      const updated = await authService.updateProfile({ displayName, email: email.trim() });
      setUser(updated);
      setDisplayName(updated.displayName);
      setEmail(updated.email ?? '');
      showToast('Profile updated', 'Your details were saved.', 'success');
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        const next: Record<string, string> = {};
        Object.entries(err.details).forEach(([key, msgs]) => { next[key] = msgs[0] ?? 'Invalid value'; });
        setProfileErrors(next);
      } else {
        showToast('Unable to save profile', err instanceof Error ? err.message : 'Please try again.', 'error');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      setPasswordError(parsed.error.issues[0]?.message ?? 'Invalid password.');
      return;
    }
    setSavingPassword(true);
    try {
      applySession(await authService.changePassword(parsed.data));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password changed', 'Other devices have been signed out.', 'success');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Unable to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const signOutEverywhere = async () => {
    const ok = await confirm({
      title: 'Sign out of all devices?',
      message: 'This signs you out everywhere, including this device.',
      confirmLabel: 'Sign out everywhere',
      destructive: true,
    });
    if (!ok) return;
    try {
      await authService.signOutEverywhere();
    } finally {
      signOut();
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account, exporter profiles, bank accounts, seal & sign and security</p>
      </div>

      {/* Identity */}
      <div className="card-enterprise p-5 flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-[hsl(var(--primary))] text-white flex items-center justify-center text-2xl font-bold shrink-0">
          {userInitial(user.displayName)}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold truncate">{user.displayName}</p>
          <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
          <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
            <ShieldCheck className="h-3 w-3" /> {user.role}
          </span>
        </div>
      </div>

      {/* Account details */}
      <Card title="Account details" description="Your username can't be changed.">
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="p-username">Username</label>
              <input id="p-username" value={user.username} readOnly className="input bg-muted/40" />
            </div>
            <div>
              <label className="label" htmlFor="p-name">Display name</label>
              <input id="p-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input" />
              {profileErrors['displayName'] ? <p className="err">{profileErrors['displayName']}</p> : null}
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="p-email">Email (optional)</label>
              <input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
              {profileErrors['email'] ? <p className="err">{profileErrors['email']}</p> : null}
            </div>
          </div>
          <button type="submit" disabled={!profileDirty || savingProfile} className="btn-brand disabled:opacity-50">
            <Check className="h-4 w-4" /> {savingProfile ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </Card>

      {/* Exporter profiles */}
      <ExporterProfilesSection />

      {/* Bank accounts */}
      <BankProfilesSection />

      {/* Seal & sign */}
      <SignProfilesSection />

      {/* Password */}
      <Card title="Change password" description="At least 8 characters, with a letter and a number. Other devices are signed out when you change it.">
        <form onSubmit={savePassword} className="space-y-4" autoComplete="off">
          {passwordError ? (
            <div role="alert" className="text-sm text-destructive bg-destructive/5 border border-destructive/30 rounded-lg px-3 py-2">{passwordError}</div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="p-current">Current password</label>
              <input id="p-current" type={showPasswords ? 'text' : 'password'} autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="p-new">New password</label>
              <input id="p-new" type={showPasswords ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="p-confirm">Confirm new password</label>
              <input id="p-confirm" type={showPasswords ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!currentPassword || !newPassword || savingPassword} className="btn-brand disabled:opacity-50">
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
            <button type="button" onClick={() => setShowPasswords((v) => !v)} className="btn-ghost">
              {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPasswords ? 'Hide' : 'Show'} passwords
            </button>
          </div>
        </form>
      </Card>

      {/* Session */}
      <Card title="Session" description="Where and how long you're signed in.">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Info label="Sign-in type" value={rememberMe ? 'Kept signed in (7 days)' : 'This browser session only'} />
          <Info label="Session expires" value={dateTime(expiresAt)} />
          <Info label="Last sign-in" value={dateTime(user.lastLoginAt)} />
          <Info label="Account created" value={dateTime(user.createdAt)} />
        </dl>
        <div className="flex flex-wrap gap-3 mt-5">
          <button onClick={signOut} className="btn-ghost"><LogOut className="h-4 w-4" /> Sign out</button>
          <button onClick={signOutEverywhere} className="btn-ghost text-destructive hover:text-destructive">
            Sign out of all devices
          </button>
        </div>
      </Card>
    </div>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card-enterprise">
      <div className="px-5 py-4 border-b">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground mt-0.5">{description}</p> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium mt-0.5">{value}</dd>
    </div>
  );
}
