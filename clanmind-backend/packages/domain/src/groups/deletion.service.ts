import { AppError } from "@clanmind/shared";
import type { AuditLog } from "../common/ports";
import type { GroupRepository } from "./group.types";
import type { MembershipService } from "./membership.service";

/**
 * §9 Stage 3 permanent deletion executor. Runs as the `deletion` background
 * job (§158) — never synchronously inside one HTTP request.
 *
 * The purge removes Group-scoped shared data (messages, artifacts, files
 * ClanMind owns, AI configuration, memory, GitHub connection metadata) plus
 * audit records according to retention policy. The concrete table list lives
 * in the repository implementation so later phases extend it as tables are
 * introduced; this service owns ordering, status transitions, and audit.
 */
export interface GroupDeletionRepository {
  /** Deletes all Group-scoped rows. Returns the purged table names. */
  purgeGroupScoped(groupId: string): Promise<string[]>;
}

/** §158-style job queue port; the concrete runner lands in A8. */
export interface JobQueue {
  enqueue(input: {
    job_type: string;
    idempotency_key: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export const NOOP_JOB_QUEUE: JobQueue = {
  async enqueue() {
    /* wired in A8 */
  },
};

export class GroupDeletionService {
  constructor(
    private readonly groups: GroupRepository,
    private readonly membership: MembershipService,
    private readonly deletion: GroupDeletionRepository,
    private readonly audit: AuditLog,
  ) {}

  /** Executor side: called by the job runner with the group to destroy. */
  async purge(groupId: string): Promise<void> {
    const group = await this.groups.findById(groupId);
    if (!group) return; // already gone — idempotent job re-run
    await this.deletion.purgeGroupScoped(groupId);
    await this.groups.setStatus(
      groupId,
      "DELETED",
      group.deleted_at ?? new Date().toISOString(),
    );
    await this.audit.append({
      group_id: groupId,
      actor_user_id: null,
      action_type: "group.permanently_deleted",
      subject_type: "group",
      subject_id: groupId,
      payload: {},
      request_id: null,
    });
  }

  /**
   * Request side: the Owner's explicit Stage-3 confirmation. Enqueues the
   * deletion job; the group stays DELETING until the job completes.
   */
  async requestPermanentDelete(
    groupId: string,
    actorUserId: string,
    jobs: JobQueue,
  ): Promise<void> {
    const { group } = await this.membership.requireRole(groupId, actorUserId, ["OWNER"]);
    if (group.status !== "DELETING") {
      throw new AppError("CONFLICT", "Permanent deletion requires a prior soft deletion.");
    }
    await jobs.enqueue({
      job_type: "deletion",
      idempotency_key: `deletion:group:${groupId}`,
      payload: { group_id: groupId, requested_by: actorUserId },
    });
    await this.audit.append({
      group_id: groupId,
      actor_user_id: actorUserId,
      action_type: "group.permanent_delete_requested",
      subject_type: "group",
      subject_id: groupId,
      payload: {},
      request_id: null,
    });
  }
}

/** §9 Stage 2: Owner can restore within the recovery window (§178: 30 days). */
export function isWithinRecoveryWindow(
  deletedAt: string | null,
  recoveryDays: number,
  now = Date.now(),
): boolean {
  if (!deletedAt) return false;
  return now - new Date(deletedAt).getTime() < recoveryDays * 24 * 60 * 60 * 1000;
}
