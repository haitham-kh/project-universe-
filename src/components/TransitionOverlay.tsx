"use client";

import { useDirectorTransitionFx, useDirectorTransition2Fx } from "../lib/useDirector";

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSITION OVERLAY — Fullscreen vignette + color ramp + animated noise
//
// Pure CSS/DOM — zero GPU cost. Driven by Director transition state.
// Handles both Earth→Saturn (transitionFx) and Saturn→Neptune (transition2Fx)
// ═══════════════════════════════════════════════════════════════════════════════

// Shared fullscreen, non-interactive style
const FILL: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
};

// Color palettes per transition
const T1_COLORS = {
    start: "rgba(34, 211, 238, 0.15)",   // cyan
    mid: "rgba(200, 200, 200, 0.08)",     // neutral
    end: "rgba(255, 180, 50, 0.2)",       // warm amber
};

const T2_COLORS = {
    start: "rgba(255, 180, 50, 0.15)",    // warm amber
    mid: "rgba(100, 100, 120, 0.1)",      // slate
    end: "rgba(30, 100, 200, 0.2)",       // deep blue
};

function getColorRamp(t: number, colors: typeof T1_COLORS): string {
    if (t <= 0.5) {
        // start → mid
        const a = t * 2;
        return `linear-gradient(180deg, ${colors.start} ${(1 - a) * 100}%, ${colors.mid} 100%)`;
    }
    // mid → end
    const a = (t - 0.5) * 2;
    return `linear-gradient(180deg, ${colors.mid} ${(1 - a) * 100}%, ${colors.end} 100%)`;
}

export function TransitionOverlay() {
    const t1 = useDirectorTransitionFx();
    const t2 = useDirectorTransition2Fx();

    // Determine which transition is active
    const isT1Active = t1.vignetteIntensity > 0.01 || t1.colorRampT > 0.01;
    const isT2Active = t2.vignetteIntensity > 0.01 || t2.colorRampT > 0.01;

    if (!isT1Active && !isT2Active) return null;

    // Use whichever transition is active (they shouldn't overlap)
    const vignette = isT1Active ? t1.vignetteIntensity : t2.vignetteIntensity;
    const colorT = isT1Active ? t1.colorRampT : t2.colorRampT;
    const colors = isT1Active ? T1_COLORS : T2_COLORS;

    return (
        <>
            {/* Radial vignette — darkens edges */}
            <div
                style={{
                    ...FILL,
                    zIndex: 40,
                    opacity: vignette,
                    background: `radial-gradient(ellipse 60% 55% at 50% 50%, transparent 20%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.9) 100%)`,
                }}
            />

            {/* Color ramp wash */}
            {colorT > 0.01 && (
                <div
                    style={{
                        ...FILL,
                        zIndex: 41,
                        opacity: colorT * 0.7,
                        background: getColorRamp(colorT, colors),
                        mixBlendMode: "screen",
                    }}
                />
            )}

            {/* Animated film grain — very subtle at all times during transition */}
            <div
                className="transition-grain"
                style={{
                    ...FILL,
                    zIndex: 42,
                    opacity: vignette * 0.15,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
                    backgroundSize: "128px 128px",
                }}
            />

            {/* White flash layer for Saturn→Neptune */}
            {isT2Active && t2.irisMask > 0.01 && (
                <div
                    style={{
                        ...FILL,
                        zIndex: 43,
                        background: "white",
                        opacity: t2.irisMask * 0.7,
                    }}
                />
            )}
        </>
    );
}
