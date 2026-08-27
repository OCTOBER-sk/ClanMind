import React, { useState } from 'react';
import clanmindMark from '@/assets/brand/clanmind-mark.png';
import { Button } from '@/design-system/components/Button';
import { Input } from '@/design-system/components/Input';
import { ApiError } from '@/api/errors';
import { useGroupStore } from '@/state/useGroupStore';
import {
  establishSession,
  getSessionGateway,
} from '@/features/auth/session';

type AuthView = 'first_launch' | 'login' | 'signup' | 'forgot_password';

/** §67-69: Authentication screens and first launch experience */
export function AuthScreen() {
  const [view, setView] = useState<AuthView>('first_launch');
  const { groups } = useGroupStore();

  // §196: returners go straight to login (derived — no state-in-effect)
  const effectiveView: AuthView = view === 'first_launch' && groups.length > 0 ? 'login' : view;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--color-background)] text-[var(--color-text)] select-none overflow-auto">
      <div className="w-full max-w-sm px-6">
        {effectiveView === 'first_launch' && (
          <FirstLaunchView
            onLogin={() => setView('login')}
            onSignup={() => setView('signup')}
          />
        )}
        {effectiveView === 'login' && (
          <LoginView
            onSignup={() => setView('signup')}
            onForgotPassword={() => setView('forgot_password')}
          />
        )}
        {effectiveView === 'signup' && <SignupView onLogin={() => setView('login')} />}
        {effectiveView === 'forgot_password' && (
          <ForgotPasswordView onBack={() => setView('login')} />
        )}
      </div>
    </div>
  );
}

// ─── First Launch — §69 ───

