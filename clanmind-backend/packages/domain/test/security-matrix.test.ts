import { describe, expect, it } from "vitest";
import {
  AiOrchestrator,
  ContextEngine,
  MembershipService,
  MemoryService,
  MessageService,
  NotificationService,
  NotificationWorkerConsumer,
  privacyAuthorizes,
  sanitizeToolOutput,
  type ContextItem,
  type Group,
  type GroupMember,
  type GroupRepository,
  type MembershipRepository,
  type MemoryCandidateRepository,
  type MemoryRepository,
  type Message,
  type MessageRepository,
  type NotificationRepository,
  type OutboxRow,
} from "../src/index";

/**
 * §55A Privacy Crossing Matrix + §187 "most dangerous bug" regression suite.
 * Every "Never" row in §55A maps to an automated negative test below.
 */

const U1 = "00000000-0000-4000-8000-000000000001";
const U2 = "00000000-0000-4000-8000-000000000002";

function row(partial: Partial<OutboxRow>): OutboxRow {
  return {
    id: crypto.randomUUID(),
    event_type: "message.created",
    aggregate_type: "message",
    aggregate_id: crypto.randomUUID(),
    group_id: "g1",
    actor_id: U1,
    payload: {},
    retry_count: 0,
    ...partial,
  };
}

function contextItem(
  partial: Partial<ContextItem> & { owner_user_id?: string | null },
): ContextItem {
  return {
    slice: "group_memory",
    content: "",
    source_type: "memory",
    source_id: crypto.randomUUID(),
    importance: 1,
    confidence: 1,
    relevance: 1,
    recency: 1,
    tokens: 10,
    authorized: true,
    ...partial,
  };
}

