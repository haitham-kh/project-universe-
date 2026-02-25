"use client";

import { Canvas } from "@react-three/fiber";
import { Experience } from "@/components/Experience";
import { Suspense, memo } from "react";
// DEBUG MENUS DISABLED - preserved imports:
// import { Scene2DebugMenu } from "@/components/Scene2Planets";
// import { Scene2TierSelector } from "@/components/Scene2Group";
import { Scene2Overlay } from "@/components/Scene2Overlay";
import { Scene2Vignette, Scene2LensFlare } from "@/components/Scene2Effects";
import { Scene3LensFlare, Scene3Vignette } from "@/components/Scene3Effects";
// import { Scene3DebugMenu } from "@/components/Scene3Group";
import { Scene3Overlay } from "@/components/Scene3Overlay";
import { TransitionOverlay } from "@/components/TransitionOverlay";
import { TransitionHUD } from "@/components/TransitionHUD";
import { LoreOverlay } from "@/components/LoreOverlay";
import { DevHUD } from "@/components/DevHUD";

// -----------------------------------------------------------------------------------------------
// SCENE CLIENT - Client-only Canvas wrapper with cinematic effects
//
// NOTE:
// Scene 3 idle preloading now runs inside Canvas via useStreamingTrigger,
// so KTX2-enabled loader config can be applied consistently.
// -----------------------------------------------------------------------------------------------

const MemoizedExperience = memo(Experience);

export default function SceneClient({ enableIdlePreload = false }: { enableIdlePreload?: boolean }) {
    return (
        <>
            <Canvas
                shadows
                dpr={[1, 2]}
                camera={{ position: [0, 0, 15], fov: 38, near: 0.1, far: 12000 }}
                gl={{ antialias: false, stencil: false, alpha: false, powerPreference: "high-performance" }}
            >
                <Suspense fallback={null}>
                    <MemoizedExperience isLoaded={enableIdlePreload} />
                </Suspense>
            </Canvas>

            {/* Scene 2 Cinematic Effects */}
            <Scene2Vignette />
            <Scene2LensFlare />

            {/* Scene 3 Cinematic Effects */}
            <Scene3Vignette />
            <Scene3LensFlare />

            {/* Transition Overlays (vignette + color ramp + grain) */}
            <TransitionOverlay />
            <TransitionHUD />

            {/* Lore Dossier Overlay */}
            <LoreOverlay />

            {/* Scene 2 Title Overlay */}
            <Scene2Overlay />

            {/* Scene 3 Title Overlay */}
            <Scene3Overlay />

            {/*
                DEBUG MENUS DISABLED - Re-enable by uncommenting:
                Saved values are preserved in Scene2Group.tsx and Scene3Group.tsx
            */}
            {/* <Scene2TierSelector /> */}
            {/* Scene2LightingMenu removed - lighting is locked */}
            {/* EarthSeamMenu removed */}
            {/* <Scene2DebugMenu /> */}
            {/* <Scene3DebugMenu /> */}

            {/* Global DevHUD Menu */}
            <DevHUD />
        </>
    );
}
