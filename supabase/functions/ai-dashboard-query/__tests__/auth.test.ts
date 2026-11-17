import { describe, it, expect } from "vitest";
import { MODE_ROLES, authorize, extractBearerToken, parseMode } from "../auth.ts";

const SUPERVISOR = "tok-supervisor", ADMIN = "tok-admin", AUDITOR = "tok-auditor", NOPROFILE = "tok-noprofile", WEIRD = "tok-weird";
const users: Record<string, { id: string }> = {
  [SUPERVISOR]: { id: "u-sup" }, [ADMIN]: { id: "u-adm" }, [AUDITOR]: { id: "u-aud" }, [NOPROFILE]: { id: "u-none" }, [WEIRD]: { id: "u-weird" },
};
const roles: Record<string, string> = { "u-sup": "supervisor", "u-adm": "admin", "u-aud": "auditor", "u-weird": "superuser" };
// The public anon key is a valid JWT, but it identifies no user.
const deps = {
  getUser: async (t: string) => users[t] ?? null,
  getRole: async (id: string) => roles[id] ?? null,
};
const bearer = (t: string) => `Bearer ${t}`;

describe("authorization of the AI Edge Function", () => {
  it("rejects a request with no Authorization header (401)", async () => {
    expect(await authorize(null, "query", deps)).toMatchObject({ allowed: false, status: 401 });
  });
  it("rejects the public anon key: a valid JWT with no user (401)", async () => {
    expect(await authorize(bearer("anon-key-jwt"), "query", deps)).toMatchObject({ allowed: false, status: 401 });
    expect(await authorize(bearer("anon-key-jwt"), "weekly_brief", deps)).toMatchObject({ allowed: false, status: 401 });
  });
  it("rejects a malformed header (401)", async () => {
    for (const h of ["", "Basic abc", "Bearer", "token-only"]) expect(await authorize(h, "query", deps)).toMatchObject({ allowed: false, status: 401 });
  });
  it("treats an auth-server failure as unauthenticated, not as allowed", async () => {
    const broken = { ...deps, getUser: async () => { throw new Error("down"); } };
    expect(await authorize(bearer(SUPERVISOR), "query", broken)).toMatchObject({ allowed: false, status: 401 });
  });
  it("an AUDITOR is refused team-wide modes (403)", async () => {
    expect(await authorize(bearer(AUDITOR), "query", deps)).toMatchObject({ allowed: false, status: 403 });
    expect(await authorize(bearer(AUDITOR), "weekly_brief", deps)).toMatchObject({ allowed: false, status: 403 });
  });
  it("an auditor may use full_report (own report narration, no database access)", async () => {
    expect(await authorize(bearer(AUDITOR), "full_report", deps)).toMatchObject({ allowed: true, role: "auditor" });
  });
  it("a SUPERVISOR may use all three modes", async () => {
    for (const m of ["query", "weekly_brief", "full_report"]) expect(await authorize(bearer(SUPERVISOR), m, deps)).toMatchObject({ allowed: true, role: "supervisor" });
  });
  it("an ADMIN may use all three modes", async () => {
    for (const m of ["query", "weekly_brief", "full_report"]) expect(await authorize(bearer(ADMIN), m, deps)).toMatchObject({ allowed: true, role: "admin" });
  });
  it("a signed-in user with no profile, or an unknown role, is refused (403)", async () => {
    expect(await authorize(bearer(NOPROFILE), "query", deps)).toMatchObject({ allowed: false, status: 403 });
    expect(await authorize(bearer(WEIRD), "query", deps)).toMatchObject({ allowed: false, status: 403 });
  });
  it("a role lookup failure denies access", async () => {
    const broken = { ...deps, getRole: async () => { throw new Error("db down"); } };
    expect(await authorize(bearer(SUPERVISOR), "query", broken)).toMatchObject({ allowed: false, status: 403 });
  });
  it("role comes only from the server lookup: nothing in the request can raise it", async () => {
    // authorize() has no parameter through which a client-supplied role could enter.
    expect(authorize.length).toBe(3);
    expect(await authorize(bearer(AUDITOR), "query", deps)).toMatchObject({ allowed: false });
  });
  it("an unknown mode is a 400, and the default mode is query", async () => {
    expect(await authorize(bearer(SUPERVISOR), "export_everything", deps)).toMatchObject({ allowed: false, status: 400 });
    expect(parseMode(undefined)).toBe("query");
  });
  it("the policy table is exactly as documented", () => {
    expect(MODE_ROLES.query).toEqual(["supervisor", "admin"]);
    expect(MODE_ROLES.weekly_brief).toEqual(["supervisor", "admin"]);
    expect(MODE_ROLES.full_report).toEqual(["auditor", "supervisor", "admin"]);
    expect(extractBearerToken("Bearer abc")).toBe("abc");
  });
});