describe("§55A privacy crossing matrix — every Never row", () => {
  it("PRIVATE_PAIR → public Group AI context: NEVER (engine drops unauthorized)", () => {
    // Positive control: shared slices are authorized and survive assembly.
    const engine = new ContextEngine([], 1000);
    const assembled = engine.assemble({
      candidates: [
        contextItem({ slice: "recent_conversation", content: "shared transcript", tokens: 5 }),
      ],
      explicitReferences: [],
    });
    expect(assembled.competitive).toHaveLength(1);
    expect(assembled.competitive[0]?.slice).toBe("recent_conversation");

    // Negative (§54A.5): an item the privacy filter marked unauthorized is
    // dropped BEFORE ranking — it never reaches the prompt even when its
    // score would dominate.
    const leaked = engine.assemble({
      candidates: [
        contextItem({
          slice: "recent_conversation",
          content: "secret pair-chat content ghp_aaaaaaaaaaaaaaaaaaaa",
          tokens: 5,
          authorized: false,
        }),
      ],
      explicitReferences: [],
    });
    expect(leaked.competitive).toHaveLength(0);
    expect(JSON.stringify(leaked)).not.toContain("secret pair-chat");
  });

  it("PRIVATE_PAIR → group/project memory: never automatically", async () => {
    const mem = memoryHarness();
    const result = await mem.proposeFromRun({
      group_id: "g1",
      project_id: "p1",
      user_id: U1,
      visibility: "PRIVATE_PAIR",
      content: "Private decision made in a pair chat",
      confidence: 0.99,
    });
    expect(result.stored).toBe(false);
    expect(result.candidate?.recommended_scope).not.toBe("GROUP");
    expect(result.candidate?.recommended_scope).not.toBe("PROJECT");
  });

  it("User A's PRIVATE_AI run → public context: NEVER (§55A row 3)", async () => {
    // The structured carrier of a PRIVATE_AI exchange is user-private memory:
    // proposing from a private AI run lands USER_PRIVATE for A, never stored.
    const mem = memoryHarness();
    const result = await mem.proposeFromRun({
      group_id: "g1",
      project_id: null,
      user_id: U1,
      visibility: "PRIVATE_AI",
      content: "Insight from a private AI conversation with Odin",
      confidence: 0.99,
    });
    expect(result.stored).toBe(false);
    expect(result.candidate?.recommended_scope).toBe("USER_PRIVATE");
    expect(result.candidate?.user_id).toBe(U1);

    // Authorization denies B any view of A's private items and denies the
    // public context entirely.
    expect(
      privacyAuthorizes("PRIVATE_AI", U2, { slice: "user_private_memory", owner_user_id: U1 }),
    ).toBe(false);
    expect(
      privacyAuthorizes("PUBLIC_GROUP", U1, { slice: "user_private_memory", owner_user_id: U1 }),
    ).toBe(false);
  });

  it("User A's PRIVATE_AI → User B's private context: NEVER (§55A row 4)", () => {
    expect(
      privacyAuthorizes("PRIVATE_AI", U2, { slice: "user_private_memory", owner_user_id: U1 }),
    ).toBe(false);

    // Leakage prevention across a live assembly (§54A.5): B's private run
    // receives A's private memory as a candidate — the filter marks it
    // unauthorized BEFORE ranking, so the shared item survives alone and the
    // payload never carries A's content.
    const secret = "A-private-insight-do-not-leak";
    const engine = new ContextEngine([], 1000);
    const assembled = engine.assemble({
      candidates: [
        contextItem({
          slice: "user_private_memory",
          content: secret,
          owner_user_id: U1,
          tokens: 30,
          importance: 1,
          relevance: 1,
          recency: 1,
          confidence: 1,
          authorized: privacyAuthorizes("PRIVATE_AI", U2, {
            slice: "user_private_memory",
            owner_user_id: U1,
          }),
        }),
        contextItem({ slice: "group_memory", content: "shared group note", tokens: 10 }),
      ],
      explicitReferences: [],
    });
    expect(assembled.competitive.map((c) => c.slice)).toEqual(["group_memory"]);
    expect(JSON.stringify(assembled)).not.toContain(secret);
  });

  it("User A's private memory → public Group AI context: NEVER (§55A row 5)", () => {
    expect(
      privacyAuthorizes("PUBLIC_GROUP", U1, { slice: "user_private_memory", owner_user_id: U1 }),
    ).toBe(false);

    // Even the OWNER's own public request cannot lift their private memory
    // into the shared prompt — zero private rows survive assembly.
    const secret = "owner-private-note-for-public-run";
    const engine = new ContextEngine([], 1000);
    const assembled = engine.assemble({
      candidates: [
        contextItem({
          slice: "user_private_memory",
          content: secret,
          owner_user_id: U1,
          tokens: 30,
          importance: 1,
          relevance: 1,
          recency: 1,
          confidence: 1,
          authorized: privacyAuthorizes("PUBLIC_GROUP", U1, {
            slice: "user_private_memory",
            owner_user_id: U1,
          }),
        }),
      ],
      explicitReferences: [],
    });
    expect(assembled.competitive).toHaveLength(0);
    expect(JSON.stringify(assembled)).not.toContain(secret);
  });

  it("User A's private memory → User B's private AI context: NEVER (§55A row 6)", () => {
    expect(
      privacyAuthorizes("PRIVATE_AI", U2, { slice: "user_private_memory", owner_user_id: U1 }),
    ).toBe(false);

    // Zero-row guarantee: B's private context assembles EMPTY when the only
    // candidate is A's private memory — nothing leaks into the provider
    // payload (fixed slices are empty here; competitive must be too).
    const engine = new ContextEngine([], 1000);
    const assembled = engine.assemble({
      candidates: [
        contextItem({
          slice: "user_private_memory",
          content: "A's memory surfaced through B's run",
          owner_user_id: U1,
          tokens: 30,
          importance: 1,
          relevance: 1,
          recency: 1,
          confidence: 1,
          authorized: privacyAuthorizes("PRIVATE_AI", U2, {
            slice: "user_private_memory",
            owner_user_id: U1,
          }),
        }),
      ],
      explicitReferences: [],
    });
    expect(assembled.competitive).toHaveLength(0);
    expect(assembled.provenance).toHaveLength(0);
    expect(JSON.stringify(assembled)).not.toContain("A's memory");
  });

  it("User A's private memory → User A's private AI context: ALLOWED (§55A row 7)", () => {
    expect(
      privacyAuthorizes("PRIVATE_AI", U1, { slice: "user_private_memory", owner_user_id: U1 }),
    ).toBe(true);
  });

  it("Group memory → public Group AI context: ALLOWED (§55A row 8)", () => {
    expect(privacyAuthorizes("PUBLIC_GROUP", U1, { slice: "group_memory" })).toBe(true);
  });

  it("Group memory → any private AI context: ALLOWED (§55A row 9)", () => {
    expect(privacyAuthorizes("PRIVATE_AI", U2, { slice: "group_memory" })).toBe(true);
  });

  it("Project memory → public context when project active: ALLOWED (§55A row 10)", () => {
    expect(privacyAuthorizes("PUBLIC_GROUP", U1, { slice: "project_memory" })).toBe(true);
  });

  it("Secrets → ANY AI context: NEVER (§55A row 11)", async () => {
    const mem = memoryHarness();
    const result = await mem.proposeFromRun({
      group_id: "g1",
      project_id: null,
      user_id: U1,
      visibility: "GROUP",
      content: "our api key sk-abcdefghijklmnopqrs",
      confidence: 1,
    });
    expect(result.stored).toBe(false);
    expect(result.candidate).toBeNull();
  });

  it("Tool output containing credentials → AI context without sanitization: NEVER (§55A row 12)", () => {
    const sanitized = sanitizeToolOutput({
      env: "ghp_" + "b".repeat(30),
      note: "Bearer abcdefghijklmnopqr",
    });
    expect(JSON.stringify(sanitized)).not.toContain("ghp_");
    expect(JSON.stringify(sanitized)).not.toContain("Bearer abcdef");
  });

  it("sanitizeToolOutput recurses into nested objects and arrays (§88)", () => {
    const secret = "ghp_" + "c".repeat(30);
    const sanitized = sanitizeToolOutput({
      a: { b: `token ${secret}` },
      list: [{ deep: { deeper: secret } }],
      plain: "safe value",
    });
    const rendered = JSON.stringify(sanitized);
    expect(rendered).not.toContain(secret);
    expect(rendered).toContain("gh_***");
    expect(rendered).toContain("safe value");
  });
});

