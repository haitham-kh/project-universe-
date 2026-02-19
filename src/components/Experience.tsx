"use client";

import { useThree, useFrame } from "@react-three/fiber";
import { ScrollControls, Scroll, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { SCROLL } from "../lib/sceneConfig";

import { Effects } from "./Effects";
import { Overlay } from "./Overlay";
import { HeroShip } from "./HeroShip";
import { CinematicCamera } from "./CinematicCamera";
import { CinematicBackground } from "./CinematicBackground";
// DEBUG MENU DISABLED — Re-enable by uncommenting:
// import { DevHUD } from "./DevHUD";
import { LenisBridge } from "./LenisBridge";
import { Scene2Group, TransitionFlash } from "./Scene2Group";
import { Scene3Group } from "./Scene3Group";
import { StarStreaks } from "./StarStreaks";
import { useDirector } from "../lib/useDirector";
import { useStreamingTrigger } from "../hooks/useStreamingTrigger";
import { AssetOrchestrator } from "../lib/AssetOrchestrator";
import { SceneDirector } from "../lib/SceneDirector";

// Import from extracted modules
import {
    useTierController,
    usePerformanceTier,
    PerformanceContext,
    TIERS,
    TierControllerConfig,
    PerformanceTier
} from "../hooks/usePerformanceTier";

// Re-export for backwards compatibility
export { usePerformanceTier };
export type { PerformanceTier };

// ═══════════════════════════════════════════════════════════════════════════════
// EARTH LIMB BOUNCE LIGHT - Camera-reactive blue fill from Earth side
// ═══════════════════════════════════════════════════════════════════════════════

function EarthLimbBounceLight({ tier }: { tier: 0 | 1 | 2 | 3 }) {
    const lightRef = useRef<THREE.DirectionalLight>(null!);
    const targetRef = useRef<THREE.Object3D>(null!);
    const { camera } = useThree();
    const tmp = useMemo(() => new THREE.Vector3(), []);

    // Set light target after mount (refs aren't available in JSX)
    useEffect(() => {
        if (lightRef.current && targetRef.current) {
            lightRef.current.target = targetRef.current;
        }
    }, []);

    useFrame(() => {
        if (!lightRef.current || !targetRef.current) return;
        // Camera-space offset: screen right + slightly behind
        tmp.set(10, 1.5, -18).applyQuaternion(camera.quaternion).add(camera.position);
        lightRef.current.position.copy(tmp);
        // Aim near the ship
        targetRef.current.position.set(-1.5, 0.15, -14);
        targetRef.current.updateMatrixWorld();
    });

    // Tier-based intensity - Each tier should look BETTER
    // Tier 2/3 need MORE light to compensate for post-processing and look richer
    const intensity = tier === 3 ? 0.28 : tier === 2 ? 0.22 : tier === 1 ? 0.16 : 0.0;

    return (
        <>
            <object3D ref={targetRef} />
            <directionalLight
                ref={lightRef}
                color="#64c8ff"
                intensity={intensity}
            />
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE CONTENT - Core scene composition
// ═══════════════════════════════════════════════════════════════════════════════

function SceneContent({ currentTier, updatePerformance, isLoaded }: { currentTier: 0 | 1 | 2 | 3; updatePerformance: (delta: number) => void; isLoaded: boolean }) {
    const { scene, gl, camera } = useThree();
    const sceneOpacity = useDirector(state => state.sceneOpacity);

    // Enable predictive asset streaming based on scroll position (gated behind isLoaded)
    useStreamingTrigger(isLoaded);

    const perfTier = TIERS[currentTier];

    // Smooth DPR transition to avoid stutter on tier change
    const dprCurrentRef = useRef(perfTier.dpr);

    // ═══════════════════════════════════════════════════════════════════════════
    // GSAP SYNCHRONIZATION - Using SceneDirector
    // ═══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        SceneDirector.init();
        return () => SceneDirector.dispose();
    }, []);

    // Atmosphere: subtle fog for depth (low density = space, not underwater)
    useEffect(() => {
        scene.background = null;
        scene.fog = new THREE.FogExp2('#0a0a12', 0.0012);
    }, [scene]);

    // Propagate tier changes to AssetOrchestrator for dynamic VRAM budgeting
    useEffect(() => {
        AssetOrchestrator.setTier(currentTier);
    }, [currentTier]);

    // ═══════════════════════════════════════════════════════════════════════════
    // MAIN FRAME LOOP - All updates synchronized via SceneDirector
    // ═══════════════════════════════════════════════════════════════════════════
    useFrame((state, delta) => {
        // 1-4. SceneDirector handles: FrameBudget, GSAP, AssetOrchestrator, scroll state
        SceneDirector.tick(state.clock.elapsedTime, delta, {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
        });

        // 5. Update tier controller metrics
        updatePerformance(delta);

        // 6. Smooth DPR interpolation (avoids render target resize stutter)
        const targetDpr = Math.min(perfTier.dpr, window.devicePixelRatio);
        dprCurrentRef.current = THREE.MathUtils.damp(dprCurrentRef.current, targetDpr, 3, delta);

        // Only update GL when difference is noticeable
        if (Math.abs(dprCurrentRef.current - gl.getPixelRatio()) > 0.03) {
            gl.setPixelRatio(dprCurrentRef.current);
        }
    });

    const spaceOpacity = sceneOpacity.spaceOpacity;

    return (
        <PerformanceContext.Provider value={perfTier}>
            {/* ═══════════════════════════════════════════════════════════════════
                CINEMATIC CAMERA - One controller, no camera animation elsewhere!
            ═══════════════════════════════════════════════════════════════════ */}
            <CinematicCamera tier={currentTier} />

            {/* ═══════════════════════════════════════════════════════════════════
                TRANSITION FLASH - White flash between scenes
            ═══════════════════════════════════════════════════════════════════ */}
            <TransitionFlash />

            {/* ═══════════════════════════════════════════════════════════════════
                STAR STREAKS - Instanced particles during transitions
            ═══════════════════════════════════════════════════════════════════ */}
            <StarStreaks />

            {/* ═══════════════════════════════════════════════════════════════════
                SPACE SCENE - Fades out during transition
            ═══════════════════════════════════════════════════════════════════ */}
            {spaceOpacity > 0.01 && (
                <group>
                    {/* Cinematic Lighting Rig */}
                    <ambientLight intensity={0.02 * spaceOpacity} color="#c8c8ff" />
                    <directionalLight position={[6, 8, 10]} intensity={1.5 * spaceOpacity} color="#fff6e8" />
                    <directionalLight position={[-6, 3, -8]} intensity={0.8 * spaceOpacity} color="#6080ff" />

                    {/* Cinematic Background */}
                    <CinematicBackground tier={currentTier} />

                    {/* Hero Ship */}
                    <HeroShip tier={currentTier} />

                    {/* Stars - hide when transitioning to Scene 2 */}
                    {spaceOpacity > 0.5 && (
                        <Stars
                            radius={500}
                            depth={200}
                            count={perfTier.sparkleCount * 12}
                            factor={4}
                            saturation={0.12}
                            fade
                            speed={0.02}
                        />
                    )}

                    {/* Earth Limb Bounce Light */}
                    <EarthLimbBounceLight tier={currentTier} />
                </group>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                SCENE 2 - Saturn Scene
            ═══════════════════════════════════════════════════════════════════ */}
            <Scene2Group tier={currentTier} />

            {/* ═══════════════════════════════════════════════════════════════════
                 SCENE 3 - Neptune Outpost
             ═══════════════════════════════════════════════════════════════════ */}
            <Scene3Group tier={currentTier} />

            {/* Post-Processing - Quality controlled by tier */}
            <Effects targetTier={currentTier} />
        </PerformanceContext.Provider>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPERIENCE - Main entry point (now declarative composition)
// ═══════════════════════════════════════════════════════════════════════════════

export function Experience({ isLoaded = false }: { isLoaded?: boolean } = {}) {
    // Detect mobile — synchronous initializer ensures useMemo reads correct value
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window === "undefined") return false;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || window.innerWidth < 768;
    });

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', checkMobile, { passive: true });
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Tier controller config based on device
    // Desktop: Can reach Tier 3 if GPU is powerful enough
    // Mobile: Capped at Tier 1 for battery and thermal
    const tierConfig: TierControllerConfig = useMemo(() => ({
        startTier: isMobile ? 1 : 2,
        maxTier: 3,              // Allow EMA scaler to handle downgrading instead of forcing a cap
        downshiftDuration: 1000,                // 1s with bad metrics before downshift
        upshiftDuration: 5000,                  // 5s with excellent metrics before upshift
        cooldownDuration: 4000,                 // 4s cooldown after any change
    }), [isMobile]);

    const { currentTier, updatePerformance } = useTierController(tierConfig);

    return (
        <ScrollControls pages={SCROLL.pages} damping={0}>
            {/* Lenis provides smooth scrolling, ScrollControls provides scroll.offset */}
            <LenisBridge />
            <SceneContent currentTier={currentTier} updatePerformance={updatePerformance} isLoaded={isLoaded} />
            <Scroll html style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
                <Overlay />
                {/* DEBUG MENU DISABLED — Re-enable by uncommenting: */}
                {/* <DevHUD /> */}
            </Scroll>
        </ScrollControls>
    );
}
