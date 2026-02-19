"use client";

import { useDirectorTransitionFx, useDirectorTransition2Fx } from "../lib/useDirector";

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSITION HUD — Minimal sci-fi text overlay during boundary transitions
//
// Ultra-minimal: thin lines, small-caps, monospace, scene-palette color.
// Driven by hudOpacity + hudPhase from Director transition state.
// ═══════════════════════════════════════════════════════════════════════════════

// Text content per phase for each transition
const T1_HUD = [
    // Phase 0: Lock-on
    { top: "TRAJECTORY LOCK", mid: "ΔV COMPUTED", bottom: "SATURN ENCOUNTER" },
    // Phase 1: Warp peak — minimal (streaks dominate)
    { top: "WARP TRANSIT", mid: "", bottom: "" },
    // Phase 2: Arrival
    { top: "ORBIT INSERTION", mid: "زحل / SATURN", bottom: "STABLE ORBIT" },
    // Phase 3: Loop — warp back (used by LenisBridge loop transition)
    { top: "RETURN WARP", mid: "", bottom: "" },
    // Phase 4: Loop — arrival home
    { top: "RETURNING HOME", mid: "EARTH ORBIT", bottom: "WELCOME BACK" },
];

const T2_HUD = [
    // Phase A: Ring dive setup
    { top: "RING TRANSIT", mid: "DIVING THROUGH RINGS", bottom: "" },
    // Phase B: Portal dive — minimal
    { top: "DEEP SPACE", mid: "", bottom: "" },
    // Phase C: Emergence (hudOpacity fades → this may not show)
    { top: "OUTER SYSTEM", mid: "NEPTUNE APPROACH", bottom: "" },
];

const baseStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 50,
    pointerEvents: "none",
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    fontWeight: 300,
};

function HUDLayer({
    opacity,
    phase,
    hudData,
    accentColor,
}: {
    opacity: number;
    phase: number;
    hudData: typeof T1_HUD;
    accentColor: string;
}) {
    if (opacity < 0.01) return null;

    const phaseIndex = Math.min(Math.floor(phase), hudData.length - 1);
    const data = hudData[Math.max(0, phaseIndex)];

    return (
        <div style={{ ...baseStyle, inset: 0, opacity }}>
            {/* Top line */}
            <div
                style={{
                    position: "absolute",
                    top: "8%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: "10px",
                    color: accentColor,
                    textAlign: "center",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                }}
            >
                <span style={{
                    width: "40px",
                    height: "1px",
                    background: `linear-gradient(90deg, transparent, ${accentColor})`,
                    display: "inline-block",
                }} />
                {data.top}
                <span style={{
                    width: "40px",
                    height: "1px",
                    background: `linear-gradient(90deg, ${accentColor}, transparent)`,
                    display: "inline-block",
                }} />
            </div>

            {/* Middle line */}
            {data.mid && (
                <div
                    style={{
                        position: "absolute",
                        top: "12%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "9px",
                        color: accentColor,
                        opacity: 0.6,
                        textAlign: "center",
                    }}
                >
                    {data.mid}
                </div>
            )}

            {/* Bottom line */}
            {data.bottom && (
                <div
                    style={{
                        position: "absolute",
                        bottom: "8%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "9px",
                        color: accentColor,
                        opacity: 0.5,
                        textAlign: "center",
                    }}
                >
                    {data.bottom}
                </div>
            )}

            {/* Corner tick marks */}
            <Corner position="top-left" color={accentColor} />
            <Corner position="top-right" color={accentColor} />
            <Corner position="bottom-left" color={accentColor} />
            <Corner position="bottom-right" color={accentColor} />
        </div>
    );
}

function Corner({ position, color }: { position: string; color: string }) {
    const size = 20;
    const offset = "6%";
    const borderStyle = `1px solid ${color}`;

    const posStyle: React.CSSProperties = {
        position: "absolute",
        width: `${size}px`,
        height: `${size}px`,
        opacity: 0.4,
    };

    switch (position) {
        case "top-left":
            return <div style={{ ...posStyle, top: offset, left: offset, borderTop: borderStyle, borderLeft: borderStyle }} />;
        case "top-right":
            return <div style={{ ...posStyle, top: offset, right: offset, borderTop: borderStyle, borderRight: borderStyle }} />;
        case "bottom-left":
            return <div style={{ ...posStyle, bottom: offset, left: offset, borderBottom: borderStyle, borderLeft: borderStyle }} />;
        case "bottom-right":
            return <div style={{ ...posStyle, bottom: offset, right: offset, borderBottom: borderStyle, borderRight: borderStyle }} />;
        default:
            return null;
    }
}

export function TransitionHUD() {
    const t1 = useDirectorTransitionFx();
    const t2 = useDirectorTransition2Fx();

    return (
        <>
            <HUDLayer
                opacity={t1.hudOpacity}
                phase={t1.hudPhase}
                hudData={T1_HUD}
                accentColor="rgba(34, 211, 238, 0.8)"  // Cyan for Earth→Saturn
            />
            <HUDLayer
                opacity={t2.hudOpacity}
                phase={0}  // Single phase for T2 — content switches via colorRampT
                hudData={T2_HUD}
                accentColor="rgba(100, 180, 255, 0.8)"  // Ice-blue for Saturn→Neptune
            />
        </>
    );
}
