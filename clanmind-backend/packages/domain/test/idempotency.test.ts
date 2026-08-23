import { describe, expect, it } from "vitest";
import { IdempotencyService, hashRequest, type StoredOperation, type IdempotencyRepository } from "../src/index";

function makeRepo(seed: StoredOperation[] = []) {
  const rows = [...seed];
  const repo: IdempotencyRepository = {
    async find(actorId, operationId) {
      return rows.find((r) => r.actor_id === actorId && r.operation_id === operationId) ?? null;
    },
    async insert(input) {
      const row: StoredOperation = {
        ...input,
        result_status: null,
        result_body: null,
        result_reference: null,
        created_at: new Date().toISOString(),
      };
      rows.push(row);
      return row;
    },
    async recordResult(input) {
      const row = rows.find(
        (r) => r.actor_id === input.actor_id && r.operation_id === input.operation_id,
      );
      if (row) {
        row.result_status = input.result_status;
        row.result_body = input.result_body;
        row.result_reference = input.result_reference;
      }
    },
    async deleteOlderThan() {},
  };
  return { repo, rows };
}

const ACTOR = "00000000-0000-4000-8000-000000000001";

describe("§19 idempotency", () => {
  it("first submission inserts, replay returns the stored result", async () => {
    const { repo } = makeRepo();
    const svc = new IdempotencyService(repo);
    const hash = await hashRequest("POST", "/api/v1/groups", '{"name":"A"}');

    const first = await svc.check(ACTOR, "op_123", hash);
    expect(first && "first" in first).toBe(true);

    await svc.record({
      operation_id: "op_123",
      actor_id: ACTOR,
      result_status: 201,
      result_body: { id: "g1" },
      result_reference: null,
    });

    const second = await svc.check(ACTOR, "op_123", hash);
    expect(second && "replay" in second).toBe(true);
    if (second && "replay" in second) {
      expect(second.replay.result_status).toBe(201);
      expect(second.replay.result_body).toEqual({ id: "g1" });
    }
  });

  it("reusing a key with a different payload is a conflict", async () => {
    const { repo } = makeRepo();
    const svc = new IdempotencyService(repo);
    const h1 = await hashRequest("POST", "/api/v1/groups", '{"name":"A"}');
    const h2 = await hashRequest("POST", "/api/v1/groups", '{"name":"B"}');
    await svc.check(ACTOR, "op_123", h1);
    await expect(svc.check(ACTOR, "op_123", h2)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("requests without a key opt out (null)", async () => {
    const svc = new IdempotencyService(makeRepo().repo);
    expect(await svc.check(ACTOR, "", "x")).toBeNull();
  });

  it("request hashing is stable across method/path/body", async () => {
    const a = await hashRequest("POST", "/x", "{}");
    const b = await hashRequest("POST", "/x", "{}");
    const c = await hashRequest("PATCH", "/x", "{}");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
