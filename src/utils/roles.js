export const ROLES = {
    AUDITOR: "auditor",
    SUPERVISOR: "supervisor",
    ADMIN: "admin",
};

export const ROLE_LABELS = {
    [ROLES.AUDITOR]: "Auditor",
    [ROLES.SUPERVISOR]: "Supervisor",
    [ROLES.ADMIN]: "Admin",
};

// Supervisors and Admins can see every rep's audits/analytics; Auditors
// only ever see their own.
export function canViewAllAudits(role) {
    return role === ROLES.SUPERVISOR || role === ROLES.ADMIN;
}

export function isAdmin(role) {
    return role === ROLES.ADMIN;
}
