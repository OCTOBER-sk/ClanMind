import { AppError } from "@clanmind/shared";
import type { EventOutbox } from "../common/ports";
import type { MembershipService } from "../groups/membership.service";
import type {
  CreateProjectInput,
  Project,
  ProjectInstruction,
  ProjectInstructionRepository,
  ProjectRepository,
  UpdateProjectInput,
} from "./project.types";

const NAME_MAX = 120;

/**
 * §10 Project domain. A Project is a durable work container inside a Group
 * (§185 #4: belongs to exactly one Group). Project type is metadata, not a
 * limitation (§10.1). Archiving is reversible (§10.3): archived projects stay
 * readable, stop counting against the active-project limit (§178), and can be
 * restored by authorized users.
 */
export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly instructions: ProjectInstructionRepository,
    private readonly membership: MembershipService,
    private readonly outbox: EventOutbox,
    private readonly limits: { projects_active_per_group_max: number } = {
      projects_active_per_group_max: 20,
    },
  ) {}

  async create(groupId: string, actorUserId: string, input: CreateProjectInput): Promise<Project> {
    // §7: Members create project work; Guests do not.
    const { group } = await this.membership.requireRole(groupId, actorUserId, [
      "OWNER",
      "ADMIN",
      "MEMBER",
    ]);
    if (group.status !== "ACTIVE") {
      throw new AppError("GROUP_DELETED", "This Group is not active.");
    }
    const name = input.name.trim();
    if (name.length === 0 || name.length > NAME_MAX) {
      throw new AppError("VALIDATION_FAILED", "Project name must be 1–120 characters.");
    }
    const active = await this.projects.countActive(groupId);
    if (active >= this.limits.projects_active_per_group_max) {
      throw new AppError(
        "GROUP_LIMIT_REACHED",
        "This Group has reached its active project limit. Archive a project first.",
      );
    }
    const project = await this.projects.insert({
      group_id: groupId,
      name,
      description: input.description?.trim() || null,
      goal: input.goal?.trim() || null,
      project_type: input.project_type ?? null,
      created_by: actorUserId,
    });
    return project;
  }

  async get(projectId: string, actorUserId: string): Promise<Project> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new AppError("NOT_FOUND", "Project not found.");
    await this.membership.requireMember(project.group_id, actorUserId);
    return project;
  }

  async listByGroup(
    groupId: string,
    actorUserId: string,
    includeArchived: boolean,
  ): Promise<Project[]> {
    await this.membership.requireMember(groupId, actorUserId);
    return this.projects.listByGroup(groupId, includeArchived);
  }

  /** §10.2 project state edits: OWNER/ADMIN manage shared project settings. */
  async update(
    projectId: string,
    actorUserId: string,
    input: UpdateProjectInput,
  ): Promise<Project> {
    const project = await this.get(projectId, actorUserId);
    await this.membership.requireRole(project.group_id, actorUserId, ["OWNER", "ADMIN"]);
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length === 0 || name.length > NAME_MAX) {
        throw new AppError("VALIDATION_FAILED", "Project name must be 1–120 characters.");
      }
      input.name = name;
    }
    if (input.progress !== undefined && input.progress !== null) {
      if (input.progress < 0 || input.progress > 100) {
        throw new AppError("VALIDATION_FAILED", "Progress must be 0–100.");
      }
    }
    const updated = await this.projects.update(projectId, input);
    if (!updated) throw new AppError("NOT_FOUND", "Project not found.");
    return updated;
  }

  /** §10.3 archive: reversible; archived projects remain readable. */
  async archive(projectId: string, actorUserId: string): Promise<Project> {
    const project = await this.get(projectId, actorUserId);
    await this.membership.requireRole(project.group_id, actorUserId, ["OWNER", "ADMIN"]);
    if (project.status === "archived") return project;
    const updated = await this.projects.setStatus(
      projectId,
      "archived",
      new Date().toISOString(),
    );
    if (!updated) throw new AppError("NOT_FOUND", "Project not found.");
    return updated;
  }

  async restore(projectId: string, actorUserId: string): Promise<Project> {
    const project = await this.get(projectId, actorUserId);
    await this.membership.requireRole(project.group_id, actorUserId, ["OWNER", "ADMIN"]);
    if (project.status !== "archived") {
      throw new AppError("CONFLICT", "Only an archived project can be restored.");
    }
    const active = await this.projects.countActive(project.group_id);
    if (active >= this.limits.projects_active_per_group_max) {
      throw new AppError(
        "GROUP_LIMIT_REACHED",
        "Restoring would exceed the active project limit.",
      );
    }
    const updated = await this.projects.setStatus(projectId, "active", null);
    if (!updated) throw new AppError("NOT_FOUND", "Project not found.");
    return updated;
  }

  // --- §29 project instructions: explicit records, not a giant context blob ---

  async addInstruction(
    projectId: string,
    actorUserId: string,
    text: string,
    priority: number,
  ): Promise<ProjectInstruction> {
    const project = await this.get(projectId, actorUserId);
    await this.membership.requireRole(project.group_id, actorUserId, [
      "OWNER",
      "ADMIN",
      "MEMBER",
    ]);
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 4000) {
      throw new AppError("VALIDATION_FAILED", "Instruction must be 1–4000 characters.");
    }
    return this.instructions.insert({
      project_id: projectId,
      instruction_text: trimmed,
      priority,
      created_by: actorUserId,
    });
  }

  async listInstructions(
    projectId: string,
    actorUserId: string,
  ): Promise<ProjectInstruction[]> {
    await this.get(projectId, actorUserId);
    return this.instructions.listByProject(projectId);
  }

  async updateInstruction(
    projectId: string,
    instructionId: string,
    actorUserId: string,
    input: { instruction_text?: string; priority?: number; enabled?: boolean },
  ): Promise<ProjectInstruction> {
    const project = await this.get(projectId, actorUserId);
    await this.membership.requireRole(project.group_id, actorUserId, [
      "OWNER",
      "ADMIN",
      "MEMBER",
    ]);
    const updated = await this.instructions.update(instructionId, input);
    if (!updated || updated.project_id !== projectId) {
      throw new AppError("NOT_FOUND", "Instruction not found.");
    }
    return updated;
  }

  async deleteInstruction(
    projectId: string,
    instructionId: string,
    actorUserId: string,
  ): Promise<void> {
    const project = await this.get(projectId, actorUserId);
    await this.membership.requireRole(project.group_id, actorUserId, [
      "OWNER",
      "ADMIN",
      "MEMBER",
    ]);
    const existing = (await this.instructions.listByProject(projectId)).find(
      (i) => i.id === instructionId,
    );
    if (!existing) throw new AppError("NOT_FOUND", "Instruction not found.");
    await this.instructions.delete(instructionId);
  }
}
