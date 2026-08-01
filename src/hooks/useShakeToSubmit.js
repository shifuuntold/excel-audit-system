import { useEffect, useRef, useState } from "react";

const SHAKE_THRESHOLD = 18; // m/s² of combined acceleration change to count as a shake
const SHAKE_COOLDOWN_MS = 1500; // ignore further shakes for a bit after one fires, so a single hard shake doesn't fire twice

function detectMotionSupport() {
    const hasMotion = typeof window !== "undefined" && "DeviceMotionEvent" in window;
    if (!hasMotion) return { supported: false, needsPermission: false };

    // iOS 13+ gates motion events behind an explicit permission prompt
    // that can only be triggered from a user gesture (a tap).
    const needsPermission = typeof window.DeviceMotionEvent.requestPermission === "function";
    return { supported: true, needsPermission };
}

/**
 * Lets a rep shake their phone to submit the audit instead of reaching for
 * the button — handy when they're holding a clipboard/stock in the other
 * hand. Works on Android out of the box; iOS 13+ requires a tap first to
 * grant motion-sensor permission, so this exposes `needsPermission` and
 * `requestPermission` for the caller to wire up a one-tap "Enable" prompt.
 *
 * Does nothing on devices without a motion sensor (most laptops/desktops).
 */
export function useShakeToSubmit({ onShake, enabled = true }) {
    const [{ supported, needsPermission }] = useState(detectMotionSupport);
    const [permissionGranted, setPermissionGranted] = useState(() => !detectMotionSupport().needsPermission);

    const lastValues = useRef(null);
    const lastShakeAt = useRef(0);
    const onShakeRef = useRef(onShake);
    useEffect(() => {
        onShakeRef.current = onShake;
    }, [onShake]);

    useEffect(() => {
        if (!enabled || !supported || !permissionGranted) return;

        function handleMotion(event) {
            const acceleration = event.accelerationIncludingGravity || event.acceleration;
            if (!acceleration) return;

            const { x, y, z } = acceleration;
            if (x == null || y == null || z == null) return;

            if (lastValues.current) {
                const delta =
                    Math.abs(x - lastValues.current.x) +
                    Math.abs(y - lastValues.current.y) +
                    Math.abs(z - lastValues.current.z);

                const now = Date.now();
                if (delta > SHAKE_THRESHOLD && now - lastShakeAt.current > SHAKE_COOLDOWN_MS) {
                    lastShakeAt.current = now;
                    onShakeRef.current?.();
                }
            }

            lastValues.current = { x, y, z };
        }

        window.addEventListener("devicemotion", handleMotion);
        return () => window.removeEventListener("devicemotion", handleMotion);
    }, [enabled, supported, permissionGranted]);

    async function requestPermission() {
        try {
            const result = await window.DeviceMotionEvent.requestPermission();
            const granted = result === "granted";
            setPermissionGranted(granted);
            return granted;
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    return {
        // True once the feature is actually armed and listening.
        shakeToSubmitActive: supported && permissionGranted,
        // True when we're on iOS and still waiting on a tap to grant permission.
        needsShakePermission: supported && needsPermission && !permissionGranted,
        requestShakePermission: requestPermission,
    };
}
