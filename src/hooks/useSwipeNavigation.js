import { useRef } from "react";

const EDGE_EXCLUSION = 24;   // px from either screen edge to ignore entirely
const SWIPE_THRESHOLD = 60;  // px of horizontal travel required to count as a swipe
const DIRECTION_RATIO = 1.5; // horizontal movement must clearly dominate vertical

/**
 * Detects a deliberate horizontal swipe, while staying out of the way of:
 *  - the native edge-swipe "go back" gesture (swipes starting within
 *    EDGE_EXCLUSION of either edge are ignored completely), and
 *  - ordinary vertical scrolling (a gesture is only treated as a swipe
 *    once its horizontal travel clearly dominates its vertical travel).
 *
 * Attach the returned handlers to the swipeable container, and put
 * `touchAction: "pan-y"` in that container's style — that CSS is what
 * actually stops the browser from doing anything of its own with
 * horizontal touches, so this hook never needs preventDefault().
 */
export function useSwipeNavigation({ onSwipeLeft, onSwipeRight, disabled = false }) {
    const touchState = useRef(null);

    function onTouchStart(e) {
        if (disabled) return;
        const touch = e.touches[0];
        const startX = touch.clientX;

        if (startX < EDGE_EXCLUSION || startX > window.innerWidth - EDGE_EXCLUSION) {
            touchState.current = null;
            return;
        }

        touchState.current = {
            startX,
            startY: touch.clientY,
            locked: null, // becomes "horizontal" or "vertical" once movement is unambiguous
        };
    }

    function onTouchMove(e) {
        const state = touchState.current;
        if (!state) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - state.startX;
        const deltaY = touch.clientY - state.startY;

        if (!state.locked) {
            if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
            state.locked = Math.abs(deltaX) > Math.abs(deltaY) * DIRECTION_RATIO ? "horizontal" : "vertical";
        }
    }

    function onTouchEnd(e) {
        const state = touchState.current;
        touchState.current = null;
        if (!state || state.locked !== "horizontal") return;

        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - state.startX;
        if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;

        if (deltaX < 0) onSwipeLeft?.();
        else onSwipeRight?.();
    }

    return { onTouchStart, onTouchMove, onTouchEnd };
}
