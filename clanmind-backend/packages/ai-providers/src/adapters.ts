import {
  estimateRequestUsage,
  parseSse,
  type ModelDescriptor,
  type ModelEvent,
  type ModelProviderAdapter,
  type ModelRequest,
  type ValidationResult,
} from "./types";

/** Injectable fetch so tests drive adapters without network access. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/**
 * OpenAI-compatible adapter (§62). OpenRouter and other compatible providers
 * reuse it with a different base URL.
 */
export class OpenAICompatibleAdapter implements ModelProviderAdapter {
  constructor(
    readonly provider: string,
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.openai.com/v1",
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.apiKey}`,
      "content-type": "application/json",
    };
  }

  async validateCredentials(): Promise<ValidationResult> {
    try {
      const models = await this.listModels();
      return { valid: true, models, error_code: null };
    } catch (error) {
      return {
        valid: false,
        models: [],
        error_code: error instanceof HttpError ? error.code : "provider_unavailable",
      };
    }
  }

  async listModels(): Promise<ModelDescriptor[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/models`, {
      headers: this.headers(),
    });
    if (!res.ok) throw httpError(res.status);
    const json = (await res.json()) as { data?: { id: string }[] };
    return (json.data ?? []).map((m) => ({
      model_id: m.id,
      display_name: m.id,
      context_window: null,
    }));
  }

  async *generate(request: ModelRequest): AsyncIterable<ModelEvent> {
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: request.model_id,
        messages: request.messages,
        max_tokens: request.max_tokens,
        temperature: request.temperature ?? 0.7,
        stream: true,
        stream_options: { include_usage: true },
      }),
    });
    if (!res.ok || !res.body) {
      yield { type: "error", code: mapStatus(res.status), message: `HTTP ${res.status}` };
      return;
    }
    for await (const data of parseSse(res.body)) {
      if (data === "[DONE]") {
        yield { type: "completed", finish_reason: "stop" };
        return;
      }
      const chunk = JSON.parse(data) as {
        choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield { type: "text_delta", text: delta };
      if (chunk.usage) {
        yield {
          type: "usage",
          input_tokens: chunk.usage.prompt_tokens ?? 0,
          output_tokens: chunk.usage.completion_tokens ?? 0,
        };
      }
      const finish = chunk.choices?.[0]?.finish_reason;
      if (finish) yield { type: "completed", finish_reason: finish };
    }
  }

  estimateUsage(request: ModelRequest) {
    return estimateRequestUsage(request);
  }
}

/** §62 Anthropic adapter (Messages API). */
export class AnthropicAdapter implements ModelProviderAdapter {
  readonly provider = "anthropic";
  private readonly compat: OpenAICompatibleAdapter;

  constructor(
    apiKey: string,
    fetchImpl: FetchLike = fetch,
    baseUrl = "https://api.anthropic.com/v1",
  ) {
    this.compat = new (class extends OpenAICompatibleAdapter {
      override async listModels(): Promise<ModelDescriptor[]> {
        const res = await fetchImpl(`${baseUrl}/models`, {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
        });
        if (!res.ok) throw httpError(res.status);
        const json = (await res.json()) as { data?: { id: string; display_name?: string }[] };
        return (json.data ?? []).map((m) => ({
          model_id: m.id,
          display_name: m.display_name ?? m.id,
          context_window: null,
        }));
      }
    })("anthropic", apiKey, baseUrl, fetchImpl);
  }

  validateCredentials(): Promise<ValidationResult> {
    return this.compat.validateCredentials();
  }

  listModels(): Promise<ModelDescriptor[]> {
    return this.compat.listModels();
  }

  generate(request: ModelRequest): AsyncIterable<ModelEvent> {
    return this.compat.generate(request);
  }

  estimateUsage(request: ModelRequest) {
    return this.compat.estimateUsage!(request);
  }
}

/** §62 Google adapter (Generative Language API, OpenAI-compatible surface). */
export function createGoogleAdapter(
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): ModelProviderAdapter {
  return new OpenAICompatibleAdapter(
    "google",
    apiKey,
    "https://generativelanguage.googleapis.com/v1beta/openai",
    fetchImpl,
  );
}

/** §62 OpenRouter adapter — OpenAI-compatible with its own base URL. */
export function createOpenRouterAdapter(
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): ModelProviderAdapter {
  return new OpenAICompatibleAdapter("openrouter", apiKey, "https://openrouter.ai/api/v1", fetchImpl);
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

function httpError(status: number): HttpError {
  return new HttpError(status, mapStatus(status));
}

function mapStatus(status: number): string {
  if (status === 401 || status === 403) return "invalid_api_key";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "invalid_request";
  if (status >= 500) return "5xx";
  return "provider_unavailable";
}
