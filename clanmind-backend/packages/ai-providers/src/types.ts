/**
 * §62 Provider Adapter Interface — vendor SDK calls never leak across the
 * codebase. The architecture must not require one model vendor.
 */

export interface ModelDescriptor {
  model_id: string;
  display_name: string;
  context_window: number | null;
}

export interface ValidationResult {
  valid: boolean;
  models: ModelDescriptor[];
  error_code: string | null;
}

export interface ChatMessagePart {
  type: "text";
  text: string;
}

export interface ModelRequestMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface ModelRequest {
  model_id: string;
  messages: ModelRequestMessage[];
  max_tokens: number;
  temperature?: number;
}

export type ModelEvent =
  | { type: "text_delta"; text: string }
  | { type: "usage"; input_tokens: number; output_tokens: number }
  | { type: "error"; code: string; message: string }
  | { type: "completed"; finish_reason: string | null };

export interface UsageEstimate {
  estimated_input_tokens: number;
  estimated_output_tokens: number;
}

export interface ModelProviderAdapter {
  readonly provider: string;
  validateCredentials(): Promise<ValidationResult>;
  listModels(): Promise<ModelDescriptor[]>;
  generate(request: ModelRequest): AsyncIterable<ModelEvent>;
  estimateUsage?(request: ModelRequest): UsageEstimate;
  /** §64ter: model-level connectivity probe — a real (tiny) chat completion. */
  testChat(modelId: string): Promise<{ ok: boolean; sample?: string; error_code?: string }>;
}

/** Rough token estimate (~4 chars/token) used before provider usage returns. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateRequestUsage(request: ModelRequest): UsageEstimate {
  return {
    estimated_input_tokens: request.messages.reduce(
      (sum, m) => sum + estimateTokens(m.content),
      0,
    ),
    estimated_output_tokens: Math.ceil(request.max_tokens / 4),
  };
}

/** Shared SSE line parser for streaming adapters. */
export async function* parseSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index: number;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).replace(/\r$/, "");
      buffer = buffer.slice(index + 1);
      if (line.startsWith("data: ")) yield line.slice(6);
    }
  }
}
