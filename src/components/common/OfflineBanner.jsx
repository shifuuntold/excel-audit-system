import { WifiOff, RefreshCw, CloudUpload } from "lucide-react";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import { B } from "../../config/theme";

export default function OfflineBanner() {
    const { isOnline, queueCount, syncing, sync } = useOfflineQueue();

    if (isOnline && queueCount === 0) return null;

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
                background: isOnline ? B.amber : "#4B5563",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isOnline ? <CloudUpload size={16} /> : <WifiOff size={16} />}
                <span>
                    {isOnline
                        ? `${queueCount} audit${queueCount === 1 ? "" : "s"} waiting to sync`
                        : queueCount > 0
                            ? `Offline — ${queueCount} audit${queueCount === 1 ? "" : "s"} saved locally`
                            : "You're offline — new audits will be saved locally"}
                </span>
            </div>

            {isOnline && queueCount > 0 && (
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
    );
}
