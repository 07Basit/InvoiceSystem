import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, TrendingUp, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import LoginIllustration from '../components/LoginIllustration';
import { ApiClientError } from '@/services/api';

export default function LoginPage() {
  const status = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') return <Navigate to={from} replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login({ username: username.trim(), password, rememberMe });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to sign in. Please try again.');
      setPassword('');
      setSubmitting(false);
    }
  };

  return (
    <div className="login-bg min-h-dvh grid lg:grid-cols-2">
      <LoginBackdrop />

      {/* Brand message — desktop only, sits directly on the background */}
      <div className="hidden lg:flex flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[hsl(var(--brand-accent))] flex items-center justify-center shadow-lg shadow-orange-500/30">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">InvoiceManager</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-4xl font-bold leading-tight">Export invoicing, kept simple.</h2>
          <p className="mt-4 text-white/70 leading-relaxed">
            Create invoices, manage importers and download ready-to-send PDF and Excel files — all in one place.
          </p>
        </div>
        <p className="text-xs text-white/40">Management System v1.0.0</p>
      </div>

      {/* Form card */}
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-6 text-white">
            <div className="h-9 w-9 rounded-lg bg-[hsl(var(--brand-accent))] flex items-center justify-center shadow-lg shadow-orange-500/30">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold tracking-tight">InvoiceManager</span>
          </div>

          <div className="rounded-2xl border border-white/15 bg-card/90 backdrop-blur-xl shadow-2xl shadow-black/30 p-6 sm:p-8">
            <h1 className="text-2xl font-bold">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter your username and password to continue.</p>

            <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
              {error ? (
                <div role="alert" className="text-sm text-destructive bg-destructive/5 border border-destructive/30 rounded-lg px-3 py-2.5">
                  {error}
                </div>
              ) : null}

              <div>
                <label htmlFor="username" className="label">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input !py-2.5 pl-9"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input !py-2.5 pl-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 btn-icon !p-1.5"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
                />
                Keep me signed in for 7 days
              </label>

              <button type="submit" disabled={submitting} className="btn-brand w-full !py-2.5 disabled:opacity-60">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Decorative layers behind the login form: glowing orbs plus the vector illustration. */
function LoginBackdrop() {
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none">
      <span className="login-orb login-orb-1" />
      <span className="login-orb login-orb-2" />
      <span className="login-orb login-orb-3" />
      <LoginIllustration />
    </div>
  );
}
