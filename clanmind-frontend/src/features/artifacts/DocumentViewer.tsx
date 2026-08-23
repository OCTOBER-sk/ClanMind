import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

export interface DocumentViewerProps {
  content: string;
}

export function DocumentViewer({ content }: DocumentViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyAll = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="relative flex-1 overflow-y-auto p-6 bg-[var(--color-surface-raised)] select-text leading-relaxed text-xs">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-end mb-4">
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-medium cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Markdown'}</span>
          </button>
        </div>

        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-xl font-bold mt-4 mb-3 pb-2 border-b border-[var(--color-border)] text-gray-900 dark:text-white">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-base font-semibold mt-4 mb-2 text-gray-900 dark:text-white">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-sm font-semibold mt-3 mb-1.5 text-gray-900 dark:text-white">
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
              <thead className="bg-[var(--color-surface-hover)] text-gray-900 dark:text-white font-semibold">
                {children}
              </thead>
            ),
            th: ({ children }) => <th className="p-2.5 border-b border-gray-200 dark:border-gray-700">{children}</th>,
            td: ({ children }) => <td className="p-2.5 border-b border-[var(--color-border)]">{children}</td>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-[var(--color-border-strong)] pl-4 my-3 italic text-[var(--color-text-secondary)]">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] font-mono text-[11px] text-[var(--color-text)]">
                {children}
              </code>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
