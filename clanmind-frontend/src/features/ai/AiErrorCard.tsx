/**
 * FE §140 — the AI error card. Exact heading, a provider reason derived from
 * REAL error codes (BE §61 failure codes / §102 envelope), and the two
 * recovery actions. §137's CANCELLED state renders as a quieter sibling
 * strip: partial content is kept and Retry offered.
 *
 * M3 calm card: surface-container tone + error-tonal accent edge (3px), NOT
 * scary full-red fill. Buttons keep existing variants, state-layer safe.
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
  aiName = 'AI',
  errorCode,
  errorMessage,
  onRetry,
  onTryFallback,
}: AiErrorCardProps) {
  return (
    <div
      className="my-2 max-w-lg rounded-md border border-outline-variant bg-surface-container-low border-l-[3px] border-l-error overflow-hidden p-3 text-xs space-y-2 motion-reduce:transition-none"
      role="alert"
    >
      <div className="flex items-start gap-2 font-semibold text-error">
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
        <span>{aiName} couldn&apos;t complete this response.</span>
      </div>
      <p className="leading-relaxed pl-[1.375rem] text-on-surface-variant">
        {providerReasonOf(errorCode, errorMessage)}
      </p>
      {(onRetry || onTryFallback) && (
        <div className="flex items-center gap-2 pl-[1.375rem] pt-0.5">
          {onRetry && (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<RotateCcw className="w-3 h-3" />}
              onClick={onRetry}
              aria-label="Retry AI response"
            >
              Retry
            </Button>
          )}
          {onTryFallback && (
            <Button size="sm" variant="ghost" leftIcon={<Zap className="w-3 h-3" />} onClick={onTryFallback} aria-label="Try fallback AI provider">
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
  aiName = 'AI',
  hasPartial,
  onRetry,
}: {
  aiName?: string;
  hasPartial: boolean;
  onRetry?: () => void;
}) {
  return (
    <div
      className="my-1.5 inline-flex flex-wrap items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-2.5 py-1 text-[11px] leading-none text-on-surface-variant motion-reduce:transition-none"
      role="status"
    >
      <span className="font-medium">Response stopped.{hasPartial ? ' Partial output kept.' : ''}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1 font-semibold cursor-pointer outline-none focus-visible:shadow-[var(--md-focus-ring)] rounded-full px-2 py-0.5 -my-0.5 relative isolate overflow-hidden before:absolute before:inset-0 before:bg-current before:opacity-0 hover:before:opacity-[0.08] active:before:opacity-[0.10] before:transition-opacity before:duration-micro motion-reduce:before:transition-none motion-reduce:transition-none transition-colors duration-micro ease-emphasized text-tertiary hover:text-tertiary"
          style={{ color: 'var(--md-tertiary)' }}
        >
          <RotateCcw className="w-3 h-3" aria-hidden="true" />
          Ask again
        </button>
      )}
      <span className="sr-only">{aiName} stopped</span>
    </div>
  );
}
