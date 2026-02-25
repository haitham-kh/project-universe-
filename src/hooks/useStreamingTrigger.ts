"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { useDirector } from "../lib/useDirector";
import { AssetOrchestrator, AssetPriority } from "../lib/AssetOrchestrator";
import { log } from "../lib/logger";
import { createGLTFLoaderExtension } from "../lib/gltfLoaderConfig";
import { getModelPath, type ModelKey } from "../lib/modelPaths";

type ChapterId = "scene1" | "scene2" | "scene3";

type TieredAsset = {
    key: string;
    modelKey: ModelKey;
    sizeDesktop: number;
    sizeMobile: number;
};

const SCENE1_ASSETS: TieredAsset[] = [
    {
        key: "scene1_hero_ship",
        modelKey: "scene1HeroShip",
        sizeDesktop: 0.62 * 1024 * 1024,
        sizeMobile: 0.38 * 1024 * 1024,
    },
];

const SCENE2_ASSETS: TieredAsset[] = [
    {
        key: "scene2_saturn",
        modelKey: "scene2Saturn",
        sizeDesktop: 0.57 * 1024 * 1024,
        sizeMobile: 0.19 * 1024 * 1024,
    },
    {
        key: "scene2_starback",
        modelKey: "scene2Starback",
        sizeDesktop: 0.11 * 1024 * 1024,
        sizeMobile: 0.11 * 1024 * 1024,
    },
];

const SCENE3_ASSETS: TieredAsset[] = [
    {
        key: "scene3_neptune",
        modelKey: "scene3Neptune",
        sizeDesktop: 0.17 * 1024 * 1024,
        sizeMobile: 0.06 * 1024 * 1024,
    },
    {
        key: "scene3_neptune_limb",
        modelKey: "scene3NeptuneLimb",
        sizeDesktop: 0.25 * 1024 * 1024,
        sizeMobile: 0.08 * 1024 * 1024,
    },
];

const SCENE1_ASSET_KEYS = SCENE1_ASSETS.map((asset) => asset.key);
const SCENE2_ASSET_KEYS = SCENE2_ASSETS.map((asset) => asset.key);
const SCENE3_ASSET_KEYS = SCENE3_ASSETS.map((asset) => asset.key);
const ALL_TRACKED_ASSET_KEYS = [
    ...new Set([...SCENE1_ASSET_KEYS, ...SCENE2_ASSET_KEYS, ...SCENE3_ASSET_KEYS]),
];

const THRESHOLDS = {
    SCENE2_IDLE_END: 0.34,
    SCENE2_NORMAL_END: 0.52,
    SCENE3_IDLE_PRELOAD: 0.72,
    SCENE1_DISPOSE: 0.9,
};

function sizeForTier(asset: TieredAsset, tier: 0 | 1 | 2 | 3): number {
    return tier <= 1 ? asset.sizeMobile : asset.sizeDesktop;
}

function pathForTier(asset: TieredAsset, tier: 0 | 1 | 2 | 3): string {
    return getModelPath(asset.modelKey, tier);
}

function queueDreiPreload(
    asset: TieredAsset,
    chapterId: ChapterId,
    priority: AssetPriority,
    tier: 0 | 1 | 2 | 3,
    extendLoader: ReturnType<typeof createGLTFLoaderExtension>,
) {
    AssetOrchestrator.queuePreload({
        key: asset.key,
        priority,
        estimatedSize: sizeForTier(asset, tier),
        chapterId,
        loader: async () => {
            useGLTF.preload(pathForTier(asset, tier), true, undefined, extendLoader as any);
        },
    });
}

