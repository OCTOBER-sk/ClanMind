/**
 * AI streaming text store (FE §135/§203) — the ONLY state that changes while
 * Odin streams.
 *
 * Deltas never enter the chat store mid-stream: they accumulate in the
 * realtime layer's buffer and are committed here at a render-friendly
 * cadence (~11 fps). Components subscribe per message id, so a delta batch
 * re-renders exactly one component tree node — the active AI bubble — and
 * never the message list, navigation, project state, or artifact tree.
 *
 * The chat store receives the body exactly once, at the terminal event
 * (completed / failed / cancelled), which also clears this entry.
 */

import { create } from 'zustand';

interface AiStreamState {
  /** Coalesced streamed Markdown per AI message id (§134 incremental Markdown). */
  bodiesByMessage: Record<string, string>;
  /** Realtime-layer commit of one batched frame. */
  setBody: (messageId: string, body: string) => void;
  /** Terminal event arrived — the chat store owns the body now. */
  clearBody: (messageId: string) => void;
}

export const useAiStreamStore = create<AiStreamState>((set) => ({
  bodiesByMessage: {},

  setBody: (messageId, body) =>
    set((state) => {
      // Identity-stable for every entry except the one that actually changed,
      // so subscribers of other messages never see a fresh snapshot.
      if (state.bodiesByMessage[messageId] === body) return state;
      return { bodiesByMessage: { ...state.bodiesByMessage, [messageId]: body } };
    }),

  clearBody: (messageId) =>
    set((state) => {
      if (!(messageId in state.bodiesByMessage)) return state;
      const next = { ...state.bodiesByMessage };
      delete next[messageId];
      return { bodiesByMessage: next };
    }),
}));
