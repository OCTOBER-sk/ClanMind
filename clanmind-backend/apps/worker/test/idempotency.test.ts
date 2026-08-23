import { describe, expect, it } from "vitest";
import type { Group } from "@clanmind/domain";
import { createApp } from "../src/app";
import { TEST_ENV, U, makeTestServices, tokenFor } from "./utils";

describe("§19 request idempotency", () => {
  it("replays the recorded result for a retried duplicate send", async () => {
    const { services, groupRows } = makeTestServices();
    const app = createApp(services);
    const headers = {
      authorization: `Bearer ${await tokenFor(U.OWNER)}`,
      "content-type": "application/json",
      "idempotency-key": "op_retry_001",
    };
    const body = JSON.stringify({ name: "Once Only" });

    const first = await app.request(
      "/api/v1/groups",
      { method: "POST", headers, body },
      TEST_ENV,
    );
    expect(first.status).toBe(201);
    const created = (await first.json()) as Group;
    expect(groupRows).toHaveLength(1);

    const retry = await app.request(
      "/api/v1/groups",
      { method: "POST", headers, body },
      TEST_ENV,
    );
    expect(retry.status).toBe(201);
    expect(retry.headers.get("idempotency-replayed")).toBe("true");
    const replayed = (await retry.json()) as Group;
    expect(replayed.id).toBe(created.id);
    // One logical operation — the offline client retried.
    expect(groupRows).toHaveLength(1);
  });

  it("conflicts when a key is reused with a different payload", async () => {
    const { services } = makeTestServices();
    const app = createApp(services);
    const token = await tokenFor(U.OWNER);
    const base = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "idempotency-key": "op_conflict_001",
    };
    const first = await app.request(
      "/api/v1/groups",
      { method: "POST", headers: base, body: JSON.stringify({ name: "A" }) },
      TEST_ENV,
    );
    expect(first.status).toBe(201);
    const conflict = await app.request(
      "/api/v1/groups",
      { method: "POST", headers: base, body: JSON.stringify({ name: "B" }) },
      TEST_ENV,
    );
    expect(conflict.status).toBe(409);
  });

  it("requests without a key behave normally", async () => {
    const { services, groupRows } = makeTestServices();
    const app = createApp(services);
    const headers = {
      authorization: `Bearer ${await tokenFor(U.OWNER)}`,
      "content-type": "application/json",
    };
    await app.request(
      "/api/v1/groups",
      { method: "POST", headers, body: JSON.stringify({ name: "X" }) },
      TEST_ENV,
    );
    await app.request(
      "/api/v1/groups",
      { method: "POST", headers, body: JSON.stringify({ name: "Y" }) },
      TEST_ENV,
    );
    expect(groupRows).toHaveLength(2);
  });
});
