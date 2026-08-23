import React, { useState } from 'react';
import { ClanMindLogo } from '@/design-system/components/ClanMindLogo';
import { Button } from '@/design-system/components/Button';
import { Input } from '@/design-system/components/Input';
import { api } from '@/api/client';
import { ApiError } from '@/api/errors';
import { useAuthStore } from '@/state/useAuthStore';
import { useGroupStore } from '@/state/useGroupStore';
import type { User } from '@/types';

type AuthView = 'first_launch' | 'login' | 'signup' | 'forgot_password';

interface AuthSessionResponse {
  access_token: string;
  user: { id: string; email: string; name: string };
}

/** Â§67-69: Authentication screens and first launch experience */
export function AuthScreen() {
  const [view, setView] = useState<AuthView>('first_launch');
  const { setUser } = useAuthStore();
  const { groups } = useGroupStore();

  // Â§196: returners go straight to login (derived â€” no state-in-effect)
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
            onSuccess={(user) => setUser(user)}
          />
        )}
        {effectiveView === 'signup' && (
          <SignupView
            onLogin={() => setView('login')}
            onSuccess={(user) => setUser(user)}
          />
        )}
        {effectiveView === 'forgot_password' && (
          <ForgotPasswordView onBack={() => setView('login')} />
        )}
      </div>
    </div>
  );
}

// â”€â”€â”€ First Launch â€” Â§69 â”€â”€â”€

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
        {/* Spectral accent line â€” Â§69 */}
        <div className="h-px w-32 spectral-active rounded-full opacity-60" />
      </div>

      {/* Hero â€” Â§69 */}
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

// â”€â”€â”€ Login â€” Â§67 â”€â”€â”€

interface AuthFormState {
  email: string;
  password: string;
  error: string | null;
  loading: boolean;
}

function LoginView({
  onSignup,
  onForgotPassword,
  onSuccess,
}: {
  onSignup: () => void;
  onForgotPassword: () => void;
  onSuccess: (user: User) => void;
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
      // BE §104 — session establishment; demo transport implements the same
      // contract, including the AUTH_INVALID_CREDENTIALS failure path.
      const res = await api.post<AuthSessionResponse>('/auth/login', {
        email: form.email,
        password: form.password,
      });
      onSuccess({
        id: res.user.id,
        email: res.user.email,
        name: res.user.name,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      setForm((f) => ({
        ...f,
        loading: false,
        error:
          err instanceof ApiError && err.code === 'AUTH_INVALID_CREDENTIALS'
            ? "Couldn't sign in. Check your email and password."
            : "Couldn't sign in right now. Try again.",
      }));
    }
  };

  return (
    <div className="space-y-6 animate-[fade-in_200ms_ease-out]">
      <div className="flex flex-col items-center gap-3">
        <ClanMindLogo size="md" variant="calm" showWordmark />
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
            placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
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
          {form.loading ? 'Signing inâ€¦' : 'Sign in'}
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
          Create account â†’
        </button>
      </div>
    </div>
  );
}

// â”€â”€â”€ Signup â€” Â§67 â”€â”€â”€

function SignupView({
  onLogin,
  onSuccess,
}: {
  onLogin: () => void;
  onSuccess: (user: User) => void;
}) {
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
      const res = await api.post<AuthSessionResponse>('/auth/signup', {
        name: form.name,
        email: form.email,
        password: form.password,
      });
      onSuccess({
        id: res.user.id,
        email: res.user.email,
        name: res.user.name,
        created_at: new Date().toISOString(),
      });
    } catch {
      setForm((f) => ({
        ...f,
        loading: false,
        error: "Couldn't create account. Try again.",
      }));
    }
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
            { id: 'signup-confirm', label: 'Confirm password', type: 'password', field: 'confirm', autoComplete: 'new-password', placeholder: 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢' },
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
          {form.loading ? 'Creating accountâ€¦' : 'Create account'}
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

// â”€â”€â”€ Forgot Password â€” Â§68 â”€â”€â”€

function ForgotPasswordView({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      // TODO: POST /api/v1/auth/forgot-password { email }
      // IMPORTANT: Â§68 â€” never reveal whether email exists
      await new Promise((r) => setTimeout(r, 600));
      setSent(true);
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
          <div className="text-3xl">ðŸ“¬</div>
          <h2 className="font-semibold text-[var(--color-text)]">Check your email</h2>
          {/* Â§68: Do not reveal whether the email exists */}
          <p className="text-sm text-[var(--color-text-secondary)]">
            If an account exists for that address, you'll receive a reset link shortly.
          </p>
          <Button variant="ghost" size="sm" onClick={onBack}>
            â† Back to sign in
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
          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full"
            loading={loading}
            disabled={!email || loading}
          >
            {loading ? 'Sendingâ€¦' : 'Send reset link'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={onBack}
          >
            â† Back to sign in
          </Button>
        </form>
      )}
    </div>
  );
}
