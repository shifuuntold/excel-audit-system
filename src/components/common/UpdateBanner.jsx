import { useEffect, useState } from "react";
import { captureBaseline, isUpdateAvailable } from "../../utils/versionCheck";
import { B } from "../../config/theme";
import { RefreshCw } from "lucide-react";

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Tells the person a new version has shipped while their tab was open,
 * and lets them reload on their own terms — never forces it, since this
 * is a field-audit app and a forced reload mid-entry would be a real
 * problem (drafts are saved locally, but there's no reason to risk it
 * when a simple prompt works just as well).
 *
 * Checks happen on an interval AND whenever the tab regains focus —
 * that second one matters most in practice: an auditor who leaves the
 * tab open overnight will trigger it the moment they come back, not
 * whenever the next poll happens to land.
 */
export default function UpdateBanner() {
    const [available, setAvailable] = useState(false);

    useEffect(() => {
        captureBaseline();

        async function check() {
            if (await isUpdateAvailable()) setAvailable(true);
        }

        const interval = setInterval(check, POLL_INTERVAL_MS);

        function onVisibilityChange() {
            if (document.visibilityState === "visible") check();
        }
        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("focus", check);

        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("focus", check);
        };
    }, []);

    if (!available) return null;

    return (
        <div
            style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 150,
                display: "flex",
                justifyContent: "center",
                padding: "0 12px 12px",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: B.blue,
                    color: "#fff",
                    borderRadius: 14,
                    padding: "12px 16px",
                    boxShadow: "0 8px 28px rgba(0,48,135,0.35)",
                    maxWidth: 420,
                    width: "100%",
                }}
            >
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, flex: 1, lineHeight: 1.4 }}>
                    A new version of the app is available.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexShrink: 0,
                        background: "#fff",
                        color: B.blue,
                        border: 0,
                        borderRadius: 10,
                        padding: "7px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                    }}
                >
                    <RefreshCw size={13} /> Reload
                </button>
            </div>
        </div>
    );
}
