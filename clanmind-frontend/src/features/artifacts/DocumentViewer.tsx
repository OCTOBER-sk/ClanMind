/**
 * DOCUMENT / MARKDOWN / RESEARCH / CODE artifact renderer — safe markdown
 * pipeline only (FE §296: react-markdown + remark-gfm, zero raw HTML).
 * Fenced code blocks get the §27 toolbar: language label + Copy that
 * preserves bytes exactly, flipping to "✓ Copied".
 */

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, FileText } from 'lucide-react';
import { copyToClipboard } from '@/tauri/bridge';
import { SafeMarkdownLink } from '@/tauri/externalLinks';

export interface DocumentViewerProps {
  content: string;
}

export function DocumentViewer({ content }: DocumentViewerProps) {
  const [copied, setCopied] = useState(false);
  // §27 stable copy state per code block (offset-keyed, never random).
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  const handleCopyAll = async () => {
    const ok = await copyToClipboard(content);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleCopyCode = async (code: string, blockOffset: number) => {
    const ok = await copyToClipboard(code);
    if (!ok) return;
    setCopiedCodeIndex(blockOffset);
    setTimeout(() => setCopiedCodeIndex(null), 1800);
  };

  // §42 — Empty state: honest, not a crash.
  if (!content || content.trim() === '') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center" role="status">
        <FileText className="h-8 w-8 text-[var(--color-text-tertiary)]" aria-hidden="true" />
        <p className="max-w-xs text-xs text-[var(--color-text-secondary)]">
          This document version has no content. View an earlier version or ask Odin to regenerate it.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-y-auto p-6 bg-[var(--color-surface-raised)] select-text leading-relaxed text-[var(--color-text)] text-xs">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-end mb-4">
          <button
            onClick={handleCopyAll}
            aria-label={copied ? 'Markdown copied' : 'Copy markdown content'}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-pressed)] text-xs font-medium cursor-pointer transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Markdown'}</span>
          </button>
        </div>

        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: SafeMarkdownLink,
            h1: ({ children }) => (
              <h1 className="text-xl font-bold mt-4 mb-3 pb-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-base font-semibold mt-4 mb-2 text-[var(--color-text)]">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-sm font-semibold mt-3 mb-1.5 text-[var(--color-text)]">
                {children}
              </h3>
            ),
            p: ({ children }) => <p className="mb-3 text-[var(--color-text)] leading-relaxed">{children}</p>,
            ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
            li: ({ children }) => <li className="text-[var(--color-text)]">{children}</li>,
            table: ({ children }) => (
              <div className="my-4 overflow-x-auto rounded-lg border border-[var(--color-border)]">
                <table className="w-full text-left border-collapse text-xs">{children}</table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-[var(--color-surface-hover)] text-[var(--color-text)] font-semibold">
                {children}
              </thead>
            ),
            th: ({ children }) => <th className="p-2.5 border-b border-[var(--color-border)]">{children}</th>,
            td: ({ children }) => <td className="p-2.5 border-b border-[var(--color-border)]">{children}</td>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-[var(--color-border-strong)] pl-4 my-3 italic text-[var(--color-text-secondary)]">
                {children}
              </blockquote>
            ),
            pre: ({ children }) => (
              // Unwrapped: the §27 code component owns its own framed block.
              <>{children}</>
            ),
            code: ({ className, children, node }) => {
              const match = /language-(\w+)/.exec(className || '');
              const codeString = String(children).replace(/\n$/, '');
              const isBlock = match || codeString.includes('\n');
              if (!isBlock) {
                return (
                  <code className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] font-mono text-[11px] text-[var(--color-text)]">
                    {children}
                  </code>
                );
              }
              // §27 — exact-bytes copy with a stable, position-derived key.
              const blockOffset = node?.position?.start.offset ?? 0;
              return (
                <div
                  className="my-3 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-[11px]"
                >
                  <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text-tertiary)]">
                    <span>{match ? match[1] : 'code'}</span>
                    <button
                      onClick={() => void handleCopyCode(codeString, blockOffset)}
                      className="flex cursor-pointer items-center gap-1 hover:opacity-80"
                      aria-label={`Copy ${match ? match[1] : 'code'} block`}
                    >
                      {copiedCodeIndex === blockOffset ? (
                        <>
                          <Check className="h-3 w-3 text-[var(--color-success)]" aria-hidden="true" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" aria-hidden="true" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="overflow-x-auto p-3">
                    <code>{children}</code>
                  </pre>
                </div>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
