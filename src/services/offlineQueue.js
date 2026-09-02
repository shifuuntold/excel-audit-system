import { findOrCreateArea } from "./areaService";

const QUEUE_KEY = "excel_audit_offline_queue_v1";

function readQueue() {
    try {
        const raw = localStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.error("Failed to read the offline audit queue from storage:", error);
        return [];
    }
}

function writeQueue(queue) {
    try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        window.dispatchEvent(new CustomEvent("offline-queue-changed"));
        return true;
    } catch (error) {
        // Storage quota exceeded, private-browsing restrictions, etc. This
        // is the one failure mode that must never happen silently: it's
        // the moment we're specifically trying to protect an audit from
        // being lost while offline, so the caller needs to know the save
        // didn't actually happen rather than assuming it did.
        console.error("Failed to write the offline audit queue to storage:", error);
        return false;
    }
}

/** Returns true if the audit was actually queued, false if local storage
 * itself failed to accept it — the one case a caller must not treat as
 * "saved for later" (see writeQueue's comment). */
export function queueAudit(payload) {
    const queue = readQueue();
    queue.push({
        localId: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        queuedAt: new Date().toISOString(),
        payload,
    });
    return writeQueue(queue);
}

export function getQueuedAudits() {
    return readQueue();
}

export function getQueueCount() {
    return readQueue().length;
}

export function removeFromQueue(localId) {
    writeQueue(readQueue().filter((item) => item.localId !== localId));
}

export function clearQueue() {
    writeQueue([]);
}

/**
 * Attempts to push every queued audit to Supabase via saveAudit.
 * Removes items on success. A failure is left queued for the next try,
 * with its failCount incremented — after a few failures in a row (a
 * validation error, not a connectivity blip, since a real offline retry
 * never even reaches saveAuditFn to fail this way) it's very unlikely to
 * ever succeed on its own, so the UI needs to be able to show it as
 * stuck and offer to discard it rather than silently retrying forever
 * with no way for anyone to know why the banner won't go away.
 */
export async function syncQueue(saveAuditFn) {
    const queue = readQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    for (const item of queue) {
        try {
            const payload = await resolveAreaIfNeeded(item.payload);
            await saveAuditFn(payload);
            removeFromQueue(item.localId);
            synced++;
        } catch (error) {
            console.error("Sync failed for", item.localId, error);
            const current = readQueue();
            writeQueue(
                current.map((q) =>
                    q.localId === item.localId ? { ...q, failCount: (q.failCount || 0) + 1 } : q
                )
            );
            failed++;
        }
    }

    return { synced, failed };
}

/** Items that have failed enough times in a row that they're treating as
 * stuck rather than "waiting for connectivity" — surfaced separately so
 * the banner has something concrete to say instead of just retrying
 * forever silently. */
export function getStuckCount(threshold = 3) {
    return readQueue().filter((item) => (item.failCount || 0) >= threshold).length;
}

// An audit captured offline may only have a typed area_name and no real
// area_id yet (there was no connection to search/save it against the
// areas table at the time). Resolve that for real now that we're back
// online, matching an existing area or creating a new one.
async function resolveAreaIfNeeded(payload) {
    if (payload.outlet?.area_id || !payload.outlet?.area_name) return payload;

    const area = await findOrCreateArea(payload.outlet.area_name);
    return {
        ...payload,
        outlet: {
            ...payload.outlet,
            area_id: area.id,
            area_name: area.name,
        },
    };
}
