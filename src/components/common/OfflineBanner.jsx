import { WifiOff, RefreshCw, CloudUpload, AlertTriangle } from "lucide-react";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import { B } from "../../config/theme";

export default function OfflineBanner() {
    const { isOnline, queueCount, stuckCount, syncing, sync, discardStuck } = useOfflineQueue();

    // Only shows when there's something actually queued to sync — pure
    // "you're offline" awareness (with nothing saved yet) already comes
    // from ConnectivityToast's transient slide-down notice, so this
    // banner isn't needed for that and previously just sat there
    // indefinitely saying "new audits will be saved" with nothing to act
    // on, which was the actual complaint: it never went away.
    if (queueCount === 0) return null;

    const pendingCount = queueCount - stuckCount;

    function handleDiscard() {
        if (confirm(`Discard ${stuckCount} audit${stuckCount === 1 ? "" : "s"} that couldn't be saved? This can't be undone.`)) {
            discardStuck();
        }
    }

    return (
        <div
            style={{
                position: "sticky",
                top: 0,
                zIndex: 50,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: stuckCount > 0 ? B.red : isOnline ? B.amber : "#4B5563",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {stuckCount > 0 ? <AlertTriangle size={16} /> : isOnline ? <CloudUpload size={16} /> : <WifiOff size={16} />}
                <span>
                    {stuckCount > 0
                        ? `${stuckCount} audit${stuckCount === 1 ? "" : "s"} couldn't be saved${pendingCount > 0 ? ` · ${pendingCount} still syncing` : ""}`
                        : isOnline
                            ? `${queueCount} audit${queueCount === 1 ? "" : "s"} waiting to sync`
                            : `Offline — ${queueCount} audit${queueCount === 1 ? "" : "s"} saved locally`}
                </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {stuckCount > 0 && (
                    <button
                        onClick={handleDiscard}
                        style={{
                            background: "rgba(255,255,255,0.2)",
                            border: "none",
                            borderRadius: 8,
                            padding: "5px 10px",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        Discard
                    </button>
                )}
                {isOnline && pendingCount > 0 && (
                    <button
                        onClick={sync}
                        disabled={syncing}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: "rgba(255,255,255,0.2)",
                            border: "none",
                            borderRadius: 8,
                            padding: "5px 10px",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: syncing ? "not-allowed" : "pointer",
                        }}
                    >
                        <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
                        {syncing ? "Syncing..." : "Sync Now"}
                    </button>
                )}
            </div>
        </div>
    );
}
