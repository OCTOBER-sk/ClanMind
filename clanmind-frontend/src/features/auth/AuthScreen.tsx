import React, { useState } from 'react';
import { ClanMindLogo } from '@/design-system/components/ClanMindLogo';
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
        <ClanMindLogo size="lg" variant="calm" showWordmark />
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setForm((f) => ({ ...f, error: 'Please enter your email and password.' }));
      return;
    }
    setForm((f) => ({ ...f, loading: true, error: null }));
    try {
      const identity = await getSessionGateway().signIn(form.email, form.password);
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

  return (
    <div className="space-y-6 animate-[fade-in_200ms_ease-out]">
      <div className="flex flex-col items-center gap-3">
        <ClanMindLogo size="md" variant="calm" showWordmark />
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
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            disabled={form.loading}
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
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            disabled={form.loading}
            required
          />
        </div>

        {form.error && (
          <p
            role="alert"
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
          disabled={form.loading}
        >
          {form.loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
        <button
          type="button"
          onClick={onForgotPassword}
          className="hover:text-[var(--color-text)] transition-colors cursor-pointer focus-ring rounded"
        >
          Forgot password?
        </button>
        <button
          type="button"
          onClick={onSignup}
          className="hover:text-[var(--color-text)] transition-colors cursor-pointer focus-ring rounded"
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      setForm((f) => ({ ...f, error: 'All fields are required.' }));
      return;
    }
    if (form.password !== form.confirm) {
      setForm((f) => ({ ...f, error: "Passwords don't match." }));
      return;
    }
    if (form.password.length < 8) {
      setForm((f) => ({ ...f, error: 'Password must be at least 8 characters.' }));
      return;
    }
    setForm((f) => ({ ...f, loading: true, error: null }));
    try {
      const identity = await getSessionGateway().signUp({
        name: form.name,
        email: form.email,
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

  return (
    <div className="space-y-6 animate-[fade-in_200ms_ease-out]">
      <div className="flex flex-col items-center gap-3">
        <ClanMindLogo size="md" variant="calm" showWordmark />
        <p className="text-sm text-[var(--color-text-secondary)]">Create your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        {(
          [
            { id: 'signup-name', label: 'Name', type: 'text', field: 'name', autoComplete: 'name', placeholder: 'Your name' },
            { id: 'signup-email', label: 'Email', type: 'email', field: 'email', autoComplete: 'email', placeholder: 'you@team.com' },
            { id: 'signup-password', label: 'Password', type: 'password', field: 'password', autoComplete: 'new-password', placeholder: '8+ characters' },
            { id: 'signup-confirm', label: 'Confirm password', type: 'password', field: 'confirm', autoComplete: 'new-password', placeholder: '••••••••' },
          ] as const
        ).map(({ id, label, type, field, autoComplete, placeholder }) => (
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
              value={form[field as keyof typeof form] as string}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              disabled={form.loading}
            />
          </div>
        ))}

        {form.error && (
          <p role="alert" className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-bg)] px-3 py-2 rounded-lg">
            {form.error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full"
          loading={form.loading}
          disabled={form.loading}
        >
          {form.loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="text-center text-xs text-[var(--color-text-secondary)]">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onLogin}
          className="hover:text-[var(--color-text)] transition-colors cursor-pointer font-medium focus-ring rounded"
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
        <ClanMindLogo size="md" variant="calm" showWordmark />
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
