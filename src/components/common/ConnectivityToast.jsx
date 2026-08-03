import { useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { Wifi, WifiOff } from "lucide-react";

const AUTO_HIDE_MS = 3000;

/**
 * A transient "connection lost / restored" toast, distinct from
 * OfflineBanner (which shows ongoing sync-queue status and stays up for as
 * long as there's queued work). This one only reacts to the *moment* of a
 * connectivity change — slides down, announces it, and for "restored"
 * auto-dismisses after a few seconds. Deliberately doesn't show anything
 * on first load even if already offline; it's about noticing a change
 * during the session, not describing the current state (OfflineBanner
 * already does that).
 */
export default function ConnectivityToast() {
    const isOnline = useOnlineStatus();
    const [toast, setToast] = useState(null); // "online" | "offline" | null
    const previousOnline = useRef(isOnline);
    const hideTimer = useRef(null);

    useEffect(() => {
        if (isOnline === previousOnline.current) return;
        previousOnline.current = isOnline;

        clearTimeout(hideTimer.current);
        setToast(isOnline ? "online" : "offline");

        if (isOnline) {
            hideTimer.current = setTimeout(() => setToast(null), AUTO_HIDE_MS);
        }
        // "offline" stays up until connectivity actually returns — no
        // point auto-hiding a warning that's still true.
    }, [isOnline]);

    useEffect(() => () => clearTimeout(hideTimer.current), []);

    if (!toast) return null;

    const isRestored = toast === "online";

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 200,
                display: "flex",
                justifyContent: "center",
                pointerEvents: "none",
                animation: "eb-toast-slide-down .25s ease",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 10,
                    padding: "9px 16px",
                    borderRadius: 20,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "#fff",
                    background: isRestored ? "#0A7A45" : "#C8102E",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
                    pointerEvents: "auto",
                }}
            >
                {isRestored ? <Wifi size={14} /> : <WifiOff size={14} />}
                {isRestored ? "Connection restored" : "No internet connection"}
            </div>
        </div>
    );
}
