/**
 * P5 UI surface — FE §136 (auto-scroll during AI), §138–§140 (Retry /
 * Regenerate / error card), §142 (subtle fallback indicator), §218
 * (lifecycle-only announcements).
 *
 * jsdom layout is stubbed exactly like the §202/§289 virtualization suite:
 * the scroll viewport reports 600px and `scrollHeight` is driven per test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MessageList } from '@/features/chat/MessageList';
import { AiErrorCard, providerReasonOf } from '@/features/ai/AiErrorCard';
import { useAiStreamStore } from '@/features/ai/aiStreamStore';
import type { Message, AiRun } from '@/types';

function message(id: string, body: string, senderType: 'USER' | 'AI' = 'AI'): Message {
  return {
    id,
    group_id: 'g1',
    sender_type: senderType,
    sender_id: senderType === 'AI' ? 'odin_ai' : 'u1',
    sender_name: senderType === 'AI' ? 'Odin' : 'Arun',
    body,
    visibility: 'GROUP',
    pinned: false,
    edited: false,
    deleted: false,
    attachments: [],
    reactions: [],
    created_at: new Date(Date.parse('2026-08-24T10:00:00Z')).toISOString(),
    updated_at: new Date().toISOString(),
  };
}

const baseProps = {
  currentUserId: 'u1',
  typingUsers: [] as string[],
  onReply: vi.fn(),
  onReact: vi.fn(),
  onEditSave: vi.fn(),
  onDelete: vi.fn(),
  onTogglePin: vi.fn(),
  onCreateTask: vi.fn(),
  onCreateDecision: vi.fn(),
  onUseAsContext: vi.fn(),
};

// ─── layout stubs ─────────────────────────────────────────────────────────────

const VIEWPORT_HEIGHT = 600;
let scrollHeightValue = 1200;

const realScrollHeightDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollHeight',
);

function installLayoutStubs(): void {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      if (this.hasAttribute('data-virt-viewport')) return scrollHeightValue;
      return realScrollHeightDescriptor?.get?.call(this) ?? 0;
    },
  });
}

function uninstallLayoutStubs(): void {
  if (realScrollHeightDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', realScrollHeightDescriptor);
  }
}

function setClientHeight(el: HTMLElement, value: number): void {
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => value });
}

afterEach(uninstallLayoutStubs);

// ─── §140 error card ────────────────────────────────────────────────────────

describe('AiErrorCard (§140)', () => {
  it('renders the exact heading plus the provider reason mapped from the real code', () => {
    render(
      <AiErrorCard aiName="Odin" errorCode="PROVIDER_TIMEOUT" onRetry={() => {}} onTryFallback={() => {}} />,
    );
    expect(screen.getByText(/couldn't complete this response\./)).toBeInTheDocument();
    expect(screen.getByText(/timed out before finishing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try fallback/i })).toBeInTheDocument();
  });

  it('maps known backend codes to specific reasons and unknown codes to the canonical line', () => {
    expect(providerReasonOf('rate_limited')).toMatch(/rate limiting/i);
    expect(providerReasonOf('invalid_api_key')).toMatch(/api key/i);
    expect(providerReasonOf('safety_refusal')).toMatch(/safety reasons/i);
    expect(providerReasonOf('totally_unknown_code')).toBe('Provider temporarily unavailable.');
    // Internal-looking messages never leak raw exception text.
    expect(providerReasonOf('WEIRD', '{"stack":"..."}')).toBe('Provider temporarily unavailable.');
  });

  it('does not render for quota exhaustion — that contract belongs to §141', () => {
    expect(providerReasonOf('APPLICATION_AI_QUOTA_EXHAUSTED')).not.toBeUndefined();
  });
});

// ─── MessageRow terminal states ─────────────────────────────────────────────

describe('MessageRow AI run states (§137/§138/§139/§142)', () => {
  beforeEach(() => {
    useAiStreamStore.setState({ bodiesByMessage: {} });
  });

  it('FAILED run renders the §140 card with Retry / Try fallback', () => {
    const run: AiRun = {
      id: 'r1',
      group_id: 'g1',
      status: 'FAILED',
      mode: 'ASSIST',
      prompt: 'p',
      tool_calls: [],
      sources: [],
      created_artifacts: [],
      error_code: 'PROVIDER_TIMEOUT',
      created_at: new Date().toISOString(),
    };
    const onRegenerate = vi.fn();
    render(
      <MessageList
        {...baseProps}
        messages={[message('m_ai', '')]}
        aiRunsByMessage={{ m_ai: run }}
        onRegenerate={onRegenerate}
      />,
    );
    expect(screen.getByText(/couldn't complete this response\./)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /^retry$/i })[0]!);
    expect(onRegenerate).toHaveBeenCalledWith('m_ai');
  });

  it('COMPLETED run offers visible Regenerate (not hover-gated, §325 #8)', () => {
    const run: AiRun = {
      id: 'r1',
      group_id: 'g1',
      status: 'COMPLETED',
      mode: 'ASSIST',
      prompt: 'p',
      tool_calls: [],
      sources: [],
      created_artifacts: [],
      created_at: new Date().toISOString(),
    };
    const onRegenerate = vi.fn();
    render(
      <MessageList
        {...baseProps}
        messages={[message('m_ai', 'the answer')]}
        aiRunsByMessage={{ m_ai: run }}
        onRegenerate={onRegenerate}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }));
    expect(onRegenerate).toHaveBeenCalledWith('m_ai');
  });

  it('CANCELLED run keeps partial content and offers re-ask (§137)', () => {
    const run: AiRun = {
      id: 'r1',
      group_id: 'g1',
      status: 'CANCELLED',
      mode: 'ASSIST',
      prompt: 'p',
      tool_calls: [],
      sources: [],
      created_artifacts: [],
      created_at: new Date().toISOString(),
    };
    render(
      <MessageList
        {...baseProps}
        messages={[message('m_ai', 'partial answer')]}
        aiRunsByMessage={{ m_ai: run }}
        onRegenerate={() => {}}
      />,
    );
    expect(screen.getByText('partial answer')).toBeInTheDocument();
    expect(screen.getByText(/response stopped\. partial output kept\./i)).toBeInTheDocument();
  });

  it('fallback metadata shows the subtle indicator without any alarm role (§142)', () => {
    const run: AiRun = {
      id: 'r1',
      group_id: 'g1',
      status: 'COMPLETED',
      mode: 'ASSIST',
      prompt: 'p',
      model_used: 'secondary-fallback',
      is_fallback: true,
      tool_calls: [],
      sources: [],
      created_artifacts: [],
      created_at: new Date().toISOString(),
    };
    render(
      <MessageList
        {...baseProps}
        messages={[message('m_ai', 'done')]}
        aiRunsByMessage={{ m_ai: run }}
      />,
    );
    expect(screen.getByText(/· fallback model/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ─── §136 follow behaviour + §218 announcements ─────────────────────────────

describe('MessageList during AI streaming (§136/§218)', () => {
  beforeEach(() => {
    installLayoutStubs();
    scrollHeightValue = 1200;
    useAiStreamStore.setState({ bodiesByMessage: {} });
  });
  afterEach(() => {
    uninstallLayoutStubs();
  });

  function streamingProps() {
    const streamingRun: AiRun = {
      id: 'r_live',
      group_id: 'g1',
      status: 'STREAMING',
      mode: 'ASSIST',
      prompt: 'p',
      tool_calls: [],
      sources: [],
      created_artifacts: [],
      created_at: new Date().toISOString(),
    };
    return {
      messages: [message('m_user', 'question', 'USER'), message('m_ai', '')],
      aiRunsByMessage: { m_ai: streamingRun },
      streamingMessageIds: ['m_ai'],
    };
  }

  it('follows growing content only while pinned to bottom, stops when the user scrolls away (§136)', async () => {
    const { container } = render(<MessageList {...baseProps} {...streamingProps()} />);
    const scroller = screen.getByRole('log', { name: /group conversation/i }) as HTMLElement;
    setClientHeight(scroller, VIEWPORT_HEIGHT);

    // Pinned to the bottom: scrollTop starts at max.
    scroller.scrollTop = 600;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    // Content grows mid-stream (streamed text lands via the stream store).
    act(() => {
      useAiStreamStore.getState().setBody('m_ai', 'growing streamed text');
      scrollHeightValue = 1600;
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    // Followed the growth to the (uncapped-in-jsdom) new bottom.
    expect(scroller.scrollTop).toBe(scrollHeightValue);

    // User scrolls away to read history — viewport must NEVER move again.
    scroller.scrollTop = 200;
    fireEvent.scroll(scroller);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    act(() => {
      scrollHeightValue = 2000;
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(scroller.scrollTop).toBe(200);

    // Jump to latest is offered.
    expect(screen.getByRole('button', { name: /jump to latest/i })).toBeInTheDocument();

    // Returning near the bottom resumes following ("resume on return").
    scroller.scrollTop = 1400; // 2000 - 1400 - 600 = 0 → near bottom
    fireEvent.scroll(scroller);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    act(() => {
      scrollHeightValue = 2200;
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(scroller.scrollTop).toBe(scrollHeightValue);
    void container;
  });

  it('announces lifecycle once and NEVER announces token text (§218)', async () => {
    const props = streamingProps();
    const view = render(<MessageList {...baseProps} {...props} />);

    // Started announcement appears exactly once.
    await act(async () => {});
    expect(screen.getAllByText(/started responding/i)).toHaveLength(1);
    expect(
      screen
        .getAllByRole('status')
        .some((el) => /started responding/i.test(el.textContent ?? '')),
    ).toBe(true);

    // Streamed deltas render as plain content — no live region carries them.
    act(() => {
      useAiStreamStore.getState().setBody('m_ai', 'token one token two');
    });
    for (const region of screen.getAllByRole('status')) {
      expect(region.textContent).not.toMatch(/token one/i);
      // The streamed text itself must NOT sit in any live region.
      expect(region).not.toContainElement(screen.getByText(/growing streamed text|token one/i));
    }

    // Completion transitions the announcement to the terminal phase.
    const completedRun: AiRun = { ...props.aiRunsByMessage.m_ai!, status: 'COMPLETED' };
    act(() => {
      view.rerender(
        <MessageList
          {...baseProps}
          {...props}
          aiRunsByMessage={{ m_ai: completedRun }}
          streamingMessageIds={[]}
        />,
      );
    });
    await act(async () => {});
    expect(
      screen
        .getAllByRole('status')
        .some((el) => /completed the response/i.test(el.textContent ?? '')),
    ).toBe(true);
  });

  it('no empty live regions when no AI runs exist (§217 coexistence)', () => {
    render(
      <MessageList
        {...baseProps}
        messages={[message('m_user', 'hello', 'USER')]}
      />,
    );
    expect(screen.queryByText(/responding/i)).not.toBeInTheDocument();
  });
});
