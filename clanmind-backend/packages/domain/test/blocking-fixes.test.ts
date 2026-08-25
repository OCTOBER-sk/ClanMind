import { describe, expect, it } from "vitest";
import {
  ApprovalEngine,
  AttachmentService,
  DecisionService,
  TaskService,
  NotificationWorkerConsumer,
  NotificationService,
  type ActionRepository,
  type AiAction,
  type Attachment,
  type AttachmentRepository,
  type Decision,
  type DecisionRepository,
  type EventOutbox,
  type ObjectStoragePort,
  type OutboxEventInput,
  type OutboxRow,
  type Task,
  type TaskRepository,
} from "../src/index";

/**
 * Regression tests for BACKEND_AUDIT2_REPORT §6 blocking items M3 and M7/M9.
 * M3: attachment links must bind to a readable, same-group message.
 * M7/M9: decision/task/ai.action approval events are emitted durably and the
 * notification consumer no longer no-ops on approval requests.
 */

function outboxRecorder() {
  const events: OutboxEventInput[] = [];
  const outbox: EventOutbox = {
    async publish(event) {
      events.push(event);
    },
  };
  return { events, outbox };
}

// ---------- M3 ----------

function attachmentHarness() {
  const rows: Attachment[] = [];
  const linked: { message_id: string; attachment_id: string }[] = [];
  const storage: ObjectStoragePort = {
    async put() {},
    async get() {
      return null;
    },
  };
  const repo: AttachmentRepository = {
    async insert(input) {
      const a: Attachment = { ...input, created_at: new Date().toISOString(), deleted_at: null };
      rows.push(a);
      return a;
    },
    async findById(id) {
      return rows.find((a) => a.id === id) ?? null;
    },
    async softDelete() {},
    async linkToMessage(messageId, attachmentId) {
      linked.push({ message_id: messageId, attachment_id: attachmentId });
    },
    async listByMessage() {
      return [];
    },
  };
  return { svc: new AttachmentService(repo, storage), linked };
}