export function useStreamingTrigger(isLoaded: boolean) {
    const globalT = useDirector((s) => s.globalT);
    const tier = useDirector((s) => s.tierOverride ?? s.tier);
    const { gl } = useThree();
    const extendLoader = useMemo(
        () => createGLTFLoaderExtension(gl as THREE.WebGLRenderer),
        [gl],
    );

    const prevZoneRef = useRef<"idle" | "normal" | "high" | "dispose">("idle");
    const hasRegisteredRef = useRef(false);
    const stableCountRef = useRef(0);
    const scene3QueuedRef = useRef(false);
    const STABLE_THRESHOLD = 2;

    useEffect(() => {
        if (!isLoaded || hasRegisteredRef.current) return;
        hasRegisteredRef.current = true;

        const register = (chapter: ChapterId, assets: TieredAsset[]) => {
            AssetOrchestrator.registerChapterAssets(
                chapter,
                assets.map((asset) => ({
                    key: asset.key,
                    loader: async () => {
                        useGLTF.preload(pathForTier(asset, tier), true, undefined, extendLoader as any);
                    },
                    size: sizeForTier(asset, tier),
                    type: "glb" as const,
                    dispose: () => { },
                })),
            );
        };

        register("scene1", SCENE1_ASSETS);
        register("scene2", SCENE2_ASSETS);
        register("scene3", SCENE3_ASSETS);

        for (const asset of SCENE1_ASSETS) {
            queueDreiPreload(asset, "scene1", "critical", tier, extendLoader);
        }

        log("[StreamingTrigger] Registered chapter assets");
    }, [isLoaded, tier, extendLoader]);

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

        if (!scene3QueuedRef.current && globalT >= THRESHOLDS.SCENE3_IDLE_PRELOAD) {
            scene3QueuedRef.current = true;
            for (const asset of SCENE3_ASSETS) {
                queueDreiPreload(asset, "scene3", "idle", tier, extendLoader);
            }
            log(`[StreamingTrigger] Queued Scene 3 idle preload (globalT: ${globalT.toFixed(2)})`);
        }

        if (zone === prevZoneRef.current) {
            stableCountRef.current++;
        } else {
            prevZoneRef.current = zone;
            stableCountRef.current = 1;
        }

        if (stableCountRef.current !== STABLE_THRESHOLD) return;

        log(`[StreamingTrigger] Zone confirmed: ${zone} (globalT: ${globalT.toFixed(2)})`);

        const scene2Priority: AssetPriority =
            zone === "high" || zone === "dispose"
                ? "high"
                : zone === "normal"
                    ? "normal"
                    : "idle";

        if (zone !== "idle") {
            for (const asset of SCENE2_ASSETS) {
                queueDreiPreload(asset, "scene2", scene2Priority, tier, extendLoader);
            }
        }

        for (const key of SCENE2_ASSET_KEYS) {
            AssetOrchestrator.updatePriority(key, scene2Priority);
        }

        if (zone === "dispose") {
            AssetOrchestrator.setCurrentChapter("scene2");
            AssetOrchestrator.disposeChapter("scene1");
        }

        if (zone === "idle" || zone === "normal") {
            AssetOrchestrator.setCurrentChapter("scene1");
        } else {
            AssetOrchestrator.setCurrentChapter("scene2");
        }
    }, [globalT, isLoaded, tier, extendLoader]);
}

const CRITICAL_PATH_ASSETS = ["scene1_hero_ship"];

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

        const criticalProgress =
            CRITICAL_PATH_ASSETS.length > 0
                ? CRITICAL_PATH_ASSETS.reduce(
                    (sum, key) => sum + AssetOrchestrator.getProgressForKey(key),
                    0,
                ) / CRITICAL_PATH_ASSETS.length
                : 0;

        const registeredKeys = AssetOrchestrator.getRegisteredAssetKeys();
        const trackedKeys = registeredKeys.length > 0 ? registeredKeys : ALL_TRACKED_ASSET_KEYS;
        const totalProgress =
            trackedKeys.length > 0
                ? AssetOrchestrator.getTotalProgress(trackedKeys)
                : loaderProgress;

        return {
            criticalReady: ready === CRITICAL_PATH_ASSETS.length,
            criticalProgress,
            totalProgress,
        };
    };

    return checkCritical();
}
