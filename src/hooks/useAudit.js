import { useContext } from "react";
import { AuditContext } from "../contexts/auditContextObject";

export function useAudit() {
    return useContext(AuditContext);
}
