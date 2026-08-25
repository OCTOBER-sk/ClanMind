import { describe, expect, it } from "vitest";
import { AppError } from "@clanmind/shared";
import { assertProjectInGroup } from "../src/project-guard";
import { canViewRun } from "../src/handlers/ai";

/**
 * Regression tests for BACKEND_AUDIT2_REPORT §6 blocking items M2 and M4.
 * M2: a client-supplied project_id must belong to the target Group.
 * M4: AI-run metadata is readable only by the requester or an OWNER/ADMIN.
 */

function dbWithProject(projectId: string | null, groupId: string | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: projectId === null ? null : { group_id: groupId },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("M2: project_id must belong to the Group (BACKEND_AUDIT2 §6)", () => {
  it("accepts a project owned by the target Group", async () => {
    const db = dbWithProject("p1", "g1");
    await expect(assertProjectInGroup(db, "p1", "g1")).resolves.toBeUndefined();
  });

  it("rejects a project that belongs to ANOTHER Group (cross-group reference)", async () => {
    const db = dbWithProject("p-foreign", "g2");
    await expect(assertProjectInGroup(db, "p-foreign", "g1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects a nonexistent project id", async () => {
    const db = dbWithProject(null, null);
    await expect(assertProjectInGroup(db, "p-missing", "g1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("is a strict equality check, never a membership-equality shortcut", async () => {
    // Even if the attacker is a member of BOTH groups, the project's owning
    // group must literally equal the target group.
    const db = dbWithProject("p-shared", "g2");
    await expect(assertProjectInGroup(db, "p-shared", "g1")).rejects.toBeInstanceOf(AppError);
  });
});

describe("M4: AI-run metadata authorization (BACKEND_AUDIT2 §6)", () => {
  it("the run's requester may always read their own run", () => {
    expect(canViewRun("u1", "MEMBER", "u1")).toBe(true);
  });

  it("an OWNER or ADMIN may read any run in the Group", () => {
    expect(canViewRun("admin", "ADMIN", "someone-else")).toBe(true);
    expect(canViewRun("owner", "OWNER", "someone-else")).toBe(true);
  });

  it("an ordinary MEMBER cannot read another member's run (PRIVATE_AI leak)", () => {
    expect(canViewRun("member", "MEMBER", "private-runner")).toBe(false);
  });

  it("a GUEST cannot read another member's run", () => {
    expect(canViewRun("guest", "GUEST", "private-runner")).toBe(false);
  });

  it("MEMBER role never grants cross-user reads regardless of id ordering", () => {
    expect(canViewRun("u2", "MEMBER", "u1")).toBe(false);
  });
});
