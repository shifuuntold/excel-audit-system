import { useCallback, useRef, useState } from "react";
import { AuditContext } from "./auditContextObject";
import { BLANK_AUDIT } from "./auditConstants";

const STORAGE_PREFIX = "excel_audit_draft:";

function readDraft(key) {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeDraft(key, audit) {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(audit));
    } catch {
        // storage full/unavailable — non-fatal, just means no refresh protection
    }
}

function clearDraftStorage(key) {
    try {
        localStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
        // ignore
    }
}

/**
 * Holds the in-progress audit being filled out, and mirrors it to
 * localStorage so an accidental refresh doesn't wipe out work a rep has
 * already entered. Each draft is keyed separately ("new", or
 * "edit:<auditId>") so a fresh audit and an in-progress edit never
 * collide with each other's saved draft.
 */
export function AuditProvider({ children }) {
    const [audit, setAuditState] = useState(BLANK_AUDIT);
    const draftKeyRef = useRef(null);

    // Wraps setAudit so every change also persists to the active draft key.
    const setAudit = useCallback((updater) => {
        setAuditState((prev) => {
            const next = typeof updater === "function" ? updater(prev) : updater;
            if (draftKeyRef.current) writeDraft(draftKeyRef.current, next);
            return next;
        });
    }, []);

    /** Peek without side effects — used to check for a draft before deciding whether to re-fetch from the server (e.g. when opening an edit). */
    const peekDraft = useCallback((key) => readDraft(key), []);

    /** Start (or resume) a draft under the given key. */
    const beginDraft = useCallback((key, initialAudit) => {
        draftKeyRef.current = key;
        writeDraft(key, initialAudit);
        setAuditState(initialAudit);
    }, []);

    /** Call after a successful submit/save, or to discard a restored draft. */
    const clearDraft = useCallback(() => {
        if (draftKeyRef.current) clearDraftStorage(draftKeyRef.current);
        draftKeyRef.current = null;
        setAuditState(BLANK_AUDIT);
    }, []);

    return (
        <AuditContext.Provider
            value={{
                audit,
                setAudit,
                peekDraft,
                beginDraft,
                clearDraft,
            }}
        >
            {children}
        </AuditContext.Provider>
    );
}
