"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE DIRECTOR - Non-React orchestration module
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module contains pure functions for frame-budgeted scene orchestration.
// No React hooks or state - just engine-like logic callable from useFrame.
//
// ═══════════════════════════════════════════════════════════════════════════════

import gsap from "gsap";
import { AssetOrchestrator, FrameBudget } from "./AssetOrchestrator";
import { useDirector } from "./useDirector";

export interface CameraPosition {
    x: number;
    y: number;
    z: number;
}

/**
 * SceneDirector - Centralized frame orchestration
 * 
 * Responsibilities:
 * - Start frame budget tracking
 * - Tick GSAP synchronized with render loop
 * - Tick AssetOrchestrator scheduler within frame budget
 */
export const SceneDirector = {
    /**
     * Called once per frame from the main useFrame hook.
     * Orchestrates all frame-budgeted work.
     * 
     * @param elapsedTime - R3F clock elapsed time (for GSAP sync)
     * @param delta - Frame delta time
     * @param cameraPos - Current camera position (kept for future use)
     */
    tick(elapsedTime: number, delta: number, cameraPos: CameraPosition): void {
        // 1. Start frame budget tracking
        FrameBudget.startFrame();

        // 2. Manually tick GSAP (synchronized with render loop)
        gsap.updateRoot(elapsedTime);

        // 3. Sync scroll telemetry for predictive loading
        const { globalT, scrollVelocitySmooth } = useDirector.getState();
        AssetOrchestrator.updateScrollState(globalT, scrollVelocitySmooth);

        // 4. Tick orchestrator jobs (load/priority/evict/LOD)
        AssetOrchestrator.tick(delta, cameraPos);
    },

    /**
     * Initialize the scene director - called once on mount.
     * Disables GSAP's internal ticker to sync with R3F.
     */
    init(): void {
        // Disable GSAP's internal ticker to prevent it from fighting the render loop
        gsap.ticker.remove(gsap.updateRoot);
        gsap.ticker.fps(60); // Cap at 60fps for consistency
    },

    /**
     * Cleanup - restore GSAP ticker on unmount.
     */
    dispose(): void {
        gsap.ticker.add(gsap.updateRoot);
    }
};
