/**
 * FE §140 — the AI error card. Exact heading, a provider reason derived from
 * REAL error codes (BE §61 failure codes / §102 envelope), and the two
 * recovery actions. §137's CANCELLED state renders as a quieter sibling
 * strip: partial content is kept and Retry offered.
 *
 * NOT rendered for APPLICATION_AI_QUOTA_EXHAUSTED — that code has its own
 * contract card (FE §141) and collapsing them would hide an admin action.
 */

import { AlertCircle, RotateCcw, Zap } from 'lucide-react';
import { Button } from '@/design-system/components/Button';

/**
 * Map backend failure codes to one calm, specific line. Unknown codes fall
 * back to the spec's canonical reason rather than leaking internals.
 */
export function providerReasonOf(errorCode?: string, errorMessage?: string): string {
  switch (errorCode) {
    case 'PROVIDER_TIMEOUT':
    case 'provider_timeout':
      return 'The provider timed out before finishing the response.';
    case 'rate_limited':
    case 'RATE_LIMITED':
      return 'The provider is rate limiting requests right now.';
    case 'invalid_api_key':
      return 'The configured provider rejected its API key.';
    case 'safety_refusal':
      return 'The provider declined this request for safety reasons.';
    case 'private_conversation_forbidden':
      return 'This private conversation cannot be used for AI runs.';
    case 'CONTEXT_TOO_LONG':
    case 'context_too_long':
      return 'The conversation exceeded the model context limit.';
    case 'RUN_START_FAILED':
      return 'The run could not be started.';
    default: {
      const trimmed = errorMessage?.trim();
      // Only surface a backend message when it is short, human, and not an
      // internal class name — never raw exception text.
      if (trimmed && trimmed.length <= 140 && !/[{}<>]/.test(trimmed)) return trimmed;
      return 'Provider temporarily unavailable.';
    }
  }
}

export interface AiErrorCardProps {
  aiName?: string;
  /** BE failure code from ai_runs.error_code / ai.response.failed payload. */
  errorCode?: string;
  errorMessage?: string;
  onRetry?: () => void;
  /** §140 "Try fallback" — starts a new run; server routing owns the chain. */
  onTryFallback?: () => void;
}

export function AiErrorCard({
  aiName = 'Odin',
  errorCode,
  errorMessage,
  onRetry,
  onTryFallback,
}: AiErrorCardProps) {
  return (
    <div
      className="my-2 p-3 rounded-xl border text-xs space-y-2 max-w-lg"
      role="alert"
      style={{
        borderColor: 'var(--color-border-strong)',
        background: 'var(--color-surface)',
      }}
    >
      <div className="flex items-start gap-2 font-semibold" style={{ color: 'var(--color-danger)' }}>
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
        <span>{aiName} couldn&apos;t complete this response.</span>
      </div>
      <p className="leading-relaxed pl-5" style={{ color: 'var(--color-text-secondary)' }}>
        {providerReasonOf(errorCode, errorMessage)}
      </p>
      {(onRetry || onTryFallback) && (
        <div className="flex items-center gap-2 pl-5 pt-0.5">
          {onRetry && (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<RotateCcw className="w-3 h-3" />}
              onClick={onRetry}
            >
              Retry
            </Button>
          )}
          {onTryFallback && (
            <Button size="sm" variant="ghost" leftIcon={<Zap className="w-3 h-3" />} onClick={onTryFallback}>
              Try fallback
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** §137/§134A CANCELLED — quiet strip; partial output stays visible above it. */
export function AiStoppedStrip({
  aiName = 'Odin',
  hasPartial,
  onRetry,
}: {
  aiName?: string;
  hasPartial: boolean;
  onRetry?: () => void;
}) {
  return (
    <div
      className="my-1.5 flex items-center gap-2 text-[11px]"
      role="status"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      <span className="font-medium">Response stopped.{hasPartial ? ' Partial output kept.' : ''}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1 font-semibold cursor-pointer hover:underline"
          style={{ color: 'var(--color-info)' }}
        >
          <RotateCcw className="w-3 h-3" aria-hidden="true" />
          Ask again
        </button>
      )}
      <span className="sr-only">{aiName} stopped</span>
    </div>
  );
}
