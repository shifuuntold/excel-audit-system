// Robust wrapper around the Web Speech API's speechSynthesis.
//
// A single long SpeechSynthesisUtterance reliably stops partway through
// on Chrome (a long-documented Chromium bug — speech just stops after
// roughly the first sentence or two, with no error event, as if the
// utterance ended normally). It's not particular to this app; it's a
// known limitation of the browser API itself when a single utterance
// runs past a short duration.
//
// The standard, reliable workaround: split the text into short chunks
// (sentence-by-sentence, so a listener never hears an unnatural cut) and
// chain them — start the next chunk's utterance from the previous
// chunk's onend callback, rather than handing the browser one giant
// utterance and hoping it survives.

function splitIntoChunks(text) {
    // Split on sentence-ending punctuation, keeping the punctuation.
    // Falls back to comma/newline splits for any single "sentence" that's
    // still unreasonably long (e.g. a run-on bullet list joined with commas).
    const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [text];

    const MAX_CHUNK = 200;
    const chunks = [];
    for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (!trimmed) continue;
        if (trimmed.length <= MAX_CHUNK) {
            chunks.push(trimmed);
            continue;
        }
        // Even a single sentence can be too long (rare, but a giant
        // semicolon-joined list would hit this) — break on commas next.
        let remainder = trimmed;
        while (remainder.length > MAX_CHUNK) {
            let splitAt = remainder.lastIndexOf(", ", MAX_CHUNK);
            if (splitAt < 20) splitAt = MAX_CHUNK; // no good comma break — just cut
            chunks.push(remainder.slice(0, splitAt).trim());
            remainder = remainder.slice(splitAt).trim();
        }
        if (remainder) chunks.push(remainder);
    }
    return chunks.length > 0 ? chunks : [text];
}

/**
 * Speaks `text` reliably regardless of length, chaining short utterances
 * instead of handing the browser one long one. Returns a controller with
 * stop()/pause()/resume(); call stop() on unmount so a report doesn't
 * keep talking after the person navigates away.
 */
export function speakText(text, { onEnd, onError } = {}) {
    if (!("speechSynthesis" in window)) {
        onError?.(new Error("Speech synthesis is not supported in this browser."));
        return { stop() {}, pause() {}, resume() {} };
    }

    const chunks = splitIntoChunks(text);
    let index = 0;
    let stopped = false;

    function speakNext() {
        if (stopped) return;
        if (index >= chunks.length) {
            onEnd?.();
            return;
        }
        const utterance = new SpeechSynthesisUtterance(chunks[index]);
        index++;
        utterance.onend = speakNext;
        utterance.onerror = (event) => {
            // "interrupted" and "canceled" fire from our own stop() call —
            // that's an intentional stop, not a real failure.
            if (event.error === "interrupted" || event.error === "canceled") return;
            onError?.(new Error(`Speech synthesis error: ${event.error}`));
        };
        window.speechSynthesis.speak(utterance);
    }

    speakNext();

    return {
        stop() {
            stopped = true;
            window.speechSynthesis.cancel();
        },
        pause() {
            window.speechSynthesis.pause();
        },
        resume() {
            window.speechSynthesis.resume();
        },
    };
}

export function stopSpeaking() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
