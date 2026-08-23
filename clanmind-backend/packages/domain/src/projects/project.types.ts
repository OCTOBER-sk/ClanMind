import type { ProjectType } from "@clanmind/contracts";

/** §28 */
export interface Project {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  goal: string | null;
  project_type: ProjectType | null;
  status: "active" | "archived";
  progress: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

/** §29 */
export interface ProjectInstruction {
  id: string;
  project_id: string;
  instruction_text: string;
  priority: number;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  goal?: string | null;
  project_type?: ProjectType | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  goal?: string | null;
  project_type?: ProjectType | null;
  progress?: number | null;
}

/** §184 repository contracts over projects/project_instructions. */
export interface ProjectRepository {
  insert(input: {
    group_id: string;
    name: string;
    description: string | null;
    goal: string | null;
    project_type: string | null;
    created_by: string;
  }): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  update(id: string, input: UpdateProjectInput): Promise<Project | null>;
  setStatus(
    id: string,
    status: Project["status"],
    archivedAt: string | null,
  ): Promise<Project | null>;
  listByGroup(groupId: string, includeArchived: boolean): Promise<Project[]>;
  countActive(groupId: string): Promise<number>;
}

export interface ProjectInstructionRepository {
  insert(input: {
    project_id: string;
    instruction_text: string;
    priority: number;
    created_by: string;
  }): Promise<ProjectInstruction>;
  listByProject(projectId: string): Promise<ProjectInstruction[]>;
  update(
    id: string,
    input: { instruction_text?: string; priority?: number; enabled?: boolean },
  ): Promise<ProjectInstruction | null>;
  delete(id: string): Promise<void>;
}
