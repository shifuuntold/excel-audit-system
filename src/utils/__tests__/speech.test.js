import { describe, it, expect, vi, beforeEach } from "vitest";
import { speakText } from "../speech";

class MockUtterance {
    constructor(text) {
        this.text = text;
        this.onend = null;
        this.onerror = null;
    }
}

describe("speakText", () => {
    let spoken;
    let queuedUtterances;

    beforeEach(() => {
        spoken = [];
        queuedUtterances = [];
        global.SpeechSynthesisUtterance = MockUtterance;
        global.window = global.window || {};
        global.window.speechSynthesis = {
            speak: vi.fn((utterance) => {
                spoken.push(utterance.text);
                queuedUtterances.push(utterance);
            }),
            cancel: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
        };
    });

    function finishCurrentUtterance() {
        const utterance = queuedUtterances[queuedUtterances.length - 1];
        utterance.onend?.();
    }

    it("splits a multi-sentence report into separate chunks instead of one long utterance", () => {
        const text = "Coverage is strong this month. Promotion activity remains low. Distributors are mostly stable.";
        speakText(text);

        expect(spoken.length).toBe(1);
        expect(spoken[0]).toContain("Coverage is strong this month.");
    });

    it("speaks every chunk in order as each finishes, and calls onEnd only after the last one", () => {
        const text = "First sentence here. Second sentence here. Third sentence here.";
        const onEnd = vi.fn();
        speakText(text, { onEnd });

        expect(spoken.length).toBe(1);
        finishCurrentUtterance();
        expect(spoken.length).toBe(2);
        expect(onEnd).not.toHaveBeenCalled();

        finishCurrentUtterance();
        expect(spoken.length).toBe(3);
        expect(onEnd).not.toHaveBeenCalled();

        finishCurrentUtterance();
        expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("this is the actual bug being fixed: a long report is never handed to the browser as one utterance", () => {
        const longReport = Array.from({ length: 8 }, (_, i) => `This is report sentence number ${i + 1} with some detail in it.`).join(" ");
        speakText(longReport);

        expect(spoken[0].length).toBeLessThan(longReport.length);
    });

    it("stop() cancels synthesis and prevents any further chunks from being queued", () => {
        const text = "First sentence here. Second sentence here.";
        const controller = speakText(text);
        controller.stop();

        expect(global.window.speechSynthesis.cancel).toHaveBeenCalled();

        finishCurrentUtterance();
        expect(spoken.length).toBe(1);
    });

    it("treats an interrupted/canceled error as a normal stop, not a failure", () => {
        const onError = vi.fn();
        speakText("Some text.", { onError });
        const utterance = queuedUtterances[0];
        utterance.onerror({ error: "interrupted" });
        expect(onError).not.toHaveBeenCalled();
    });

    it("reports a real synthesis error", () => {
        const onError = vi.fn();
        speakText("Some text.", { onError });
        const utterance = queuedUtterances[0];
        utterance.onerror({ error: "synthesis-failed" });
        expect(onError).toHaveBeenCalledTimes(1);
    });
});
