/**
 * §67 Search Provider Abstraction. Adapters normalize vendor results; the
 * backend picks primary/fallback by priority and meters usage per Group.
 */
export interface SearchRequest {
  query: string;
  max_results: number;
}

/** §66 normalized source shape — identical regardless of provider. */
export interface SearchHit {
  title: string;
  url: string;
  snippet: string | null;
  domain: string;
  retrieved_at: string;
}

export interface SearchResponse {
  provider: string;
  hits: SearchHit[];
}

export interface SearchProvider {
  readonly provider: string;
  search(request: SearchRequest): Promise<SearchResponse>;
}

export type SearchFetch = (url: string, init: RequestInit) => Promise<Response>;

/** Tavily adapter. */
export class TavilyProvider implements SearchProvider {
  readonly provider = "TAVILY";
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: SearchFetch = fetch,
  ) {}

  async search(request: SearchRequest): Promise<SearchResponse> {
    const fetcher = this.fetchImpl; // plain call — never leak `this` to native fetch
    const res = await fetcher("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: this.apiKey,
        query: request.query,
        max_results: request.max_results,
      }),
    });
    if (!res.ok) throw new Error(`tavily_http_${res.status}`);
    const json = (await res.json()) as {
      results?: { title?: string; url?: string; content?: string }[];
    };
    return {
      provider: this.provider,
      hits: (json.results ?? []).map((r) => ({
        title: r.title ?? r.url ?? "untitled",
        url: r.url ?? "",
        snippet: r.content ?? null,
        domain: domainOf(r.url ?? ""),
        retrieved_at: new Date().toISOString(),
      })),
    };
  }
}

/** Exa adapter. */
export class ExaProvider implements SearchProvider {
  readonly provider = "EXA";
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: SearchFetch = fetch,
  ) {}

  async search(request: SearchRequest): Promise<SearchResponse> {
    const fetcher = this.fetchImpl; // plain call — never leak `this` to native fetch
    const res = await fetcher("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({
        query: request.query,
        numResults: request.max_results,
      }),
    });
    if (!res.ok) throw new Error(`exa_http_${res.status}`);
    const json = (await res.json()) as {
      results?: { title?: string; url?: string; text?: string }[];
    };
    return {
      provider: this.provider,
      hits: (json.results ?? []).map((r) => ({
        title: r.title ?? r.url ?? "untitled",
        url: r.url ?? "",
        snippet: r.text ? r.text.slice(0, 500) : null,
        domain: domainOf(r.url ?? ""),
        retrieved_at: new Date().toISOString(),
      })),
    };
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

/**
 * §68 Deep Research pipeline stages (background job per §119):
 * plan → search batches → filter → extract → synthesize → cross-check →
 * answer → citation validation → project impact.
 */
export const DEEP_RESEARCH_STAGES = [
  "research_plan",
  "search_batch",
  "source_collection",
  "source_filtering",
  "source_extraction",
  "evidence_synthesis",
  "cross_check",
  "answer_generation",
  "citation_validation",
  "project_impact_analysis",
] as const;

export type DeepResearchStage = (typeof DEEP_RESEARCH_STAGES)[number];

export interface DeepResearchOutput {
  executive_answer: string;
  key_findings: string[];
  evidence: { citation_id: string; claim: string }[];
  sources: { citation_id: string; title: string; url: string; domain: string }[];
  conflicts: string[];
  project_implications: string;
  recommended_next_action: string;
}

/**
 * §69 citation integrity: citation ids are minted from tool responses only —
 * the model references them; it never invents URLs.
 */
export class CitationRegistry {
  private readonly byId = new Map<string, SearchHit & { citation_id: string }>();

  register(hit: SearchHit): string {
    const citationId = `src_${(hit.domain || "u").slice(0, 12)}_${this.byId.size + 1}`;
    this.byId.set(citationId, { ...hit, citation_id: citationId });
    return citationId;
  }

  resolve(citationId: string): (SearchHit & { citation_id: string }) | null {
    return this.byId.get(citationId) ?? null;
  }

  /** §69 claim mapping validation: every cited id must exist. */
  validateCitations(citedIds: string[]): { valid: boolean; unknown: string[] } {
    const unknown = citedIds.filter((id) => !this.byId.has(id));
    return { valid: unknown.length === 0, unknown };
  }

  all(): (SearchHit & { citation_id: string })[] {
    return [...this.byId.values()];
  }
}

/**
 * §68 pipeline executor with §178 limits (6 batches / 25 considered / 8 cited)
 * and §119 status reporting.
 */
export class DeepResearchPipeline {
  constructor(
    private readonly providers: { primary: SearchProvider; fallback?: SearchProvider },
    private readonly synthesize: (input: {
      query: string;
      hits: (SearchHit & { citation_id: string })[];
    }) => Promise<DeepResearchOutput>,
    private readonly limits: {
      search_batches_max: number;
      sources_considered_max: number;
      sources_cited_max: number;
    },
    private readonly onStage: (stage: DeepResearchStage, status: string) => Promise<void>,
  ) {}

  async run(query: string): Promise<DeepResearchOutput & { batches_used: number }> {
    await this.onStage("research_plan", "RUNNING");
    const registry = new CitationRegistry();
    const considered: (SearchHit & { citation_id: string })[] = [];
    let batches = 0;

    while (batches < this.limits.search_batches_max && considered.length < this.limits.sources_considered_max) {
      batches += 1;
      await this.onStage("search_batch", "SEARCHING");
      let response: SearchResponse;
      try {
        response = await this.providers.primary.search({
          query,
          max_results: Math.min(
            10,
            this.limits.sources_considered_max - considered.length,
          ),
        });
      } catch (error) {
        if (!this.providers.fallback) throw error;
        response = await this.providers.fallback.search({
          query,
          max_results: Math.min(
            10,
            this.limits.sources_considered_max - considered.length,
          ),
        });
      }
      await this.onStage("source_collection", "RUNNING");
      for (const hit of response.hits) {
        if (considered.length >= this.limits.sources_considered_max) break;
        const citationId = registry.register(hit);
        considered.push({ ...hit, citation_id: citationId });
      }
    }

    await this.onStage("source_filtering", "RUNNING");
    const relevant = considered
      .filter((h) => h.snippet && h.snippet.length > 40)
      .slice(0, this.limits.sources_considered_max);
    await this.onStage("source_extraction", "RUNNING");
    await this.onStage("evidence_synthesis", "SYNTHESIZING");
    const output = await this.synthesize({ query, hits: relevant });
    await this.onStage("cross_check", "VALIDATING");
    const cited = output.evidence.map((e) => e.citation_id);
    const validation = registry.validateCitations(cited);
    if (!validation.valid) {
      // §69: invented citations invalidate the answer.
      throw new Error(`invalid_citations:${validation.unknown.join(",")}`);
    }
    await this.onStage("citation_validation", "COMPLETED");
    await this.onStage("project_impact_analysis", "COMPLETED");
    return {
      ...output,
      sources: output.sources.slice(0, this.limits.sources_cited_max),
      batches_used: batches,
    };
  }
}
