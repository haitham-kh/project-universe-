"use client";

import { create } from 'zustand';
import * as THREE from 'three';
import { SHIP, EFFECTS, CHAPTERS, ChapterDef, SCROLL } from './sceneConfig';
import { damp } from './motionMath';
import { scrubTimeline, getTimelineState, timelineState } from './gsapTimeline';
import { scrollFlags } from './scrollFlags';

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE-SCOPE STABLE OBJECTS - For types containing Vector3/Vector2 only
// These avoid per-frame .clone() allocations (~360 allocs/sec saved).
//
// IMPORTANT: sceneOpacity, fx, ui use NEW objects each frame intentionally.
// Zustand selectors use Object.is() equality — stable references would prevent
// React rerenders in 20+ components that use useDirectorSceneOpacity() etc.
// ═══════════════════════════════════════════════════════════════════════════════
const _stableCameraPose: CameraPose = {
    position: new THREE.Vector3(timelineState.camX, timelineState.camY, timelineState.camZ),
    lookAt: new THREE.Vector3(timelineState.lookX, timelineState.lookY, timelineState.lookZ),
    fov: timelineState.fov,
    roll: timelineState.roll,
};
const _stableShipPose: ShipPose = {
    position: SHIP.position.base.clone(),
    scale: SHIP.baseScale,
    visible: true,
};
const _stableMouseSmooth = new THREE.Vector2(0, 0);

// ═══════════════════════════════════════════════════════════════════════════════
// DIRECTOR STATE STORE - GSAP-Powered
// Central source of truth for all runtime animation state
// 
// GSAP timeline is the "brain" - Director is the "interface" to the rest of the app
// Timeline is SCRUBBED based on scroll.offset (deterministic)
// ═══════════════════════════════════════════════════════════════════════════════

export type ChapterId = 'hero' | 'approach' | 'warp' | 'transition' | 'scene2' | 'trans2' | 'scene3';

export interface CameraPose {
    position: THREE.Vector3;
    lookAt: THREE.Vector3;
    fov: number;
    roll: number;
}

export interface ShipPose {
    position: THREE.Vector3;
    scale: number;
    visible: boolean;
}

export interface FxState {
    bloomIntensity: number;
    dofFocus: number;
    atmoGlow: number;
    warpCue: number;
}

export interface SceneOpacity {
    spaceOpacity: number;    // 1 = space visible, 0 = hidden
    scene2Opacity: number;   // 1 = scene 2 visible, 0 = hidden
    scene3Opacity: number;   // 1 = scene 3 visible, 0 = hidden
    transitionFlash: number; // 0-1 for white flash
}

export interface TransitionFx {
    streakIntensity: number;
    vignetteIntensity: number;
    colorRampT: number;
    hudOpacity: number;
    hudPhase: number;
}

export interface Transition2Fx {
    streakIntensity: number;
    vignetteIntensity: number;
    colorRampT: number;
    hudOpacity: number;
    irisMask: number;
}

export interface UiState {
    heroOpacity: number;
    contactOpacity: number;
    progress: number;
}

export interface DirectorState {
    // Timeline (set by updateTimeline)
    globalT: number;
    chapterId: ChapterId;
    chapterT: number;
    scrollVelocity: number;
    scrollVelocitySmooth: number;

    // Mouse input
    mouseX: number;
    mouseY: number;
    mouseSmooth: THREE.Vector2;

    // Poses (computed from GSAP timeline)
    cameraPose: CameraPose;
    shipPose: ShipPose;
    fx: FxState;
    sceneOpacity: SceneOpacity;
    transitionFx: TransitionFx;
    transition2Fx: Transition2Fx;
    ui: UiState;

    // Performance tier
    tier: 0 | 1 | 2 | 3;
    tierOverride: null | 0 | 1 | 2 | 3;

    // FSR (sharpen) toggle
    fsrEnabled: boolean;
    smaaEnabled: boolean;

    // Streaming state (for predictive asset loading)
    streamingState: {
        chapters: Record<ChapterId, 'pending' | 'streaming' | 'buffered' | 'evicted'>;
        activePreloads: string[];
        vramUsage: { used: number; budget: number };
    };