function FirstLaunchView({
  onLogin,
  onSignup,
}: {
  onLogin: () => void;
  onSignup: () => void;
}) {
  return (
    <div className="text-center space-y-8 animate-[fade-in_300ms_ease-out]">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <img
          src={clanmindMark}
          alt="ClanMind"
          className="h-10 w-auto dark:invert"
        />
        {/* Spectral accent line — §69 */}
        <div className="h-px w-32 spectral-active rounded-full opacity-60" />
      </div>

      {/* Hero — §69 */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
          A shared project room
          <br />
          for people + AI.
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Think together, research together, turn conversation into decisions and code.
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <Button variant="primary" size="lg" className="w-full" onClick={onSignup}>
          Create an account
        </Button>
        <Button variant="ghost" size="lg" className="w-full" onClick={onLogin}>
          Sign in
        </Button>
      </div>
    </div>
  );
}

// ─── Login — §67 ───

interface AuthFormState {
  email: string;
  password: string;
  error: string | null;
  loading: boolean;
}

function LoginView({
  onSignup,
  onForgotPassword,
}: {
  onSignup: () => void;
  onForgotPassword: () => void;
}) {
  const [form, setForm] = useState<AuthFormState>({
    email: '',
    password: '',
    error: null,
    loading: false,
  });
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (!form.email.trim()) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address.';
    if (!form.password) errors.password = 'Password is required.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setForm((f) => ({ ...f, loading: true, error: null }));
    try {
      const identity = await getSessionGateway().signIn(form.email.trim(), form.password);
      await establishSession(identity);
    } catch (err) {
      setForm((f) => ({
        ...f,
        loading: false,
        error:
          err instanceof ApiError && err.code === 'AUTH_INVALID_CREDENTIALS'
            ? "Couldn't sign in. Check your email and password."
            : "Couldn't sign in right now. Try again.",
      }));
      return;
    }
    setForm((f) => ({ ...f, loading: false }));
  };

  const canSubmit = form.email.trim().length > 0 && form.password.length > 0 && !form.loading;

  return (
    <div className="space-y-6 animate-[fade-in_200ms_ease-out]">
      <div className="flex flex-col items-center gap-4">
        <img
          src={clanmindMark}
          alt="ClanMind"
          className="h-8 w-auto dark:invert"
        />
        {/* §33 — "Welcome back" greeting for returning users */}
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Welcome back
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1">
          <label
            htmlFor="login-email"
            className="block text-xs font-medium text-[var(--color-text-secondary)]"
          >
            Email
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@team.com"
            value={form.email}
            onChange={(e) => {
              setForm((f) => ({ ...f, email: e.target.value }));
              if (fieldErrors.email) setFieldErrors((fe) => ({ ...fe, email: undefined }));
            }}
            onBlur={() => {
              if (!form.email.trim()) setFieldErrors((fe) => ({ ...fe, email: 'Email is required.' }));
              else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) setFieldErrors((fe) => ({ ...fe, email: 'Enter a valid email address.' }));
              else setFieldErrors((fe) => ({ ...fe, email: undefined }));
            }}
            disabled={form.loading}
            error={fieldErrors.email}
            aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
            required
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="login-password"
            className="block text-xs font-medium text-[var(--color-text-secondary)]"
          >
            Password
          </label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => {
              setForm((f) => ({ ...f, password: e.target.value }));
              if (fieldErrors.password) setFieldErrors((fe) => ({ ...fe, password: undefined }));
            }}
            onBlur={() => {
              if (!form.password) setFieldErrors((fe) => ({ ...fe, password: 'Password is required.' }));
              else setFieldErrors((fe) => ({ ...fe, password: undefined }));
            }}
            disabled={form.loading}
            error={fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
            required
          />
        </div>

        {form.error && (
          <p
            role="alert"
            aria-live="polite"
            className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-bg)] px-3 py-2 rounded-lg"
          >
            {form.error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full"
          loading={form.loading}
          disabled={!canSubmit}
        >
          {form.loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
        <button
          type="button"
          onClick={onForgotPassword}
          className="hover:text-[var(--color-text)] transition-colors cursor-pointer focus-visible:shadow-[var(--focus-ring)] rounded px-1 py-0.5"
        >
          Forgot password?
        </button>
        <button
          type="button"
          onClick={onSignup}
          className="hover:text-[var(--color-text)] transition-colors cursor-pointer focus-visible:shadow-[var(--focus-ring)] rounded px-1 py-0.5"
        >
          Create account →
        </button>
      </div>
    </div>
  );
}

// ─── Signup — §67 ───

function SignupView({ onLogin }: { onLogin: () => void }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
    error: null as string | null,
    loading: false,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const validate = (): boolean => {
    const errors: Record<string, string | undefined> = {};
    if (!form.name.trim()) errors.name = 'Name is required.';
    if (!form.email.trim()) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address.';
    if (!form.password) errors.password = 'Password is required.';
    else if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.';
    if (!form.confirm) errors.confirm = 'Please confirm your password.';
    else if (form.password !== form.confirm) errors.confirm = "Passwords don't match.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) setFieldErrors((fe) => ({ ...fe, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setForm((f) => ({ ...f, loading: true, error: null }));
    try {
      const identity = await getSessionGateway().signUp({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      await establishSession(identity);
    } catch {
      setForm((f) => ({
        ...f,
        loading: false,
        error: "Couldn't create account. Try again.",
      }));
      return;
    }
    setForm((f) => ({ ...f, loading: false }));
  };

  const canSubmit =
    form.name.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.password.length >= 8 &&
    form.confirm.length > 0 &&
    !form.loading;

  const fields = [
    {
      id: 'signup-name',
      label: 'Name',
      type: 'text',
      field: 'name' as const,
      autoComplete: 'name',
      placeholder: 'Your name',
      onBlur: () => { if (!form.name.trim()) setFieldErrors((fe) => ({ ...fe, name: 'Name is required.' })); },
    },
    {
      id: 'signup-email',
      label: 'Email',
      type: 'email',
      field: 'email' as const,
      autoComplete: 'email',
      placeholder: 'you@team.com',
      onBlur: () => {
        if (!form.email.trim()) setFieldErrors((fe) => ({ ...fe, email: 'Email is required.' }));
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) setFieldErrors((fe) => ({ ...fe, email: 'Enter a valid email address.' }));
      },
    },
    {
      id: 'signup-password',
      label: 'Password',
      type: 'password',
      field: 'password' as const,
      autoComplete: 'new-password',
      placeholder: '8+ characters',
      onBlur: () => {
        if (!form.password) setFieldErrors((fe) => ({ ...fe, password: 'Password is required.' }));
        else if (form.password.length < 8) setFieldErrors((fe) => ({ ...fe, password: 'Password must be at least 8 characters.' }));
      },
    },
    {
      id: 'signup-confirm',
      label: 'Confirm password',
      type: 'password',
      field: 'confirm' as const,
      autoComplete: 'new-password',
      placeholder: '••••••••',
      onBlur: () => {
        if (!form.confirm) setFieldErrors((fe) => ({ ...fe, confirm: 'Please confirm your password.' }));
        else if (form.password !== form.confirm) setFieldErrors((fe) => ({ ...fe, confirm: "Passwords don't match." }));
      },
    },
  ];

  return (
    <div className="space-y-6 animate-[fade-in_200ms_ease-out]">
      <div className="flex flex-col items-center gap-4">
        <img
          src={clanmindMark}
          alt="ClanMind"
          className="h-8 w-auto dark:invert"
        />
        <p className="text-sm text-[var(--color-text-secondary)]">Create your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        {fields.map(({ id, label, type, field, autoComplete, placeholder, onBlur }) => (
          <div key={id} className="space-y-1">
            <label
              htmlFor={id}
              className="block text-xs font-medium text-[var(--color-text-secondary)]"
            >
              {label}
            </label>
            <Input
              id={id}
              type={type}
              autoComplete={autoComplete}
              placeholder={placeholder}
              value={form[field]}
              onChange={(e) => {
                setForm((f) => ({ ...f, [field]: e.target.value }));
                clearFieldError(field);
              }}
              onBlur={onBlur}
              disabled={form.loading}
              error={fieldErrors[field]}
            />
          </div>
        ))}

        {form.error && (
          <p role="alert" aria-live="polite" className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-bg)] px-3 py-2 rounded-lg">
            {form.error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full"
          loading={form.loading}
          disabled={!canSubmit}
        >
          {form.loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="text-center text-xs text-[var(--color-text-secondary)]">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onLogin}
          className="hover:text-[var(--color-text)] transition-colors cursor-pointer font-medium focus-visible:shadow-[var(--focus-ring)] rounded px-1 py-0.5"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}

// ─── Forgot Password — §68 ───

function ForgotPasswordView({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setSendFailed(false);
    try {
      // §68 — success/failure never reveals whether the email exists.
      await getSessionGateway().requestPasswordReset(email);
      setSent(true);
    } catch {
      // Transport-level failure only — makes no account-existence claim.
      setSendFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-[fade-in_200ms_ease-out]">
      <div className="flex flex-col items-center gap-3">
        <img
          src={clanmindMark}
          alt="ClanMind"
          className="h-8 w-auto dark:invert"
        />
      </div>

      {sent ? (
        <div className="text-center space-y-4">
          <div className="text-3xl">📬</div>
          <h2 className="font-semibold text-[var(--color-text)]">Check your email</h2>
          {/* §68: Do not reveal whether the email exists */}
          <p className="text-sm text-[var(--color-text-secondary)]">
            If an account exists for that address, you'll receive a reset link shortly.
          </p>
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h2 className="font-semibold text-[var(--color-text)] mb-1">Reset your password</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Enter your email and we'll send a reset link.
            </p>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="forgot-email"
              className="block text-xs font-medium text-[var(--color-text-secondary)]"
            >
              Email
            </label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder="you@team.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          {sendFailed && (
            <p
              role="alert"
              aria-live="polite"
              className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-bg)] px-3 py-2 rounded-lg"
            >
              Couldn't send the reset link right now. Try again.
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full"
            loading={loading}
            disabled={!email || loading}
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={onBack}
          >
            ← Back to sign in
          </Button>
        </form>
      )}
    </div>
  );
}
