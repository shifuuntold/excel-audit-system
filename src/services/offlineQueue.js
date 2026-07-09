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
            await saveAuditFn(item.payload);
            removeFromQueue(item.localId);
            synced++;
        } catch (error) {
            console.error("Sync failed for", item.localId, error);
            failed++;
        }
    }

    return { synced, failed };
}
