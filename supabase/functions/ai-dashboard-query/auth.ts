// Authorization for the AI Edge Function
// =====================================================================
// WHY THIS EXISTS: the function queries the database with the service-role
// key, which bypasses row-level security. The original code never looked
// at who was calling, so the only thing keeping an auditor (or anyone
// holding the public anon key, which is a valid JWT) away from team-wide
// data was that the React app hid the assistant button. Hiding a button
// is not access control.
//
// RULES
//   * every request needs a signed-in USER token. The anon key alone is a
//     valid JWT but has no user, so it is rejected (401).
//   * the role is read server-side from the profiles table, never taken
//     from the request body.
//   * query / weekly_brief expose team-wide aggregates: supervisor, admin.
//   * full_report narrates a report the client built from data it was
//     already allowed to read (an auditor's own audits): any signed-in role.
//     The function does no database access in that mode.
// Supervisors currently see ALL audits in this application (roles.js:
// canViewAllAudits), and there is no team/area table, so "supervisor"
// means organisation-wide here. Per-supervisor area scoping would need a
// new data model and is future work.
// =====================================================================

export type Role = "auditor" | "supervisor" | "admin";
export type Mode = "query" | "weekly_brief" | "full_report";

export const MODES: readonly Mode[] = ["query", "weekly_brief", "full_report"];

export const MODE_ROLES: Record<Mode, readonly Role[]> = {
  query: ["supervisor", "admin"],
  weekly_brief: ["supervisor", "admin"],
  full_report: ["auditor", "supervisor", "admin"],
};

export type AuthDecision =
  | { allowed: true; userId: string; role: Role; mode: Mode }
  | { allowed: false; status: 400 | 401 | 403; error: string };

export interface AuthDeps {
  /** Validates the token with the auth server; null when it is not a real user session. */
  getUser(token: string): Promise<{ id: string } | null>;
  /** Reads profiles.role with trusted (server) credentials. */
  getRole(userId: string): Promise<string | null>;
}

export function extractBearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return m ? m[1] : null;
}

export function isRole(value: unknown): value is Role {
  return value === "auditor" || value === "supervisor" || value === "admin";
}

export function parseMode(value: unknown): Mode | null {
  if (value === undefined || value === null) return "query";
  return (MODES as readonly unknown[]).includes(value) ? (value as Mode) : null;
}

export async function authorize(
  authorizationHeader: string | null | undefined,
  requestedMode: unknown,
  deps: AuthDeps,
): Promise<AuthDecision> {
  const mode = parseMode(requestedMode);
  if (!mode) return { allowed: false, status: 400, error: "Unknown request mode." };

  const token = extractBearerToken(authorizationHeader);
  if (!token) return { allowed: false, status: 401, error: "Sign in to use the AI assistant." };

  let user: { id: string } | null = null;
  try {
    user = await deps.getUser(token);
  } catch {
    user = null;
  }
  if (!user?.id) return { allowed: false, status: 401, error: "Your session is not valid. Please sign in again." };

  let role: string | null = null;
  try {
    role = await deps.getRole(user.id);
  } catch {
    role = null;
  }
  if (!isRole(role)) return { allowed: false, status: 403, error: "Your account has no permission to use the AI assistant." };

  if (!MODE_ROLES[mode].includes(role)) {
    return { allowed: false, status: 403, error: "Your role does not have access to this AI feature." };
  }
  return { allowed: true, userId: user.id, role, mode };
}