    // Actions
    updateTimeline: (globalT: number, delta: number) => void;
    updateMouse: (x: number, y: number, delta: number) => void;
    setTier: (tier: 0 | 1 | 2 | 3) => void;
    setTierOverride: (tier: null | 0 | 1 | 2 | 3) => void;
    setFsrEnabled: (enabled: boolean) => void;
    setSmaaEnabled: (enabled: boolean) => void;

}

// Helper: find current chapter based on progress
const getCurrentChapter = (t: number): ChapterDef => {
    for (const chapter of CHAPTERS) {
        if (t >= chapter.range[0] && t <= chapter.range[1]) {
            return chapter;
        }
    }
    return CHAPTERS[CHAPTERS.length - 1];
};

// Helper: get progress within a chapter (0-1)
const getChapterProgress = (t: number, start: number, end: number): number => {
    if (end <= start) return 0;
    return Math.max(0, Math.min(1, (t - start) / (end - start)));
};

// ─────────────────────────────────────────────────────────────────────────────
// Store Creation
// ─────────────────────────────────────────────────────────────────────────────
export const useDirector = create<DirectorState>((set, get) => ({
    // Initial timeline state
    globalT: 0,
    chapterId: 'hero',
    chapterT: 0,
    scrollVelocity: 0,
    scrollVelocitySmooth: 0,

    // Initial mouse
    mouseX: 0,
    mouseY: 0,
    mouseSmooth: _stableMouseSmooth,

    // Stable refs for Vector3-containing objects (avoid .clone() GC)
    cameraPose: _stableCameraPose,
    shipPose: _stableShipPose,
    // New objects each frame for these (just numbers — cheap, needed for React selectors)
    fx: {
        bloomIntensity: timelineState.bloomIntensity,
        dofFocus: EFFECTS.dof.focusDistance,
        atmoGlow: timelineState.atmoGlow,
        warpCue: timelineState.warpCue,
    },
    sceneOpacity: {
        spaceOpacity: timelineState.spaceOpacity,
        scene2Opacity: timelineState.scene2Opacity,
        scene3Opacity: timelineState.scene3Opacity,
        transitionFlash: timelineState.transitionFlash,
    },
    transitionFx: {
        streakIntensity: 0,
        vignetteIntensity: 0,
        colorRampT: 0,
        hudOpacity: 0,
        hudPhase: 0,
    },
    transition2Fx: {
        streakIntensity: 0,
        vignetteIntensity: 0,
        colorRampT: 0,
        hudOpacity: 0,
        irisMask: 0,
    },
    ui: {
        heroOpacity: timelineState.heroOpacity,
        contactOpacity: timelineState.contactOpacity,
        progress: 0,
    },

    tier: 2,
    tierOverride: null,
    fsrEnabled: true,
    smaaEnabled: true,

    // Initial streaming state
    streamingState: {
        chapters: {
            hero: 'pending',
            approach: 'pending',
            warp: 'pending',
            transition: 'pending',
            scene2: 'pending',
            trans2: 'pending',
            scene3: 'pending',
        },
        activePreloads: [],
        vramUsage: { used: 0, budget: 200 * 1024 * 1024 },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Update Timeline - GSAP Powered (called each frame from CinematicCamera)
    // ─────────────────────────────────────────────────────────────────────────
    updateTimeline: (globalT: number, delta: number) => {
        const state = get();
        const dt = Math.min(delta, 0.033);

        // Calculate velocity with config-driven cap + smoothing
        const rawVelocity = (globalT - state.globalT) / Math.max(0.001, dt);
        const velocity = Math.max(-SCROLL.velocityClamp, Math.min(SCROLL.velocityClamp, rawVelocity));
        const velocitySmooth = damp(state.scrollVelocitySmooth, velocity, SCROLL.velocitySmoothing, dt);

        // ═══════════════════════════════════════════════════════════════════
        // SCRUB GSAP TIMELINE
        // Skip during loop transition — LenisBridge controls timelineState
        // directly during the flash-reset sequence. If we scrub here,
        // it overwrites the loop values and kills the transition.
        // ═══════════════════════════════════════════════════════════════════
        if (!scrollFlags.isLoopTransitioning) {
            scrubTimeline(globalT);
        }
        const tlState = getTimelineState();

        // Get chapter info for ID
        const chapter = getCurrentChapter(globalT);
        const chapterT = getChapterProgress(globalT, chapter.range[0], chapter.range[1]);

        // Add inertia roll based on scroll velocity
        const inertiaRoll = velocitySmooth * -0.02;
        const totalRoll = tlState.roll + inertiaRoll;

        // Mutate stable Vector3/Vector2 objects in-place — avoids .clone() GC
        _stableCameraPose.position.set(tlState.camX, tlState.camY, tlState.camZ);
        _stableCameraPose.lookAt.set(tlState.lookX, tlState.lookY, tlState.lookZ);
        _stableCameraPose.fov = tlState.fov;
        _stableCameraPose.roll = totalRoll;

        _stableShipPose.position.copy(SHIP.position.base).setZ(SHIP.position.base.z + tlState.shipZ);
        _stableShipPose.scale = SHIP.baseScale * tlState.shipScale;
        _stableShipPose.visible = tlState.shipVisible > 0.5;

        set({
            globalT,
            chapterId: chapter.id,
            chapterT,
            scrollVelocity: velocity,
            scrollVelocitySmooth: velocitySmooth,
            cameraPose: _stableCameraPose,
            shipPose: _stableShipPose,
            // New objects for these — Zustand selectors need !== to trigger rerenders
            fx: {
                bloomIntensity: tlState.bloomIntensity,
                dofFocus: EFFECTS.dof.focusDistance,
                atmoGlow: tlState.atmoGlow,
                warpCue: tlState.warpCue,
            },
            sceneOpacity: {
                spaceOpacity: tlState.spaceOpacity,
                scene2Opacity: tlState.scene2Opacity,
                scene3Opacity: tlState.scene3Opacity,
                transitionFlash: tlState.transitionFlash,
            },
            transitionFx: {
                streakIntensity: tlState.t1StreakIntensity,
                vignetteIntensity: tlState.t1VignetteIntensity,
                colorRampT: tlState.t1ColorRampT,
                hudOpacity: tlState.t1HudOpacity,
                hudPhase: tlState.t1HudPhase,
            },
            transition2Fx: {
                streakIntensity: tlState.t2StreakIntensity,
                vignetteIntensity: tlState.t2VignetteIntensity,
                colorRampT: tlState.t2ColorRampT,
                hudOpacity: tlState.t2HudOpacity,
                irisMask: tlState.t2IrisMask,
            },
            ui: {
                heroOpacity: tlState.heroOpacity,
                contactOpacity: tlState.contactOpacity,
                progress: globalT,
            },
        });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Update Mouse (called each frame)
    // ─────────────────────────────────────────────────────────────────────────
    updateMouse: (x: number, y: number, delta: number) => {
        const dt = Math.min(delta, 0.033);

        // Mutate stable mouseSmooth in-place
        _stableMouseSmooth.x = damp(_stableMouseSmooth.x, x, 8, dt);
        _stableMouseSmooth.y = damp(_stableMouseSmooth.y, y, 8, dt);

        set({
            mouseX: x,
            mouseY: y,
            mouseSmooth: _stableMouseSmooth,
        });
    },

    setTier: (tier: 0 | 1 | 2 | 3) => set({ tier }),
    setTierOverride: (tierOverride: null | 0 | 1 | 2 | 3) => set({ tierOverride }),
    setFsrEnabled: (fsrEnabled: boolean) => set({ fsrEnabled }),
    setSmaaEnabled: (smaaEnabled: boolean) => set({ smaaEnabled }),

}));

// ─────────────────────────────────────────────────────────────────────────────
// Selector Hooks (for component-specific subscriptions)
// ─────────────────────────────────────────────────────────────────────────────
export const useDirectorTimeline = () => useDirector(state => ({
    globalT: state.globalT,
    chapterId: state.chapterId,
    chapterT: state.chapterT,
    scrollVelocity: state.scrollVelocitySmooth,
}));

export const useDirectorCamera = () => useDirector(state => state.cameraPose);
export const useDirectorShip = () => useDirector(state => state.shipPose);
export const useDirectorFx = () => useDirector(state => state.fx);
export const useDirectorSceneOpacity = () => useDirector(state => state.sceneOpacity);
export const useDirectorTransitionFx = () => useDirector(state => state.transitionFx);
export const useDirectorTransition2Fx = () => useDirector(state => state.transition2Fx);
export const useDirectorUi = () => useDirector(state => state.ui);
export const useDirectorMouse = () => useDirector(state => state.mouseSmooth);
export const useDirectorTier = () => useDirector(state => state.tier);
export const useDirectorTierOverride = () => useDirector(state => state.tierOverride);

