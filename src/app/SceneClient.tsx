"use client";

import { Canvas } from "@react-three/fiber";
import { Experience } from "@/components/Experience";
import { Suspense, memo, useEffect, useState } from "react";
// DEBUG MENUS DISABLED — preserved imports:
// import { Scene2DebugMenu } from "@/components/Scene2Planets";
// import { Scene2TierSelector } from "@/components/Scene2Group";
import { Scene2Overlay } from "@/components/Scene2Overlay";
import { Scene2Vignette, Scene2LensFlare } from "@/components/Scene2Effects";
// import { Scene3DebugMenu } from "@/components/Scene3Group";
import { Scene3Overlay } from "@/components/Scene3Overlay";
import { TransitionOverlay } from "@/components/TransitionOverlay";
import { TransitionHUD } from "@/components/TransitionHUD";
import { LoreOverlay } from "@/components/LoreOverlay";
import { useGLTF, useTexture } from "@react-three/drei";
import { IdlePreloader } from "@/lib/AssetOrchestrator";
import { BASE_PATH } from "@/lib/basePath";

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE CLIENT - Client-only Canvas wrapper with cinematic effects
//
// PERFORMANCE OPTIMIZATIONS:
// - Memoized Experience to prevent re-renders
// - Idle preloading of Scene 2 assets during Scene 1
// - Progressive loading in Scene2Group
// ═══════════════════════════════════════════════════════════════════════════════

const MemoizedExperience = memo(Experience);

// Asset paths for idle preloading
const PRELOAD_ASSETS = {
    GLB: [
        `${BASE_PATH}/models/starback.glb`,
        `${BASE_PATH}/models/saturn2.glb`,
        `${BASE_PATH}/models/neptune-v3-draco.glb`,
        `${BASE_PATH}/models/neptuenlimp-draco.glb`,
    ],
    TEXTURES: [] as string[],
};

export default function SceneClient({ enableIdlePreload = false }: { enableIdlePreload?: boolean }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // ═══════════════════════════════════════════════════════════════════
    // IDLE PRELOADING - Load Scene 2 assets during browser idle time
    // Gated behind enableIdlePreload to prevent loading during shell boot
    // ═══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!enableIdlePreload) return;

        const cancel = IdlePreloader.schedule(() => {
            if (process.env.NODE_ENV !== "production") {
                console.log('[SceneClient] Starting idle preload of Scene 2 assets...');
            }

            // Preload GLBs
            PRELOAD_ASSETS.GLB.forEach((path) => {
                try {
                    useGLTF.preload(path);
                } catch (e) {
                    // Silently ignore preload failures
                }
            });

            // Preload textures
            PRELOAD_ASSETS.TEXTURES.forEach((path) => {
                try {
                    useTexture.preload(path);
                } catch (e) {
                    // Silently ignore preload failures
                }
            });

            if (process.env.NODE_ENV !== "production") {
                console.log('[SceneClient] Scene 2 preload complete');
            }
        }, 2000);

        return cancel;
    }, [enableIdlePreload]);

    if (!mounted) return null;

    return (
        <>
            <Canvas
                shadows
                dpr={[1, 2]}
                camera={{ position: [0, 0, 15], fov: 38, near: 0.1, far: 20000 }}
                gl={{ antialias: true, stencil: false, alpha: false }}
            >
                <Suspense fallback={null}>
                    <MemoizedExperience isLoaded={enableIdlePreload} />
                </Suspense>
            </Canvas>

            {/* Scene 2 Cinematic Effects */}
            <Scene2Vignette />
            <Scene2LensFlare />

            {/* Transition Overlays (vignette + color ramp + grain) */}
            <TransitionOverlay />
            <TransitionHUD />

            {/* Lore Dossier Overlay */}
            <LoreOverlay />

            {/* Scene 2 Title Overlay */}
            <Scene2Overlay />

            {/* Scene 3 Title Overlay */}
            <Scene3Overlay />

            {/* ═══════════════════════════════════════════════════════════════
                DEBUG MENUS DISABLED — Re-enable by uncommenting:
                Saved values are preserved in Scene2Group.tsx and Scene3Group.tsx
            ═══════════════════════════════════════════════════════════════ */}
            {/* <Scene2TierSelector /> */}
            {/* Scene2LightingMenu removed - lighting is locked */}
            {/* EarthSeamMenu removed */}
            {/* <Scene2DebugMenu /> */}
            {/* <Scene3DebugMenu /> */}
        </>
    );
}
