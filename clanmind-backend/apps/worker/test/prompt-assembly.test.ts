import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AGENT_BEHAVIOR_POLICY_TEXT,
  ContextEngine,
  INJECTION_POLICY_TEXT,
  PROMPT_ASSEMBLY_ORDER,
  AiAgentService,
  type AiAgent,
  type AiAgentRepository,
} from "@clanmind/domain";
import {
  SYSTEM_SAFETY_POLICY,
  buildFixedSlices,
} from "../src/ai/runtime";

/**
 * H1 regression (BACKEND_DEEP_AUDIT.md): production wiring used to construct
 * `new ContextEngine([], …)` — zero fixed slices, so no system safety text,
 * no Odin identity, no Group/Project policy ever reached a prompt, and
 * INJECTION_POLICY_TEXT (§89) had no production consumer. These tests pin
 * the §60 fixed-slice builder that now feeds ContextEngine construction.
 */

type Row = Record<string, unknown>;

/** Minimal chainable Supabase builder stub over in-memory tables. */
function fakeDb(tables: Record<string, Row[]>): SupabaseClient {
  const makeBuilder = (rows: Row[]) => {
    const filters: ((r: Row) => boolean)[] = [];
    let ordered = false;
    const builder = {
      select() {
        return builder;
      },
      eq(column: string, value: unknown) {
        filters.push((r) => r[column] === value);
        return builder;
      },
      is(_column: string, _value: null) {
        return builder;
      },
      order(_column: string, _opts?: unknown) {
        ordered = true;
        return builder;
      },
      async maybeSingle() {
        const data = rows.filter((r) => filters.every((f) => f(r)))[0] ?? null;
        return { data, error: null };
      },
      then<T>(
        onFulfilled?: (value: { data: Row[]; error: null }) => T,
      ): Promise<T> {
        let data = rows.filter((r) => filters.every((f) => f(r)));
        if (ordered) data = [...data].reverse();
        void ordered;
        return Promise.resolve({ data, error: null }).then(onFulfilled);
      },
    };
    return builder;
  };
  return {
    from(table: string) {
      return makeBuilder(tables[table] ?? []);
    },
  } as unknown as SupabaseClient;
}

function agentService(agent: Partial<AiAgent> | null): AiAgentService {
  const repo: AiAgentRepository = {
    async findByGroup() {
      return agent
        ? ({
            id: "agent-1",
            group_id: "g1",
            name: "Odin",
            avatar_object_id: null,
            language: null,
            tone: null,
            personality_config: {},
            mode_policy: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...agent,
          } as AiAgent)
        : null;
    },
    async insert(input) {
      return {
        id: "agent-1",
        avatar_object_id: null,
        language: null,
        tone: null,
        personality_config: {},
        mode_policy: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...input,
      };
    },
  };
  return new AiAgentService(repo);
}

const G1 = "00000000-0000-4000-8000-0000000000a1";
const P1 = "00000000-0000-4000-8000-0000000000b1";

