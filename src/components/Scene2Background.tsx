"use client";

import { create } from "zustand";

// ═══════════════════════════════════════════════════════════════════════════════
// EARTH TERMINATOR STORE - Controls for seam masking
// Used by Scene2Overlay's mini-canvas Earth
// ═══════════════════════════════════════════════════════════════════════════════

interface TerminatorState {
    enabled: boolean;
    seamAngle: number;
    darkWidth: number;
    nightDarkness: number;
    edgeSoftness: number;
}

interface EarthTerminatorStore {
    earth: TerminatorState;
    setEarth: (v: Partial<TerminatorState>) => void;
}

export const useEarthTerminator = create<EarthTerminatorStore>((set) => ({
    earth: {
        enabled: true,
        seamAngle: 250,      // User tuned
        darkWidth: 0.40,     // User tuned
        nightDarkness: 0.03, // User tuned
        edgeSoftness: 0.25,  // User tuned
    },
    setEarth: (v) => set((s) => ({ earth: { ...s.earth, ...v } })),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE 2 BACKGROUND - Empty now (Earth moved to overlay mini-canvas)
// ═══════════════════════════════════════════════════════════════════════════════

interface Scene2BackgroundProps {
    tier?: 0 | 1 | 2 | 3;
    opacity?: number;
}

export function Scene2Background({ tier = 2, opacity = 1 }: Scene2BackgroundProps) {
    // Earth is now rendered in Scene2Overlay's mini-canvas
    // This component is kept for the store export and potential future additions
    return null;
}
