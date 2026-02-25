"use client";

import { EffectComposer, Bloom, Vignette, ChromaticAberration, ToneMapping, SMAA } from "@react-three/postprocessing";
import { ToneMappingMode, SMAAPreset, EdgeDetectionMode, PredicationMode } from "postprocessing";
import { Vector2 } from "three";
import { useMemo, useRef, useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { SharpenEffect } from "./SharpenEffect";
import { CinematicGrainEffect } from "./CinematicGrainEffect";
import { useDirector } from "../lib/useDirector";

// ═══════════════════════════════════════════════════════════════════════════════
// POST-PROCESSING EFFECTS - SINGLE COMPOSER (Bug #2 Fix)
//
// CRITICAL FIX: Uses ONE EffectComposer that stays mounted forever.
// Tier changes are PARAMETER changes, not component unmount/remount.
// This prevents shader recompilation and render target rebuild on tier change.
//
// Key insight: We keep ALL effects mounted but control them via:
// - intensity = 0 to "disable" without unmounting
//
// PERF: globalT, scrollVelocity, scene2Opacity are read from refs via
// subscribe() pattern — no React rerenders at frame rate.
// ═══════════════════════════════════════════════════════════════════════════════

interface EffectsProps {
    targetTier: 0 | 1 | 2 | 3;
}

// Tier configuration as data, not component structure
// PERF: Lower tiers use fewer bloom levels (mipmap passes) = 40% GPU savings
// TUNED: Higher thresholds + lower intensities to prevent "nuclear white" effect
const TIER_CONFIG = {
    0: {
        multisampling: 0,
        bloom1: { threshold: 0.88, intensity: 0, radius: 0.40, levels: 3 },
        bloom2: { threshold: 0.92, intensity: 0, radius: 0.60, levels: 2 },
        bloom3: { threshold: 0.95, intensity: 0, radius: 0.85, levels: 2 },
        noise: 0,
        vignette: { offset: 0.15, darkness: 0.25 },
        chromatic: 0,
        smaaPreset: SMAAPreset.HIGH,
    },
    1: {
        multisampling: 2,
        bloom1: { threshold: 0.88, intensity: 0.15, radius: 0.40, levels: 4 },
        bloom2: { threshold: 0.92, intensity: 0, radius: 0.60, levels: 3 },
        bloom3: { threshold: 0.95, intensity: 0, radius: 0.85, levels: 2 },
        noise: 0.008,
        vignette: { offset: 0.12, darkness: 0.35 },
        chromatic: 0,
        smaaPreset: SMAAPreset.HIGH,
    },
    2: {
        multisampling: 4,
        // TUNED: threshold 0.82→0.85, intensity 0.28→0.22
        bloom1: { threshold: 0.85, intensity: 0.22, radius: 0.45, levels: 5 },
        bloom2: { threshold: 0.92, intensity: 0.08, radius: 0.60, levels: 4 },
        bloom3: { threshold: 0.95, intensity: 0, radius: 0.85, levels: 3 },
        noise: 0.007,
        vignette: { offset: 0.10, darkness: 0.40 },
        chromatic: 0,
        smaaPreset: SMAAPreset.HIGH,
    },
    3: {
        multisampling: 8,
        // TUNED: threshold 0.95 (up from 0.92), intensity 0.08 (down from 0.12) to prevent blowouts
        bloom1: { threshold: 0.95, intensity: 0.08, radius: 0.45, levels: 5 },
        bloom2: { threshold: 0.96, intensity: 0.04, radius: 0.60, levels: 4 },
        bloom3: { threshold: 0.98, intensity: 0.03, radius: 0.85, levels: 4 },
        noise: 0.006,
        vignette: { offset: 0.08, darkness: 0.40 },
        chromatic: 0.00006,
        smaaPreset: SMAAPreset.HIGH,
    },
} as const;

export function Effects({ targetTier = 2 }: EffectsProps) {
    const { gl } = useThree();
    const casEnabled = useDirector(state => state.casEnabled);
    const smaaEnabled = useDirector(state => state.smaaEnabled);

    // ═══════════════════════════════════════════════════════════════════════════
    // REF-BASED SUBSCRIPTIONS — avoid 60 React rerenders/sec
    // These values change every frame but are only used for effect parameters.
    // Reading from refs means React never re-renders this component for them.
    // ═══════════════════════════════════════════════════════════════════════════
    const globalTRef = useRef(0);
    const scrollVelocityRef = useRef(0);
    const scene2OpacityRef = useRef(0);
    const scene3OpacityRef = useRef(0);
    const scene1FocusRef = useRef(true);
    const [scene1MsaaActive, setScene1MsaaActive] = useState(true);

    useEffect(() => {
        const unsub = useDirector.subscribe((state) => {
            globalTRef.current = state.globalT;
            scrollVelocityRef.current = state.scrollVelocitySmooth;
            const scene2Opacity = state.sceneOpacity?.scene2Opacity ?? 0;
            const scene3Opacity = state.sceneOpacity?.scene3Opacity ?? 0;
            scene2OpacityRef.current = scene2Opacity;
            scene3OpacityRef.current = scene3Opacity;
            const nextScene1Focus = scene2Opacity <= 0.5 && scene3Opacity <= 0.5;
            if (nextScene1Focus !== scene1FocusRef.current) {
                scene1FocusRef.current = nextScene1Focus;
                setScene1MsaaActive(nextScene1Focus);
            }
        });
        // Initialize with current state
        const state = useDirector.getState();
        globalTRef.current = state.globalT;
        scrollVelocityRef.current = state.scrollVelocitySmooth;
        const scene2Opacity = state.sceneOpacity?.scene2Opacity ?? 0;
        const scene3Opacity = state.sceneOpacity?.scene3Opacity ?? 0;
        scene2OpacityRef.current = scene2Opacity;
        scene3OpacityRef.current = scene3Opacity;
        const initialScene1Focus = scene2Opacity <= 0.5 && scene3Opacity <= 0.5;
        scene1FocusRef.current = initialScene1Focus;
        setScene1MsaaActive(initialScene1Focus);
        return unsub;
    }, []);

    // DPR gap calculation
    const deviceDpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
    const renderDpr = gl.getPixelRatio();
    const gap = Math.max(1, deviceDpr / Math.max(0.01, renderDpr));
    const gapBoost = Math.min(1.5, gap);

    const tierSharpness = { 0: 0.42, 1: 0.38, 2: 0.32, 3: 0.24 };
    const tierClampMax = { 0: 0.10, 1: 0.085, 2: 0.075, 3: 0.065 };

    const baseSharpness = tierSharpness[targetTier] * gapBoost;

    // Get current tier config
    const config = TIER_CONFIG[targetTier];

    // ═══════════════════════════════════════════════════════════════════════════
    // SCENE 2 CINEMATIC - Subtle effects for clean space look
    // Read from refs (updated by subscription, not React state)
    // ═══════════════════════════════════════════════════════════════════════════
    const isScene2 = scene2OpacityRef.current > 0.5;
    const isScene3 = scene3OpacityRef.current > 0.5;
    const scene1Focus = scene1MsaaActive;
    const globalT = globalTRef.current;
    const scrollVelocity = scrollVelocityRef.current;
    const upscaleRatio = Math.max(1, deviceDpr / Math.max(0.01, renderDpr));
    const upscaleNeed = Math.max(0, upscaleRatio - 1);
    const baseUpscaleFactor = Math.min(1, upscaleNeed / 0.6);
    // Keep a small baseline sharpen in Scene 1 for crisp ship materials at high DPR.
    const upscaleFactor = scene1Focus ? Math.max(0.22, baseUpscaleFactor) : baseUpscaleFactor;
    const sceneSharpenMultiplier = isScene2 ? 0.58 : isScene3 ? 0.72 : 1;
    const motionPenalty = Math.min(0.75, Math.abs(scrollVelocity) * 0.35);
    const motionDamp = 1 - motionPenalty;
    const sharpness = baseSharpness * upscaleFactor * sceneSharpenMultiplier * motionDamp;
    const clampMax = tierClampMax[targetTier] * (0.55 + upscaleFactor * 0.8);
    const edgeThreshold = isScene2 || isScene3 ? 0.02 : 0.018;

    // Very subtle grain - space should look clean
    const noiseBoost = isScene2 ? 0.005 : isScene3 ? 0.004 : 0;
    const finalNoise = config.noise + noiseBoost;

    // SUBTLE VIGNETTE - Gentle focus effect
    const saturApproach = Math.max(0, (globalT - 0.6) / 0.4);
    const vignetteBoost = isScene2
        ? { offset: -0.03 - saturApproach * 0.02, darkness: 0.08 + saturApproach * 0.05 }
        : isScene3
            ? { offset: -0.05, darkness: 0.15 }  // Deeper vignette for Neptune cinematic focus
            : { offset: 0, darkness: 0 };
    const finalVignetteOffset = config.vignette.offset + vignetteBoost.offset;
    const finalVignetteDarkness = config.vignette.darkness + vignetteBoost.darkness;

    // CHROMATIC ABERRATION - Subtle lens effect

    // Base CA - very subtle for clean space look
    const scene2Chromatic = isScene2 ? 0.00004 : 0;
    const scene3Chromatic = isScene3 ? 0.00006 : 0;  // Subtle icy lens aberration
    // Velocity boost only during fast scroll (much reduced)
    const velocityCA = Math.min(Math.abs(scrollVelocity) * 0.0001, 0.00015);
    const finalChromatic = Math.max(config.chromatic, scene2Chromatic, scene3Chromatic) + velocityCA;

    // Chromatic aberration offset — stable instance, mutated to avoid GC churn
    const chromaticOffset = useMemo(() => new Vector2(0, 0), []);
    chromaticOffset.set(finalChromatic, finalChromatic);

    // ═══════════════════════════════════════════════════════════════════════════
    // SCENE 3 BLOOM BOOST - Ethereal Neptune glow
    // Lower threshold + higher intensity for ice-blue atmosphere
    // ═══════════════════════════════════════════════════════════════════════════
    const scene3BloomBoost = isScene3 ? { threshold: -0.06, intensity: 0.08 } : { threshold: 0, intensity: 0 };
    const scene1MsaaSamples = targetTier === 3 ? 4 : targetTier === 2 ? 2 : 0;
    // WebGL can't do true per-object MSAA in this pipeline. Closest practical option:
    // enable MSAA only while Scene 1 (hero ship chapter) is active.
    const composerMultisampling = smaaEnabled
        ? (targetTier >= 2 ? (scene1Focus ? scene1MsaaSamples : 0) : config.multisampling)
        : config.multisampling;
    const smaaEdgeThreshold = targetTier === 3 ? 0.05 : targetTier === 2 ? 0.055 : 0.06;

    // ═══════════════════════════════════════════════════════════════════════════
    // SINGLE COMPOSER - Never unmounts, parameters change smoothly
    // Effects with intensity=0 are effectively disabled but don't cause
    // shader recompilation when tier changes.
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <EffectComposer multisampling={composerMultisampling}>
            {/* ToneMapping - Always on */}
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />

            {/* Primary Bloom - tier-adaptive levels for GPU savings, boosted for Scene 3 */}
            <Bloom
                luminanceThreshold={config.bloom1.threshold + scene3BloomBoost.threshold}
                intensity={config.bloom1.intensity + scene3BloomBoost.intensity}
                mipmapBlur
                radius={config.bloom1.radius}
                levels={config.bloom1.levels}
            />

            {/* Secondary Bloom - only active on Tier 2+ */}
            <Bloom
                luminanceThreshold={config.bloom2.threshold}
                intensity={config.bloom2.intensity}
                mipmapBlur
                radius={config.bloom2.radius}
                levels={config.bloom2.levels}
            />

            {/* Tertiary Bloom - only active on Tier 3 */}
            <Bloom
                luminanceThreshold={config.bloom3.threshold}
                intensity={config.bloom3.intensity}
                mipmapBlur
                radius={config.bloom3.radius}
                levels={config.bloom3.levels}
            />

            {/* SMAA - Always mounted and tuned for tiny high-contrast edges */}
            {smaaEnabled ? (
                <SMAA
                    preset={config.smaaPreset ?? SMAAPreset.ULTRA}
                    edgeDetectionMode={EdgeDetectionMode.COLOR}
                    predicationMode={PredicationMode.DEPTH}
                    edgeDetectionMaterial-edgeDetectionThreshold={smaaEdgeThreshold}
                    edgeDetectionMaterial-localContrastAdaptationFactor={1.8}
                    edgeDetectionMaterial-predicationThreshold={0.008}
                    edgeDetectionMaterial-predicationScale={2.2}
                    edgeDetectionMaterial-predicationStrength={0.4}
                />
            ) : <></>}

            {/* CAS Sharpen - Always mounted, just adjust params */}
            <SharpenEffect
                sharpness={casEnabled ? sharpness : 0}
                clampMax={casEnabled ? clampMax : 0}
                edgeThreshold={edgeThreshold}
                motionDamp={motionDamp}
            />

            {/* CINEMATIC GRAIN - Very subtle for clean space look */}
            <CinematicGrainEffect
                intensity={finalNoise * 0.3} // Very subtle grain
                shadowWeight={1.0} // Minimal shadow concentration
            />

            {/* Chromatic Aberration - boosted in Scene 2 for lens depth */}
            <ChromaticAberration
                offset={chromaticOffset}
                radialModulation={true}
                modulationOffset={0.3}
            />

            {/* Vignette - boosted in Scene 2 for cinematic focus */}
            <Vignette
                eskil={false}
                offset={finalVignetteOffset}
                darkness={finalVignetteDarkness}
            />
        </EffectComposer>
    );
}
