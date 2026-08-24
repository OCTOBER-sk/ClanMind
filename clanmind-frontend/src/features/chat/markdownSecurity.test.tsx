/**
 * P15 security regression tests — FE §292/§296/§295.
 *
 * Locks the two render-safety contracts of every untrusted-content surface:
 *
 * 1. §296 sanitize-on-render — the markdown pipeline is react-markdown +
 *    remark-gfm with NO raw-HTML pass (no rehype-raw anywhere). Raw HTML
 *    injected into AI bodies or artifact documents must never materialize as
 *    DOM elements (<script>, <img onerror>, <iframe>…).
 *
 * 2. §295 controlled external links — anchors rendered from untrusted content
 *    must route through the bridge's openExternalUrl (OS browser via the only
 *    granted shell capability), never navigate the webview; non-http(s)
 *    schemes must not survive as clickable hrefs.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageRow } from '@/features/chat/MessageRow';
import { DocumentViewer } from '@/features/artifacts/DocumentViewer';
import { ResearchDrawer } from '@/features/ai/ResearchDrawer';
import type { Message } from '@/types';

function message(overrides: Partial<Message>): Message {
  return {
    id: 'm_sec',
    group_id: 'g1',
    sender_type: 'USER',
    sender_id: 'u_other',
    sender_name: 'Arun',
    body: 'Hello team',
    visibility: 'GROUP',
    pinned: false,
    edited: false,
    deleted: false,
    attachments: [],
    reactions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const rowProps = {
  currentUserId: 'u_me',
  onReply: vi.fn(),
  onReact: vi.fn(),
  onEditSave: vi.fn(),
  onDelete: vi.fn(),
  onTogglePin: vi.fn(),
  onCreateTask: vi.fn(),
  onCreateDecision: vi.fn(),
  onUseAsContext: vi.fn(),
};

const XSSI_PAYLOAD = [
  '<script>window.__pwned = true</script>',
  '<img src=x onerror="window.__pwned = true">',
  '<iframe src="https://evil.example"></iframe>',
  '<a href="javascript:window.__pwned = true">click me</a>',
].join('\n');

describe('§296 sanitize-on-render (markdown surfaces)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as Record<string, unknown>).__pwned;
  });
  afterEach(cleanup);

  it('chat message body: raw HTML never becomes DOM and never executes', () => {
    render(
      <MessageRow
        {...rowProps}
        message={message({ body: `Legit text\n${XSSI_PAYLOAD}` })}
      />,
    );
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
    // The onerror <img> is dropped entirely — no img element rendered at all.
    expect(document.querySelector('img')).toBeNull();
    expect((window as unknown as Record<string, unknown>).__pwned).toBeUndefined();
    // Trusted markdown text still renders.
    expect(screen.getByText('Legit text')).toBeInTheDocument();
  });

  it('document artifact body: raw HTML never becomes DOM and never executes', () => {
    render(<DocumentViewer content={`# Doc\n${XSSI_PAYLOAD}`} />);
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect((window as unknown as Record<string, unknown>).__pwned).toBeUndefined();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Doc');
  });
});

describe('§295 external links routed through the controlled mechanism', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
  });
  afterEach(() => {
    openSpy.mockRestore();
    cleanup();
  });

  it('markdown http(s) link in chat: click preventDefaults and opens via bridge', async () => {
    const user = userEvent.setup();
    render(
      <MessageRow
        {...rowProps}
        message={message({ body: '[docs](https://docs.example.com/guide)' })}
      />,
    );
    const link = screen.getByRole('link', { name: 'docs' });
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    await user.click(link);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      'https://docs.example.com/guide',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('markdown javascript: link never becomes a clickable navigation element', async () => {
    const user = userEvent.setup();
    render(
      <MessageRow
        {...rowProps}
        message={message({ body: '[free money](javascript:alert(1))' })}
      />,
    );
    // react-markdown's URL transform neutralizes javascript: to '' AND our
    // SafeMarkdownLink drops empty hrefs — so no <a href> exists at all.
    expect(screen.queryByRole('link', { name: 'free money' })).toBeNull();
    const inert = screen.getByText('free money');
    await user.click(inert);
    expect(openSpy).not.toHaveBeenCalled();
    expect((window as unknown as Record<string, unknown>).__pwned).toBeUndefined();
  });

  it('artifact document link routes through the same bridge path', async () => {
    const user = userEvent.setup();
    render(<DocumentViewer content="[spec](https://spec.example.com)" />);
    await user.click(screen.getByRole('link', { name: 'spec' }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://spec.example.com',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('research source cards route through the bridge too', async () => {
    const user = userEvent.setup();
    render(
      <ResearchDrawer
        topic="t"
        summary="s"
        findings={['f']}
        projectImpact="i"
        sources={[
          {
            id: 'src1',
            title: 'An Analysis',
            url: 'https://papers.example.com/a',
            domain: 'papers.example.com',
          } as never,
        ]}
        onClose={() => {}}
      />,
    );
    await user.click(screen.getByRole('link', { name: /An Analysis/ }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://papers.example.com/a',
      '_blank',
      'noopener,noreferrer',
    );
  });
});
