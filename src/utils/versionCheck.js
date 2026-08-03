// Detects when a new version of the app has been deployed while this tab
// is still running an old one — the actual root cause of "shows the old
// layout until I refresh". Cache headers (see vercel.json) only affect
// what happens on the NEXT fresh request; they do nothing for a tab
// that's already loaded and just keeps running, which is exactly what
// happens in a single-page app with client-side routing — navigating
// around the app never re-fetches index.html on its own.
//
// The check itself: re-fetch index.html (bypassing cache) and compare it
// to the copy captured when the app first loaded. Vite's build hashes
// every JS/CSS filename by content, so a new deploy always changes the
// script tag inside index.html even when nothing else about the page
// visibly differs — that makes index.html's raw text a reliable,
// zero-infrastructure stand-in for a real "build version" marker.

let baselineHtml = null;

export async function captureBaseline() {
    try {
        const res = await fetch("/index.html", { cache: "no-store" });
        baselineHtml = await res.text();
    } catch (err) {
        // If this fails (offline, etc.) there's nothing to compare against
        // yet — just skip silently, the next check attempt will retry.
        console.error("Failed to capture baseline version:", err);
    }
}

/** Returns true if a newer deployment now exists than the one this tab
 * loaded with. Never throws — a failed check (offline, etc.) just
 * reports "no update" rather than a false positive. */
export async function isUpdateAvailable() {
    if (!baselineHtml) return false;
    try {
        const res = await fetch("/index.html", { cache: "no-store" });
        const current = await res.text();
        return current !== baselineHtml;
    } catch {
        return false;
    }
}