describe("§60 fixed-slice construction (H1)", () => {
  it("always opens with SYSTEM_SAFETY carrying the §89 injection policy verbatim", async () => {
    const slices = await buildFixedSlices(fakeDb({}), agentService(null), {
      group_id: G1,
      project_id: null,
    });
    expect(slices[0]?.label).toBe("SYSTEM_SAFETY");
    expect(slices[0]?.content).toBe(SYSTEM_SAFETY_POLICY);
    // The §89 policy text is embedded VERBATIM — it finally has a consumer.
    expect(slices[0]?.content).toContain(INJECTION_POLICY_TEXT);
    // Even with no Group/agent/instructions readable, safety never degrades.
    // Now includes AGENT_BEHAVIOR_POLICY as the second fixed slice.
    expect(slices.length).toBeGreaterThanOrEqual(3); // safety + behavior policy + default Odin identity
  });

  it("includes AGENT_BEHAVIOR_POLICY immediately after SYSTEM_SAFETY (§60 fixed-slice order)", async () => {
    const slices = await buildFixedSlices(fakeDb({}), agentService(null), {
      group_id: G1,
      project_id: null,
    });
    expect(slices[1]?.label).toBe("AGENT_BEHAVIOR_POLICY");
    expect(slices[1]?.content).toBe(AGENT_BEHAVIOR_POLICY_TEXT);
    // The policy must contain all nine consolidated behavioral rules.
    expect(slices[1]?.content).toContain("CLARIFY vs ACT");
    expect(slices[1]?.content).toContain("TOOL and SKILL SELECTION");
    expect(slices[1]?.content).toContain("RESEARCH ESCALATION");
    expect(slices[1]?.content).toContain("ARTIFACT CREATION");
    expect(slices[1]?.content).toContain("MEMORY RULES");
    expect(slices[1]?.content).toContain("GITHUB WORKFLOW");
    expect(slices[1]?.content).toContain("PROACTIVITY");
    expect(slices[1]?.content).toContain("FAILURE and RETRY");
    expect(slices[1]?.content).toContain("OUTPUT DISCIPLINE");
  });

  it("builds ODIN_IDENTITY from the ai_agents row (§30)", async () => {
    const slices = await buildFixedSlices(fakeDb({}), agentService({
      name: "Odin",
      tone: "dry wit",
      language: "en-GB",
    }), { group_id: G1, project_id: null });
    const identity = slices.find((s) => s.label === "ODIN_IDENTITY");
    expect(identity?.content).toContain("You are Odin");
    expect(identity?.content).toContain("dry wit");
    expect(identity?.content).toContain("en-GB");
  });

  it("builds GROUP_POLICY from Group settings and the agent mode_policy", async () => {
    const db = fakeDb({
      groups: [
        { id: G1, name: "Platform Crew", description: "Ship the platform.", status: "ACTIVE" },
      ],
    });
    const slices = await buildFixedSlices(db, agentService({
      name: "Odin",
      mode_policy: { ASSIST: "suggest_only" },
    }), { group_id: G1, project_id: null });
    const policy = slices.find((s) => s.label === "GROUP_POLICY");
    expect(policy?.content).toContain("Platform Crew");
    expect(policy?.content).toContain("Ship the platform.");
    expect(policy?.content).toContain("ASSIST");
  });

  it("includes only ENABLED §29 project instructions, in priority order", async () => {
    const db = fakeDb({
      groups: [{ id: G1, name: "G", description: null, status: "ACTIVE" }],
      project_instructions: [
        { project_id: P1, instruction_text: "SECOND (priority 200)", priority: 200, enabled: true },
        { project_id: P1, instruction_text: "FIRST (priority 10)", priority: 10, enabled: true },
        { project_id: P1, instruction_text: "DISABLED never ships", priority: 1, enabled: false },
      ],
    });
    const slices = await buildFixedSlices(db, agentService(null), {
      group_id: G1,
      project_id: P1,
    });
    const projectPolicy = slices.find((s) => s.label === "PROJECT_POLICY");
    expect(projectPolicy).toBeTruthy();
    const content = projectPolicy?.content ?? "";
    expect(content.indexOf("FIRST (priority 10)")).toBeLessThan(
      content.indexOf("SECOND (priority 200)"),
    );
    expect(content).not.toContain("DISABLED never ships");
    expect(content).not.toContain("undefined");

    // No active project ⇒ no PROJECT_POLICY slice at all (§60 slot omitted).
    const withoutProject = await buildFixedSlices(db, agentService(null), {
      group_id: G1,
      project_id: null,
    });
    expect(withoutProject.find((s) => s.label === "PROJECT_POLICY")).toBeUndefined();
  });

  it("assembles enabled skill instructions with §34 precedence", async () => {
    const skills = [
      { id: "s1", name: "Web Research", definition: { instructions: "research workflow" }, built_in: true },
      { id: "s2", name: "Custom Enabled", definition: { instructions: "custom-on workflow" }, built_in: false },
      { id: "s3", name: "Project Resurrected", definition: { instructions: "resurrected workflow" }, built_in: false },
      { id: "s4", name: "Project Killed", definition: { instructions: "killed workflow" }, built_in: false },
    ];
    const db = fakeDb({
      groups: [{ id: G1, name: "G", description: null, status: "ACTIVE" }],
      skills,
      group_skills: [
        { group_id: G1, skill_id: "s2", enabled: true },
        { group_id: G1, skill_id: "s3", enabled: false },
        { group_id: G1, skill_id: "s4", enabled: true },
      ],
      project_skills: [
        { project_id: P1, skill_id: "s3", enabled: true }, // project override wins
        { project_id: P1, skill_id: "s4", enabled: false }, // project disable wins
      ],
    });
    const slices = await buildFixedSlices(db, agentService(null), {
      group_id: G1,
      project_id: P1,
    });
    const skillSlice = slices.find((s) => s.label === "TASK_SKILL_INSTRUCTIONS");
    const content = skillSlice?.content ?? "";
    expect(content).toContain("research workflow"); // built-in defaults ON
    expect(content).toContain("custom-on workflow"); // Group-enabled
    expect(content).toContain("resurrected workflow"); // project override ON
    expect(content).not.toContain("killed workflow"); // project override OFF
  });

  it("the assembled prompt (fixed slices first) carries safety + identity + project instruction", async () => {
    const db = fakeDb({
      groups: [{ id: G1, name: "Aurora", description: null, status: "ACTIVE" }],
      project_instructions: [
        { project_id: P1, instruction_text: "Always cite the design doc", priority: 100, enabled: true },
      ],
    });
    const slices = await buildFixedSlices(db, agentService({ name: "Odin" }), {
      group_id: G1,
      project_id: P1,
    });
    // Exactly how production consumes them: slices → ContextEngine → prompt
    // (the orchestrator serializes assembled.fixed with JSON.stringify).
    const engine = new ContextEngine(slices, 32_000);
    const assembled = engine.assemble({ candidates: [], explicitReferences: [] });
    const promptFixedBlock = JSON.stringify(assembled.fixed);

    // Decode the wire block the way the model sees its system message.
    const fixed = JSON.parse(promptFixedBlock) as { label: string; content: string }[];
    expect(fixed.map((f) => f.content).join("\n")).toContain(SYSTEM_SAFETY_POLICY);
    expect(fixed.map((f) => f.content).join("\n")).toContain(INJECTION_POLICY_TEXT);
    expect(promptFixedBlock).toContain("You are Odin");
    expect(promptFixedBlock).toContain("Always cite the design doc");

    // Labels follow the §60 assembly order where present.
    const labels = slices.map((s) => s.label);
    const orderPositions = ["SYSTEM_SAFETY", "AGENT_BEHAVIOR_POLICY", "ODIN_IDENTITY", "GROUP_POLICY", "PROJECT_POLICY"].map(
      (label) => labels.indexOf(label),
    );
    expect(orderPositions).toEqual([...orderPositions].sort((a, b) => a - b));
    for (const label of labels) {
      expect(PROMPT_ASSEMBLY_ORDER as readonly string[]).toContain(label);
    }
  });
});