describe("M3: attachment links bind to a readable, same-group message", () => {
  it("links when the message is readable and in the same Group", async () => {
    const h = attachmentHarness();
    const attachment = await h.svc.upload({
      group_id: "g1",
      project_id: null,
      owner_user_id: "u1",
      original_name: "doc.pdf",
      declared_mime: "application/pdf",
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      max_bytes: 1_000_000,
      attachments_per_message_max: 10,
      current_attachment_count: 0,
    });
    await h.svc.linkToMessageInGroup({
      attachmentId: attachment.id,
      messageId: "m1",
      groupId: "g1",
      userId: "u1",
      verifyMessage: async () => ({ group_id: "g1" }),
    });
    expect(h.linked).toEqual([{ message_id: "m1", attachment_id: attachment.id }]);
  });

  it("refuses to link a message that belongs to ANOTHER Group", async () => {
    const h = attachmentHarness();
    const attachment = await h.svc.upload({
      group_id: "g1",
      project_id: null,
      owner_user_id: "u1",
      original_name: "doc.pdf",
      declared_mime: "application/pdf",
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      max_bytes: 1_000_000,
      attachments_per_message_max: 10,
      current_attachment_count: 0,
    });
    await expect(
      h.svc.linkToMessageInGroup({
        attachmentId: attachment.id,
        messageId: "foreign-message",
        groupId: "g1",
        userId: "u1",
        verifyMessage: async () => ({ group_id: "g2" }),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(h.linked).toHaveLength(0); // fail closed — no link written
  });

  it("refuses when the message is not readable (deleted/private) — verifyMessage throws", async () => {
    const h = attachmentHarness();
    const attachment = await h.svc.upload({
      group_id: "g1",
      project_id: null,
      owner_user_id: "u1",
      original_name: "doc.pdf",
      declared_mime: "application/pdf",
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      max_bytes: 1_000_000,
      attachments_per_message_max: 10,
      current_attachment_count: 0,
    });
    const verifyMessage = async () => {
      throw Object.assign(new Error("not readable"), { code: "FORBIDDEN" });
    };
    await expect(
      h.svc.linkToMessageInGroup({
        attachmentId: attachment.id,
        messageId: "private-message",
        groupId: "g1",
        userId: "u1",
        verifyMessage,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(h.linked).toHaveLength(0);
  });
});

// ---------- M7/M9: decision/task/ai.action events ----------

function decisionRepo() {
  const rows: Decision[] = [];
  const r: DecisionRepository = {
    async insert(input) {
      const d: Decision = {
        ...input,
        id: crypto.randomUUID(),
        options: null,
        selected_option: null,
        rationale: null,
        status: "PROPOSED",
        version: 1,
        approved_by: null,
        approved_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      rows.push(d);
      return d;
    },
    async findById(id) {
      return rows.find((d) => d.id === id) ?? null;
    },
    async listByProject(projectId) {
      return rows.filter((d) => d.project_id === projectId);
    },
    async compareAndSetStatus(input) {
      const d = rows.find((x) => x.id === input.id);
      if (!d || d.version !== input.expectedVersion || d.status !== input.from) return null;
      d.status = input.to;
      d.version += 1;
      if (input.approved_by) {
        d.approved_by = input.approved_by;
        d.approved_at = new Date().toISOString();
      }
      return d;
    },
    async supersedeOthers() {},
  };
  return { r };
}

function taskRepo() {
  const rows: Task[] = [];
  const r: TaskRepository = {
    async insert(input) {
      const t: Task = {
        ...input,
        id: crypto.randomUUID(),
        status: "TODO",
        priority: "MEDIUM",
        due_at: null,
        version: 1,
        created_by_ai_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
      };
      rows.push(t);
      return t;
    },
    async findById(id) {
      return rows.find((t) => t.id === id) ?? null;
    },
    async listByProject(projectId) {
      return rows.filter((t) => t.project_id === projectId);
    },
    async compareAndUpdate(input) {
      const idx = rows.findIndex((x) => x.id === input.id);
      if (idx < 0 || rows[idx]!.version !== input.expectedVersion) return null;
      // Return a fresh object so the caller's pre-update snapshot stays stable
      // (no reference aliasing with `findById`).
      const next: Task = {
        ...rows[idx]!,
        ...input.patch,
        version: rows[idx]!.version + 1,
        completed_at: input.patch.status === "DONE" ? new Date().toISOString() : null,
      };
      rows[idx] = next;
      return next;
    },
    async addDependency() {},
    async dependenciesOf() {
      return [];
    },
  };
  return { r };
}

function actionRepo() {
  const rows: AiAction[] = [];
  const r: ActionRepository = {
    async insert(input) {
      const a: AiAction = {
        ...input,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: input.status ?? "PROPOSED",
      };
      rows.push(a);
      return a;
    },
    async findById(id) {
      return rows.find((a) => a.id === id) ?? null;
    },
    async setStatus(id, status) {
      const a = rows.find((x) => x.id === id);
      if (a) a.status = status;
    },
    async findApproval() {
      return null;
    },
    async insertApproval(input) {
      return { ...input, id: crypto.randomUUID(), approved_at: new Date().toISOString() };
    },
    async completeApproval() {},
  };
  return { r };
}

describe("M9: decision/task lifecycle events are emitted durably", () => {
  it("decision.approve emits decision.approved (group-scoped)", async () => {
    const { events, outbox } = outboxRecorder();
    const { r } = decisionRepo();
    const svc = new DecisionService(r, async () => undefined, outbox, async () => "g1");
    const d = await svc.propose({ project_id: "p1", title: "Go", context: null, proposed_by: "u1" });
    await svc.approve({ id: d.id, approver: "u2", expectedVersion: 1 });

    expect(events.map((e) => e.event_type)).toContain("decision.approved");
    const ev = events.find((e) => e.event_type === "decision.approved")!;
    expect(ev.aggregate_id).toBe(d.id);
    expect(ev.group_id).toBe("g1");
    expect(ev.actor_id).toBe("u2");
  });

  it("decision.reject emits decision.rejected", async () => {
    const { events, outbox } = outboxRecorder();
    const { r } = decisionRepo();
    const svc = new DecisionService(r, async () => undefined, outbox, async () => "g1");
    const d = await svc.propose({ project_id: "p1", title: "Go", context: null, proposed_by: "u1" });
    await svc.reject({ id: d.id, expectedVersion: 1 });

    expect(events.map((e) => e.event_type)).toContain("decision.rejected");
  });

  it("task.create with an owner emits task.assigned; complete emits task.completed; updates emit task.updated", async () => {
    const { events, outbox } = outboxRecorder();
    const { r } = taskRepo();
    const svc = new TaskService(r, outbox, async () => "g1");

    const assigned = await svc.create({
      project_id: "p1",
      title: "Ship",
      description: null,
      owner_user_id: "u2",
      created_by_user_id: "u1",
    });
    expect(events.some((e) => e.event_type === "task.assigned" && e.actor_id === "u2")).toBe(true);

    await svc.update({ id: assigned.id, expectedVersion: 1, patch: { title: "Ship faster" } });
    expect(events.some((e) => e.event_type === "task.updated")).toBe(true);

    const beforeComplete = events.length;
    await svc.complete({ id: assigned.id, expectedVersion: 2 });
    expect(events.slice(beforeComplete).some((e) => e.event_type === "task.completed")).toBe(true);
  });

  it("task update to CANCELLED emits task.cancelled", async () => {
    const { events, outbox } = outboxRecorder();
    const { r } = taskRepo();
    const svc = new TaskService(r, outbox, async () => "g1");
    const t = await svc.create({
      project_id: "p1",
      title: "Drop",
      description: null,
      owner_user_id: null,
      created_by_user_id: "u1",
    });
    const before = events.length;
    await svc.update({ id: t.id, expectedVersion: 1, patch: { status: "CANCELLED" } });
    expect(events.slice(before).some((e) => e.event_type === "task.cancelled")).toBe(true);
  });
});

describe("M7/M9: ai.action.approved/rejected are emitted so AI_ACTION_APPROVAL is reachable", () => {
  it("approve emits ai.action.approved with the initiator + group", async () => {
    const { events, outbox } = outboxRecorder();
    const { r } = actionRepo();
    const engine = new ApprovalEngine(r, outbox);
    const action = await engine.propose({
      group_id: "g1",
      project_id: "p1",
      ai_run_id: "run1",
      initiated_by_user_id: "u1",
      action_kind: "github.merge",
      risk_level: "HIGH",
      payload: { branch: "feature/x" },
      requires_approval: true,
    });
    const payloadHash = action.payload_hash;
    const payloadVersion = action.payload_version;

    await engine.approve({
      action_id: action.id,
      approver_user_id: "u2",
      approver_role: "ADMIN",
      displayed_payload_hash: payloadHash,
      displayed_payload_version: payloadVersion,
    });

    const ev = events.find((e) => e.event_type === "ai.action.approved");
    expect(ev).toBeTruthy();
    expect(ev!.group_id).toBe("g1");
    expect(ev!.actor_id).toBe("u2");
    expect(ev!.payload["initiated_by_user_id"]).toBe("u1");
  });

  it("reject emits ai.action.rejected", async () => {
    const { events, outbox } = outboxRecorder();
    const { r } = actionRepo();
    const engine = new ApprovalEngine(r, outbox);
    const action = await engine.propose({
      group_id: "g1",
      project_id: "p1",
      ai_run_id: null,
      initiated_by_user_id: "u1",
      action_kind: "github.merge",
      risk_level: "HIGH",
      payload: { branch: "feature/x" },
      requires_approval: true,
    });
    await engine.reject({ action_id: action.id, rejector_role: "ADMIN" });

    const ev = events.find((e) => e.event_type === "ai.action.rejected");
    expect(ev).toBeTruthy();
    expect(ev!.group_id).toBe("g1");
  });
});

describe("M7: notification consumer no longer no-ops approval requests", () => {
  function row(partial: Partial<OutboxRow>): OutboxRow {
    return {
      id: crypto.randomUUID(),
      event_type: "ai.action.proposed",
      aggregate_type: "ai_action",
      aggregate_id: crypto.randomUUID(),
      group_id: "g1",
      actor_id: "u1",
      payload: {},
      retry_count: 0,
      ...partial,
    };
  }

  function notifRepo(inserted: { recipient_user_id: string; category: string }[]) {
    return {
      async insert(input: {
        recipient_user_id: string;
        category: string;
        group_id: string;
        project_id: string | null;
      }) {
        inserted.push({ recipient_user_id: input.recipient_user_id, category: input.category });
        return input as never;
      },
      async listForUser() {
        return [];
      },
      async markRead() {},
      async preference() {
        return null;
      },
    };
  }

  it("ai.action.proposed notifies OWNER/ADMIN reviewers (AI_ACTION_APPROVAL reachable)", async () => {
    const inserted: { recipient_user_id: string; category: string }[] = [];
    const consumer = new NotificationWorkerConsumer(
      new NotificationService(notifRepo(inserted)),
      () => [],
      () => ["owner1", "admin1"],
    );
    await consumer.process(row({ event_type: "ai.action.proposed" }));
    expect(inserted.map((i) => i.category)).toEqual(["AI_ACTION_APPROVAL", "AI_ACTION_APPROVAL"]);
    expect(inserted.map((i) => i.recipient_user_id).sort()).toEqual(["admin1", "owner1"]);
  });

  it("decision.proposed notifies OWNER/ADMIN reviewers (DECISION_APPROVAL)", async () => {
    const inserted: { recipient_user_id: string; category: string }[] = [];
    const consumer = new NotificationWorkerConsumer(
      new NotificationService(notifRepo(inserted)),
      () => [],
      () => ["owner1"],
    );
    await consumer.process(
      row({ event_type: "decision.proposed", aggregate_type: "decision" }),
    );
    expect(inserted).toEqual([{ recipient_user_id: "owner1", category: "DECISION_APPROVAL" }]);
  });

  it("ai.action.approved notifies the initiator", async () => {
    const inserted: { recipient_user_id: string; category: string }[] = [];
    const consumer = new NotificationWorkerConsumer(
      new NotificationService(notifRepo(inserted)),
      () => [],
      () => [],
    );
    await consumer.process(
      row({
        event_type: "ai.action.approved",
        payload: { initiated_by_user_id: "initiator" },
      }),
    );
    expect(inserted).toEqual([
      { recipient_user_id: "initiator", category: "AI_ACTION_APPROVAL" },
    ]);
  });

  it("task.assigned notifies the assignee (TASK_ASSIGNMENT)", async () => {
    const inserted: { recipient_user_id: string; category: string }[] = [];
    const consumer = new NotificationWorkerConsumer(
      new NotificationService(notifRepo(inserted)),
      () => [],
      () => [],
    );
    await consumer.process(
      row({ event_type: "task.assigned", payload: { owner_user_id: "assignee" } }),
    );
    expect(inserted).toEqual([
      { recipient_user_id: "assignee", category: "TASK_ASSIGNMENT" },
    ]);
  });
});
