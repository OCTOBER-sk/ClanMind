import { describe, expect, it } from "vitest";
import type { Profile } from "@clanmind/domain";
import { createApp } from "../src/app";
import { TEST_ENV, U, makeTestServices, tokenFor } from "./utils";

describe("§104 GET/PATCH /api/v1/me", () => {
  it("returns 401 with the §102 envelope when unauthenticated", async () => {
    const { services } = makeTestServices();
    const app = createApp(services);
    const res = await app.request("/api/v1/me", {}, TEST_ENV);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(res.headers.get("x-request-id")).toMatch(/^req_/);
  });

  it("provisions and returns the profile for a valid token", async () => {
    const { services, profileRows } = makeTestServices();
    const app = createApp(services);
    const token = await tokenFor(U.OWNER);
    const res = await app.request(
      "/api/v1/me",
      { headers: { authorization: `Bearer ${token}` } },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const profile = (await res.json()) as Profile;
    expect(profile.id).toBe(U.OWNER);
    expect(profileRows).toHaveLength(1);
  });

  it("patches display_name", async () => {
    const { services } = makeTestServices();
    const app = createApp(services);
    const token = await tokenFor(U.OWNER);
    const res = await app.request(
      "/api/v1/me",
      {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ display_name: "Santhoshkumar" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const profile = (await res.json()) as Profile;
    expect(profile.display_name).toBe("Santhoshkumar");
  });

  it("returns VALIDATION_FAILED for an invalid patch body", async () => {
    const { services } = makeTestServices();
    const app = createApp(services);
    const token = await tokenFor(U.OWNER);
    const res = await app.request(
      "/api/v1/me",
      {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ display_name: "" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });
});
