import { useCallback, useEffect, useState } from "react";
import { getQueueCount, syncQueue } from "../services/offlineQueue";
import { saveAudit } from "../services/auditService";
import { useOnlineStatus } from "./useOnlineStatus";

export function useOfflineQueue() {
    const isOnline = useOnlineStatus();
    const [queueCount, setQueueCount] = useState(getQueueCount());
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        function refresh() { setQueueCount(getQueueCount()); }
        window.addEventListener("offline-queue-changed", refresh);
        return () => window.removeEventListener("offline-queue-changed", refresh);
    }, []);

    const sync = useCallback(async () => {
        if (!navigator.onLine) return { synced: 0, failed: 0 };
        setSyncing(true);
        try {
            const result = await syncQueue(saveAudit);
            setQueueCount(getQueueCount());
            return result;
        } finally {
            setSyncing(false);
        }
    }, []);

    // auto-sync whenever connectivity returns
    useEffect(() => {
        if (isOnline && queueCount > 0) {
            sync();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOnline]);

    return { isOnline, queueCount, syncing, sync };
}
