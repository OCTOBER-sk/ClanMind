import React from 'react';
import { Button } from '@/design-system/components/Button';

/**
 * §199 Feature-level + §286 Global error boundaries.
 *
 * A failure inside Chat, Garage, Artifact, GitHub or Settings must
 * never crash the rest of the shell ("Do not allow one broken artifact
 * to break chat" — §325 #9).
 */
interface ErrorBoundaryProps {
  /** Feature name shown in the fallback, e.g. "Chat" */
  label?: string;
  /** Global catastrophic variant (§286) */
  variant?: 'feature' | 'global';
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, message: error instanceof Error ? error.message : 'Unknown error' };
  }

  componentDidCatch(error: unknown) {
    console.error(`[ErrorBoundary:${this.props.label ?? 'global'}]`, error);
  }

  private handleRestart = () => {
    window.location.reload();
  };

  private handleCopyDiagnostics = async () => {
    const diagnostics = `ClanMind error in "${this.props.label ?? 'app'}"\n${this.state.message}`;
    try {
      await navigator.clipboard.writeText(diagnostics);
    } catch {
      /* clipboard unavailable — nothing else to do */
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { variant = 'feature', label } = this.props;

    if (variant === 'global') {
      // §286: catastrophic screen — local drafts are preserved
      return (
        <div
          role="alert"
          className="fixed inset-0 z-[300] flex items-center justify-center p-6"
          style={{ background: 'var(--color-background)', color: 'var(--color-text)' }}
        >
          <div className="max-w-md text-center space-y-4">
            <div className="text-2xl font-bold">ClanMind encountered an unexpected problem.</div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Local drafts are preserved.
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="primary" onClick={this.handleRestart}>
                Restart
              </Button>
              <Button variant="ghost" onClick={this.handleCopyDiagnostics}>
                Copy diagnostics
              </Button>
            </div>
            {/* §287: diagnostics must not include secrets */}
            <p className="text-[10px] opacity-60">Diagnostics exclude secrets and private content.</p>
          </div>
        </div>
      );
    }

    // §199: feature-level boundary — rest of the app keeps working
    return (
      <div
        role="alert"
        className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {label ? `${label} hit a problem.` : 'This section hit a problem.'}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          The rest of ClanMind is still working.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => this.setState({ hasError: false, message: '' })}
        >
          Try again
        </Button>
      </div>
    );
  }
}