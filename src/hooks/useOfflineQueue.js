import { useCallback, useEffect, useState } from "react";
import { getQueueCount, getStuckCount, syncQueue, getQueuedAudits, removeFromQueue } from "../services/offlineQueue";
import { saveAudit } from "../services/auditService";
import { useOnlineStatus } from "./useOnlineStatus";

export function useOfflineQueue() {
    const isOnline = useOnlineStatus();
    const [queueCount, setQueueCount] = useState(getQueueCount());
    const [stuckCount, setStuckCount] = useState(getStuckCount());
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        function refresh() {
            setQueueCount(getQueueCount());
            setStuckCount(getStuckCount());
        }
        window.addEventListener("offline-queue-changed", refresh);
        return () => window.removeEventListener("offline-queue-changed", refresh);
    }, []);

    const sync = useCallback(async () => {
        if (!navigator.onLine) return { synced: 0, failed: 0 };
        setSyncing(true);
        try {
            const result = await syncQueue(saveAudit);
            setQueueCount(getQueueCount());
            setStuckCount(getStuckCount());
            return result;
        } finally {
            setSyncing(false);
        }
    }, []);

    const discardStuck = useCallback(() => {
        for (const item of getQueuedAudits().filter((i) => (i.failCount || 0) >= 3)) {
            removeFromQueue(item.localId);
        }
        setQueueCount(getQueueCount());
        setStuckCount(getStuckCount());
    }, []);

    // auto-sync whenever connectivity returns
    useEffect(() => {
        if (isOnline && queueCount > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            sync();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOnline]);

    return { isOnline, queueCount, stuckCount, syncing, sync, discardStuck };
}