function memoryHarness(): MemoryService {
  const memRepo: MemoryRepository = {
    async insert(input) {
      return {
        ...input,
        id: crypto.randomUUID(),
        status: "ACTIVE",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_used_at: null,
        archived_at: null,
      };
    },
    async findById() {
      return null;
    },
    async update() {
      return null;
    },
    async archive() {},
    async supersede() {},
    async delete() {},
    async searchInScope() {
      return [];
    },
    async findByNormalizedContent() {
      return null;
    },
  };
  const candRepo: MemoryCandidateRepository = {
    async insert(input) {
      return {
        ...input,
        status: "PENDING",
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
    },
    async findById() {
      return null;
    },
    async setStatus() {},
    async listByGroup() {
      return [];
    },
  };
  return new MemoryService(memRepo, candRepo);
}

describe("§55A private notification isolation (§95A)", () => {
  it("a PRIVATE_AI message notifies only its single owning member", async () => {
    const rows: { recipient_user_id: string; category: string }[] = [];
    const repo: NotificationRepository = {
      async insert(input) {
        rows.push({ recipient_user_id: input.recipient_user_id, category: input.category });
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
    const consumer = new NotificationWorkerConsumer(new NotificationService(repo), () => [], () => []);
    await consumer.process(
      row({
        actor_id: U1,
        payload: { visibility: "PRIVATE_AI", audience_user_ids: [U1] },
      }),
    );
    // The requester's own private message produces no notification to
    // anyone else — and none to themselves for their own message.
    expect(rows).toHaveLength(0);
  });
});

describe("§187 most-dangerous-bug list", () => {
  it("cross-group/cross-user authorizations fail closed", async () => {
    const h = crossScopeHarness();

    // §187 bullet 1 — User A in Group A tries Group B data: the centralized
    // authorization helper denies the membership link outright.
    await expect(h.membershipOfA.requireMember(h.groupB.id, U1)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    // §187 bullet 2 — User A tries a private chat of User B: the read ACL
    // fails closed (conversation members only).
    await expect(
      h.messages.requireReadable(h.privateMessageOfB.id, U1, h.aclFor(U1)),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Positive control: B still reads their own private chat.
    await expect(
      h.messages.requireReadable(h.privateMessageOfB.id, U2, h.aclFor(U2)),
    ).resolves.toMatchObject({ id: h.privateMessageOfB.id });

    // §187 bullet 6 — a removed member's stale credentials fail closed:
    // the row still exists, but the ACTIVE-membership gate rejects.
    await h.membershipOfB.removeMember(h.groupB.id, h.ownerB, U2);
    await expect(h.membershipOfB.requireMember(h.groupB.id, U2)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("forged approvals cannot execute (Correction 5, §78A.1)", async () => {
    const { ApprovalEngine } = await import("../src/approval/approval-engine");
    const harness = makeActionRepo();
    const engine = new ApprovalEngine(harness.r);
    const action = await engine.propose({
      group_id: "g1",
      project_id: null,
      ai_run_id: null,
      initiated_by_user_id: U1,
      action_kind: "github.merge_pr",
      risk_level: "CRITICAL",
      payload: { pr: 17 },
      requires_approval: true,
    });
    // No approval bound → execution refused.
    await expect(engine.beginExecution(action.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

/** Minimal in-memory action repository for the forged-approval test. */
function makeActionRepo() {
  const actions: import("../src/approval/approval-engine").AiAction[] = [];
  const r = {
    async insert(input: never) {
      const action = {
        ...(input as object),
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as import("../src/approval/approval-engine").AiAction;
      actions.push(action);
      return action;
    },
    async findById(id: string) {
      return actions.find((a) => a.id === id) ?? null;
    },
    async setStatus(id: string, status: string) {
      const a = actions.find((x) => x.id === id);
      if (a) (a as { status: string }).status = status;
    },
    async findApproval() {
      return null;
    },
    async insertApproval(input: never) {
      return input as never;
    },
    async completeApproval() {},
  };
  return { actions, r };
}

void AiOrchestrator; // referenced to keep the import meaningful for future rows

/**
 * Two-Group harness for §187 fail-closed assertions. U1 belongs ONLY to
 * Group A; U2 belongs to Group B (until removed); B owns a PRIVATE_PAIR
 * message inside conversation "conv-B".
 */
function crossScopeHarness() {
  const GA = "00000000-0000-4000-8000-0000000000a1";
  const GB = "00000000-0000-4000-8000-0000000000b1";
  const OWNER_B = "00000000-0000-4000-8000-000000000003";

  const makeGroup = (id: string): Group => ({
    id,
    name: `Group ${id}`,
    description: null,
    avatar_object_id: null,
    owner_user_id: id === GB ? OWNER_B : U1,
    status: "ACTIVE",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  });
  const groupA = makeGroup(GA);
  const groupB = makeGroup(GB);
  const groups: Group[] = [groupA, groupB];

  const memberRows: GroupMember[] = [
    { group_id: GA, user_id: U1, role: "OWNER", joined_at: new Date().toISOString(), removed_at: null, group_display_name: null, group_avatar_object_id: null },
    { group_id: GB, user_id: OWNER_B, role: "OWNER", joined_at: new Date().toISOString(), removed_at: null, group_display_name: null, group_avatar_object_id: null },
    { group_id: GB, user_id: U2, role: "MEMBER", joined_at: new Date().toISOString(), removed_at: null, group_display_name: null, group_avatar_object_id: null },
  ];
  const groupRepo: GroupRepository = {
    async findById(id) {
      return groups.find((g) => g.id === id) ?? null;
    },
    async insert(input) {
      const g = { ...makeGroup(crypto.randomUUID()), ...input };
      groups.push(g);
      return g;
    },
    async update(id, input) {
      const g = groups.find((x) => x.id === id);
      if (!g) return null;
      Object.assign(g, input);
      return g;
    },
    async setStatus() {
      return null;
    },
    async listForUser() {
      return [];
    },
  };
  const memberRepo: MembershipRepository = {
    async insert(input) {
      const m: GroupMember = { ...input, joined_at: new Date().toISOString(), removed_at: null, group_display_name: null, group_avatar_object_id: null };
      memberRows.push(m);
      return m;
    },
    async findActive(group_id, user_id) {
      return memberRows.find((m) => m.group_id === group_id && m.user_id === user_id && !m.removed_at) ?? null;
    },
    async listActive(group_id) {
      return memberRows.filter((m) => m.group_id === group_id && !m.removed_at);
    },
    async countActive(group_id) {
      return memberRows.filter((m) => m.group_id === group_id && !m.removed_at).length;
    },
    async updateRole(group_id, user_id, role) {
      const m = memberRows.find((x) => x.group_id === group_id && x.user_id === user_id);
      if (!m) return null;
      m.role = role;
      return m;
    },
    async markRemoved(group_id, user_id) {
      const m = memberRows.find((x) => x.group_id === group_id && x.user_id === user_id);
      if (m) m.removed_at = new Date().toISOString();
    },
    async transferOwnership() {},
  };

  const privateMessageOfB: Message = {
    id: crypto.randomUUID(),
    group_id: GB,
    project_id: null,
    sender_type: "USER",
    sender_user_id: U2,
    sender_ai_id: null,
    visibility: "PRIVATE_PAIR",
    private_conversation_id: "conv-B",
    body: "B's pair chat with Odin",
    body_format: "markdown",
    reply_to_id: null,
    client_message_id: "cmid-b",
    server_sequence: 1,
    created_at: new Date().toISOString(),
    edited_at: null,
    deleted_at: null,
  };
  const messageRows: Message[] = [privateMessageOfB];
  const messageRepo: MessageRepository = {
    async createWithMentions(input) {
      const m: Message = { ...privateMessageOfB, ...input, id: crypto.randomUUID() };
      messageRows.push(m);
      return m;
    },
    async findById(id) {
      return messageRows.find((m) => m.id === id) ?? null;
    },
    async recordRevision() {},
    async updateBody(id, body, editedAt) {
      const m = messageRows.find((x) => x.id === id);
      if (!m) return null;
      m.body = body;
      m.edited_at = editedAt;
      return m;
    },
    async softDelete(id, deletedAt) {
      const m = messageRows.find((x) => x.id === id);
      if (m) m.deleted_at = deletedAt;
    },
    async listGroupVisible() {
      return [];
    },
  };

  /** §40 conversation ACL — conv-B has exactly one human member: U2. */
  const aclFor = (userId: string) =>
    async () => userId === U2;

  return {
    membershipOfA: new MembershipService(groupRepo, memberRepo),
    membershipOfB: new MembershipService(groupRepo, memberRepo),
    messages: new MessageService(messageRepo, { message_body_max_chars: 8000 }),
    groupA,
    groupB,
    ownerB: OWNER_B,
    privateMessageOfB,
    aclFor,
  };
}
