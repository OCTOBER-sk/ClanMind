import { describe, expect, it } from "vitest";
import {
  CitationRegistry,
  DeepResearchPipeline,
  TavilyProvider,
  domainOf,
  type SearchProvider,
  type SearchResponse,
} from "../src/providers";

function fakeProvider(name: string, hits: number, fail = false): SearchProvider {
  return {
    provider: name,
    async search(request) {
      if (fail) throw new Error("provider_down");
      const response: SearchResponse = {
        provider: name,
        hits: Array.from({ length: request.max_results }, (_, i) => ({
          title: `${name} result ${i + 1}`,
          url: `https://example${i}.com/page`,
          snippet: "x".repeat(60),
          domain: `example${i}.com`,
          retrieved_at: new Date().toISOString(),
        })),
      };
      return response;
    },
  };
}

describe("§67 provider abstraction", () => {
  it("tavily adapter normalizes vendor results", async () => {
    const provider = new TavilyProvider("tv-key", async (_url, init) => {
      const body = JSON.parse(init.body as string) as { query: string; max_results: number };
      expect(body.query).toBe("wasm runtimes");
      return new Response(
        JSON.stringify({
          results: [{ title: "T", url: "https://a.com/x", content: "snippet" }],
        }),
        { status: 200 },
      );
    });
    const res = await provider.search({ query: "wasm runtimes", max_results: 5 });
    expect(res.hits[0]).toMatchObject({ title: "T", domain: "a.com", snippet: "snippet" });
  });

  it("domainOf tolerates garbage", () => {
    expect(domainOf("https://docs.example.com/a?b=1")).toBe("docs.example.com");
    expect(domainOf("not a url")).toBe("unknown");
  });
});

describe("§69 citation integrity", () => {
  it("mints ids from tool responses and validates claims", () => {
    const registry = new CitationRegistry();
    const id1 = registry.register({
      title: "A",
      url: "https://a.com",
      snippet: null,
      domain: "a.com",
      retrieved_at: new Date().toISOString(),
    });
    expect(id1).toMatch(/^src_/);
    expect(registry.validateCitations([id1]).valid).toBe(true);
    expect(registry.validateCitations([id1, "src_fake_99"]).valid).toBe(false);
    expect(registry.validateCitations([id1, "src_fake_99"]).unknown).toEqual(["src_fake_99"]);
  });
});

describe("§68/§119 deep research pipeline", () => {
  it("runs the staged workflow within §178 limits", async () => {
    const stages: string[] = [];
    const pipeline = new DeepResearchPipeline(
      { primary: fakeProvider("TAVILY", 10) },
      async ({ query, hits }) => ({
        executive_answer: `Answer about ${query}`,
        key_findings: ["f1"],
        evidence: hits.slice(0, 8).map((h) => ({ citation_id: h.citation_id, claim: "c" })),
        sources: hits.map((h) => ({
          citation_id: h.citation_id,
          title: h.title,
          url: h.url,
          domain: h.domain,
        })),
        conflicts: [],
        project_implications: "none",
        recommended_next_action: "review",
      }),
      { search_batches_max: 6, sources_considered_max: 25, sources_cited_max: 8 },
      async (stage) => {
        stages.push(stage);
      },
    );
    const output = await pipeline.run("edge runtimes");
    expect(output.batches_used).toBe(3); // 10+10+5 hits ≤ 25 considered
    expect(stages[0]).toBe("research_plan");
    expect(stages).toContain("search_batch");
    expect(output.sources.length).toBeLessThanOrEqual(8);
  });

  it("falls back to the secondary provider on failure", async () => {
    const pipeline = new DeepResearchPipeline(
      { primary: fakeProvider("TAVILY", 5, true), fallback: fakeProvider("EXA", 5) },
      async ({ hits }) => ({
        executive_answer: "a",
        key_findings: [],
        evidence: hits.map((h) => ({ citation_id: h.citation_id, claim: "c" })),
        sources: [],
        conflicts: [],
        project_implications: "",
        recommended_next_action: "",
      }),
      { search_batches_max: 2, sources_considered_max: 12, sources_cited_max: 8 },
      async () => {},
    );
    const output = await pipeline.run("q");
    expect(output.batches_used).toBe(2);
  });

  it("rejects answers with invented citations (§69)", async () => {
    const pipeline = new DeepResearchPipeline(
      { primary: fakeProvider("TAVILY", 3) },
      async () => ({
        executive_answer: "a",
        key_findings: [],
        evidence: [{ citation_id: "src_invented_1", claim: "c" }],
        sources: [],
        conflicts: [],
        project_implications: "",
        recommended_next_action: "",
      }),
      { search_batches_max: 1, sources_considered_max: 5, sources_cited_max: 8 },
      async () => {},
    );
    await expect(pipeline.run("q")).rejects.toThrow("invalid_citations");
  });
});
