"use client";

import { useEffect, useRef } from "react";
import { useDirector } from "../lib/useDirector";
import { AssetOrchestrator, AssetPriority } from "../lib/AssetOrchestrator";
import { useGLTF } from "@react-three/drei";
import { log } from "../lib/logger";

// ═══════════════════════════════════════════════════════════════════════════════
// USE STREAMING TRIGGER - Links scroll position to preload priorities
//
// Monitors globalT and adjusts asset loading priorities dynamically:
// - 0.0-0.2: Scene 2 = IDLE (don't interfere with Scene 1)
// - 0.2-0.4: Scene 2 = NORMAL (start warming up)
// - 0.4+:    Scene 2 = HIGH (user approaching transition)
// - 0.8+:    Dispose Scene 1 (free VRAM for Scene 2)
//
// FIX: HDR removed (was being loaded via GLTFLoader which can't parse it).
// FIX: Now uses useGLTF.preload() to share Drei's cache with rendering.
// FIX: Gated behind isLoaded to prevent streaming before user enters.
// ═══════════════════════════════════════════════════════════════════════════════

// Asset definitions for each chapter (GLB only — textures/HDR need separate loaders)
const SCENE1_ASSETS = [
    { path: "/models/ship.glb", size: 6.6 * 1024 * 1024 },
];

const SCENE2_ASSETS = [
    { path: "/models/saturn2.glb", size: 18.3 * 1024 * 1024 },
    { path: "/models/starback.glb", size: 7 * 1024 * 1024 },
];

// Thresholds for priority changes
const THRESHOLDS = {
    SCENE2_IDLE_END: 0.2,
    SCENE2_NORMAL_END: 0.4,
    SCENE1_DISPOSE: 0.8,
};

export function useStreamingTrigger(isLoaded: boolean) {
    const globalT = useDirector((s) => s.globalT);

    // Track previous threshold zone to avoid redundant updates
    const prevZoneRef = useRef<"idle" | "normal" | "high" | "dispose">("idle");
    const hasRegisteredRef = useRef(false);
    // Debounce: only preload when zone is stable for ≥2 consecutive runs
    const stableCountRef = useRef(0);
    const STABLE_THRESHOLD = 2;

    // Register chapters on mount — but only after the user has entered
    useEffect(() => {
        if (!isLoaded || hasRegisteredRef.current) return;
        hasRegisteredRef.current = true;

        // Register Scene 1 assets (stats-only, actual loading via Drei)
        AssetOrchestrator.registerChapterAssets(
            "scene1",
            SCENE1_ASSETS.map((a) => ({
                key: a.path.replace(/^\//, "").replace(/\//g, "_"),
                loader: async () => {
                    useGLTF.preload(a.path);
                },
                size: a.size,
                type: "glb" as const,
                dispose: () => { },
            }))
        );

        // Register Scene 2 assets (stats-only, actual loading via Drei)
        AssetOrchestrator.registerChapterAssets(
            "scene2",
            SCENE2_ASSETS.map((a) => ({
                key: a.path.replace(/^\//, "").replace(/\//g, "_"),
                loader: async () => {
                    useGLTF.preload(a.path);
                },
                size: a.size,
                type: "glb" as const,
                dispose: () => { },
            }))
        );

        log("[StreamingTrigger] Registered chapter assets");
    }, [isLoaded]);

    // Monitor scroll position and adjust priorities — only when loaded
    useEffect(() => {
        if (!isLoaded) return;

        let zone: "idle" | "normal" | "high" | "dispose";

        if (globalT >= THRESHOLDS.SCENE1_DISPOSE) {
            zone = "dispose";
        } else if (globalT >= THRESHOLDS.SCENE2_NORMAL_END) {
            zone = "high";
        } else if (globalT >= THRESHOLDS.SCENE2_IDLE_END) {
            zone = "normal";
        } else {
            zone = "idle";
        }

        // Debounce: zone must be stable for ≥STABLE_THRESHOLD runs before acting
        if (zone === prevZoneRef.current) {
            stableCountRef.current++;
        } else {
            prevZoneRef.current = zone;
            stableCountRef.current = 1; // First time in this zone
        }

        // Wait until zone is confirmed stable
        if (stableCountRef.current !== STABLE_THRESHOLD) return;

        log(`[StreamingTrigger] Zone confirmed: ${zone} (globalT: ${globalT.toFixed(2)})`);

        // Update priorities based on zone
        const scene2Priority: AssetPriority =
            zone === "high" || zone === "dispose" ? "high" :
                zone === "normal" ? "normal" : "idle";

        // Update Scene 2 asset priorities
        for (const asset of SCENE2_ASSETS) {
            const key = asset.path.replace(/^\//, "").replace(/\//g, "_");
            AssetOrchestrator.updatePriority(key, scene2Priority);
        }

        // Queue Scene 2 preloads if entering normal or high zone (via Drei cache)
        if (zone === "normal" || zone === "high") {
            for (const asset of SCENE2_ASSETS) {
                useGLTF.preload(asset.path);
            }
        }

        // Dispose Scene 1 when deep in Scene 2
        if (zone === "dispose") {
            AssetOrchestrator.setCurrentChapter("scene2");
            AssetOrchestrator.disposeChapter("scene1");
        }

        // Update current chapter tracker
        if (zone === "idle" || zone === "normal") {
            AssetOrchestrator.setCurrentChapter("scene1");
        } else {
            AssetOrchestrator.setCurrentChapter("scene2");
        }

    }, [globalT, isLoaded]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// USE CRITICAL PATH - Tracks critical path completion for shell-first boot
// ═══════════════════════════════════════════════════════════════════════════════

const CRITICAL_PATH_ASSETS = [
    "models_ship.glb",
];

export function useCriticalPath(): {
    criticalReady: boolean;
    criticalProgress: number;
    totalProgress: number;
} {
    const checkCritical = () => {
        let ready = 0;
        for (const key of CRITICAL_PATH_ASSETS) {
            if (AssetOrchestrator.has(key)) {
                ready++;
            }
        }
        return {
            criticalReady: ready === CRITICAL_PATH_ASSETS.length,
            criticalProgress: (ready / CRITICAL_PATH_ASSETS.length) * 100,
            totalProgress: 0, // TODO: Calculate from all registered assets
        };
    };

    // This is a simplified version — in a full implementation,
    // we'd subscribe to AssetOrchestrator updates
    return checkCritical();
}
