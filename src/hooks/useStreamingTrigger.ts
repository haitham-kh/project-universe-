"use client";

import { useEffect, useRef } from "react";
import { useDirector } from "../lib/useDirector";
import { AssetOrchestrator, AssetPriority } from "../lib/AssetOrchestrator";
import { useGLTF, useProgress } from "@react-three/drei";
import { log } from "../lib/logger";
import { BASE_PATH } from "../lib/basePath";

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

const toAssetKey = (path: string) => path.replace(/^\//, "").replace(/\//g, "_");
const SCENE1_ASSET_KEYS = SCENE1_ASSETS.map((asset) => toAssetKey(asset.path));
const SCENE2_ASSET_KEYS = SCENE2_ASSETS.map((asset) => toAssetKey(asset.path));
const ALL_TRACKED_ASSET_KEYS = [...new Set([...SCENE1_ASSET_KEYS, ...SCENE2_ASSET_KEYS])];

const toAssetUrl = (path: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${BASE_PATH}${normalizedPath}`;
};

// Thresholds for priority changes
const THRESHOLDS = {
    SCENE2_IDLE_END: 0.2,
    SCENE2_NORMAL_END: 0.4,
    SCENE1_DISPOSE: 0.8,
};

function queueDreiPreload(
    asset: { path: string; size: number },
    chapterId: "scene1" | "scene2",
    priority: AssetPriority
) {
    AssetOrchestrator.queuePreload({
        key: toAssetKey(asset.path),
        priority,
        estimatedSize: asset.size,
        chapterId,
        loader: async () => {
            useGLTF.preload(toAssetUrl(asset.path));
        },
    });
}

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
                key: toAssetKey(a.path),
                loader: async () => {
                    useGLTF.preload(toAssetUrl(a.path));
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
                key: toAssetKey(a.path),
                loader: async () => {
                    useGLTF.preload(toAssetUrl(a.path));
                },
                size: a.size,
                type: "glb" as const,
                dispose: () => { },
            }))
        );

        // Start critical shell assets through the orchestrator queue.
        for (const asset of SCENE1_ASSETS) {
            queueDreiPreload(asset, "scene1", "critical");
        }

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

        // Queue Scene 2 loads when user starts approaching transition.
        if (zone !== "idle") {
            for (const asset of SCENE2_ASSETS) {
                queueDreiPreload(asset, "scene2", scene2Priority);
            }
        }

        // Update Scene 2 asset priorities
        for (const key of SCENE2_ASSET_KEYS) {
            AssetOrchestrator.updatePriority(key, scene2Priority);
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
    const { progress: loaderProgress } = useProgress();

    const checkCritical = () => {
        const ready = CRITICAL_PATH_ASSETS.filter((key) => {
            const status = AssetOrchestrator.getStatus(key);
            return status === "ready" || status === "pooled";
        }).length;

        const criticalProgress = CRITICAL_PATH_ASSETS.length > 0
            ? CRITICAL_PATH_ASSETS.reduce((sum, key) => sum + AssetOrchestrator.getProgressForKey(key), 0) / CRITICAL_PATH_ASSETS.length
            : 0;

        const registeredKeys = AssetOrchestrator.getRegisteredAssetKeys();
        const trackedKeys = registeredKeys.length > 0 ? registeredKeys : ALL_TRACKED_ASSET_KEYS;
        const totalProgress = trackedKeys.length > 0
            ? AssetOrchestrator.getTotalProgress(trackedKeys)
            : loaderProgress;

        return {
            criticalReady: ready === CRITICAL_PATH_ASSETS.length,
            criticalProgress,
            totalProgress,
        };
    };

    // This is a simplified version — in a full implementation,
    // we'd subscribe to AssetOrchestrator updates
    return checkCritical();
}
