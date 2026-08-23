import { describe, expect, it } from "vitest";
import {
  OpenAICompatibleAdapter,
  createOpenRouterAdapter,
  type FetchLike,
} from "../src/adapters";
import { estimateRequestUsage } from "../src/types";

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

const fetchOk: FetchLike = async () =>
  sseResponse([
    `data: ${JSON.stringify({ choices: [{ delta: { content: "Hel" } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { content: "lo" } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 9, completion_tokens: 2 } })}\n\n`,
    "data: [DONE]\n\n",
  ]);

describe("§62 OpenAI-compatible adapter", () => {
  it("streams text deltas, usage, and completion from SSE", async () => {
    const adapter = new OpenAICompatibleAdapter("openai", "sk-test", "https://x/v1", fetchOk);
    const events = [];
    for await (const event of adapter.generate({
      model_id: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 100,
    })) {
      events.push(event);
    }
    expect(events.filter((e) => e.type === "text_delta").map((e) => (e as { text: string }).text).join("")).toBe("Hello");
    expect(events).toContainEqual({ type: "usage", input_tokens: 9, output_tokens: 2 });
    expect(events.at(-1)).toEqual({ type: "completed", finish_reason: "stop" });
  });

  it("maps 401 to invalid_api_key (no silent fallback §61)", async () => {
    const adapter = new OpenAICompatibleAdapter(
      "openai",
      "sk-bad",
      "https://x/v1",
      async () => new Response("denied", { status: 401 }),
    );
    const result = await adapter.validateCredentials();
    expect(result.valid).toBe(false);
    expect(result.error_code).toBe("invalid_api_key");
  });

  it("lists models when credentials are valid", async () => {
    const adapter = new OpenAICompatibleAdapter(
      "openai",
      "sk-good",
      "https://x/v1",
      async () =>
        new Response(JSON.stringify({ data: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }] }), {
          status: 200,
        }),
    );
    const models = await adapter.listModels();
    expect(models.map((m) => m.model_id)).toEqual(["gpt-4o", "gpt-4o-mini"]);
  });

  it("openrouter variant reuses the compatible surface", async () => {
    const adapter = createOpenRouterAdapter("sk-or", fetchOk);
    expect(adapter.provider).toBe("openrouter");
    const events = [];
    for await (const e of adapter.generate({
      model_id: "m",
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 10,
    })) {
      events.push(e);
    }
    expect(events.length).toBeGreaterThan(0);
  });

  it("usage estimation is deterministic", () => {
    const usage = estimateRequestUsage({
      model_id: "m",
      messages: [{ role: "user", content: "a".repeat(400) }],
      max_tokens: 200,
    });
    expect(usage.estimated_input_tokens).toBe(100);
    expect(usage.estimated_output_tokens).toBe(50);
  });
});
