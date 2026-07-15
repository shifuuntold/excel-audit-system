import { findOrCreateArea } from "./areaService";

const QUEUE_KEY = "excel_audit_offline_queue_v1";

function readQueue() {
    try {
        const raw = localStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function writeQueue(queue) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent("offline-queue-changed"));
}

export function queueAudit(payload) {
    const queue = readQueue();
    queue.push({
        localId: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        queuedAt: new Date().toISOString(),
        payload,
    });
    writeQueue(queue);
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
 * Removes items on success, leaves failures queued for the next try.
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
            failed++;
        }
    }

    return { synced, failed };
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
