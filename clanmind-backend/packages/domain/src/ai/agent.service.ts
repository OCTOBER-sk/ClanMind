/** §30 */
export interface AiAgent {
  id: string;
  group_id: string;
  name: string;
  avatar_object_id: string | null;
  language: string | null;
  tone: string | null;
  personality_config: Record<string, unknown>;
  mode_policy: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AiAgentRepository {
  findByGroup(groupId: string): Promise<AiAgent | null>;
  insert(input: { group_id: string; name: string }): Promise<AiAgent>;
}

/**
 * §2.2 one shared AI per Group, default name Odin. Config endpoints and the
 * full settings sections land in Phase C; B6 needs identity resolution for
 * PRIVATE_AI conversations, so this minimal service exists now.
 */
export class AiAgentService {
  constructor(private readonly agents: AiAgentRepository) {}

  /** Returns the Group's agent, provisioning the default Odin on first use. */
  async getCurrentAgent(groupId: string): Promise<AiAgent> {
    const existing = await this.agents.findByGroup(groupId);
    if (existing) return existing;
    return this.agents.insert({ group_id: groupId, name: "Odin" });
  }
}
