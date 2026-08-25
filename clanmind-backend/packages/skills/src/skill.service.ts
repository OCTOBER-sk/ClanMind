import { AppError } from "@clanmind/shared";

/** §34 */
export interface Skill {
  id: string;
  slug: string;
  name: string;
  version: string;
  description: string;
  definition: Record<string, unknown>;
  built_in: boolean;
}

export interface SkillRepository {
  upsertBuiltIn(input: {
    slug: string;
    name: string;
    version: string;
    description: string;
    definition: Record<string, unknown>;
  }): Promise<Skill>;
  findBySlug(slug: string): Promise<Skill | null>;
  listAll(): Promise<Skill[]>;
  insertCustom(input: {
    name: string;
    description: string;
    definition: Record<string, unknown>;
  }): Promise<Skill>;
}

export interface SkillEnablementRepository {
  setGroup(groupId: string, skillId: string, enabled: boolean, config: Record<string, unknown>): Promise<void>;
  setProject(projectId: string, skillId: string, enabled: boolean, config: Record<string, unknown>): Promise<void>;
  listGroup(groupId: string): Promise<{ skill_id: string; enabled: boolean; config: Record<string, unknown> }[]>;
  listProject(projectId: string): Promise<{ skill_id: string; enabled: boolean; config: Record<string, unknown> }[]>;
}

/** §58 — the initial built-in set, and no more. */
export const BUILT_IN_SKILL_SLUGS = [
  "web_research",
  "deep_research",
  "brainstorming",
  "project_planning",
  "decision_analysis",
  "task_decomposition",
  "artifact_diagram",
  "artifact_document",
  "artifact_data_visualization",
  "file_analysis",
  "github_analysis",
  "github_change_planning",
  "meeting_facilitation",
] as const;

export function builtInDefinitions(): {
  slug: string;
  name: string;
  version: string;
  description: string;
  definition: Record<string, unknown>;
}[] {
  return BUILT_IN_SKILL_SLUGS.map((slug) => ({
    slug,
    name: slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    version: "1.0.0",
    description: `Built-in ${slug.replace(/_/g, " ")} skill`,
    definition: { instructions: `Workflow instructions for ${slug}.`, tool_allowlist: [] },
  }));
}

/**
 * §59 custom skill definitions. System instructions always remain higher
 * priority than any user-uploaded skill (§59/§60) — enforced by
 * `resolvedInstructionOrder`, which is also how §60's assembly order
 * consumes skills.
 */
export interface CustomSkillInput {
  name: string;
  description: string;
  instructions: string;
  tool_allowlist: string[];
  risk_policy: Record<string, unknown>;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
}

export function validateCustomSkill(input: CustomSkillInput): void {
  if (input.name.trim().length === 0 || input.name.length > 80) {
    throw new AppError("VALIDATION_FAILED", "Skill name must be 1–80 characters.");
  }
  if (input.instructions.length > 20_000) {
    throw new AppError("VALIDATION_FAILED", "Skill instructions exceed 20,000 characters.");
  }
  // §60: user skill files may never override platform safety/security rules.
  const forbidden =
    /ignore\s+(?:all\s+)?(?:previous\s+|prior\s+|system\s+)?instructions|override system policy|disregard safety/i;
  if (forbidden.test(input.instructions)) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Skill instructions cannot attempt to override platform policy.",
    );
  }
}

/**
 * §34 precedence: project override beats group enablement; disabled at
 * project level disables regardless of group state.
 */
export class SkillService {
  constructor(
    private readonly skills: SkillRepository,
    private readonly enablement: SkillEnablementRepository,
  ) {}

  async seedBuiltIns(): Promise<void> {
    for (const def of builtInDefinitions()) {
      await this.skills.upsertBuiltIn(def);
    }
  }

  async registerCustomSkill(input: CustomSkillInput): Promise<Skill> {
    validateCustomSkill(input);
    return this.skills.insertCustom({
      name: input.name.trim(),
      description: input.description,
      definition: {
        instructions: input.instructions,
        tool_allowlist: input.tool_allowlist,
        risk_policy: input.risk_policy,
        input_schema: input.input_schema,
        output_schema: input.output_schema,
      },
    });
  }

  /** §34 precedence resolution for a project context. */
  async resolveEnabled(groupId: string, projectId: string | null): Promise<Skill[]> {
    const groupRows = await this.enablement.listGroup(groupId);
    const projectRows = projectId
      ? await this.enablement.listProject(projectId)
      : [];
    const projectBySkill = new Map(projectRows.map((r) => [r.skill_id, r]));
    const groupBySkill = new Map(groupRows.map((r) => [r.skill_id, r]));

    const all = await this.skills.listAll();
    return all.filter((skill) => {
      const project = projectBySkill.get(skill.id);
      if (project) return project.enabled; // project override wins
      const group = groupBySkill.get(skill.id);
      if (group) return group.enabled;
      return skill.built_in; // custom skills default off; built-ins default on
    });
  }

  /**
   * §60: system instructions always outrank skill instructions. The returned
   * order is what prompt assembly consumes.
   */
  static resolvedInstructionOrder(systemPolicy: string, skillInstructions: string[]): string[] {
    return [systemPolicy, ...skillInstructions];
  }

  /**
   * Deterministic skill-selection heuristic (§54/§57/§58). Returns the
   * best-matching enabled skill for a user query by matching keywords
   * from the query against each skill's description and slug. Returns
   * null when no skill meaningfully matches — ordinary chat is never
   * forced into a skill.
   *
   * This is the deterministic core that grounds behavior in code rather
   * than relying solely on the prompt layer.
   */
  async selectBestMatchingSkill(
    groupId: string,
    projectId: string | null,
    query: string,
  ): Promise<Skill | null> {
    const enabled = await this.resolveEnabled(groupId, projectId);
    if (enabled.length === 0) return null;

    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 3); // ignore short/common words

    if (queryTerms.length === 0) return null;

    let bestSkill: Skill | null = null;
    let bestScore = 0;
    // Minimum threshold: at least one query term must match a skill's
    // description or slug to avoid false positives on vague queries.
    const MIN_MATCH_THRESHOLD = 1;

    for (const skill of enabled) {
      const haystack = `${skill.slug} ${skill.description}`.toLowerCase();
      const matchCount = queryTerms.filter((term) => haystack.includes(term)).length;
      if (matchCount >= MIN_MATCH_THRESHOLD && matchCount > bestScore) {
        bestScore = matchCount;
        bestSkill = skill;
      }
    }

    return bestSkill;
  }
}
