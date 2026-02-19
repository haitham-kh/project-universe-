"use client";

import gsap from "gsap";
import * as THREE from "three";
import { CAMERA, CHAPTERS, SCENE2_CAMERA, SCENE3_CAMERA } from "./sceneConfig";

// ═══════════════════════════════════════════════════════════════════════════════
// GSAP MASTER TIMELINE - Scroll-Scrubbed Animation
// 
// This timeline defines ALL animations across the scroll journey.
// It animates a plain JS object, NOT Three.js objects directly.
// Director reads from this object and applies values to cameraPose/fx/ui.
//
// KEY: Timeline is SCRUBBED based on scroll.offset, not played.
// ═══════════════════════════════════════════════════════════════════════════════

// Duration represents the full scroll: 0 = start, DURATION = end
const DURATION = 5; // Total timeline duration in GSAP "seconds"

// ─────────────────────────────────────────────────────────────────────────────
// Animated State Object
// This is what GSAP animates. Director copies from this each frame.
// ─────────────────────────────────────────────────────────────────────────────
export interface TimelineState {
    // Camera
    camX: number;
    camY: number;
    camZ: number;
    lookX: number;
    lookY: number;
    lookZ: number;
    fov: number;
    roll: number;

    // Ship
    shipZ: number;
    shipScale: number;
    shipVisible: number; // 0 or 1

    // FX
    bloomIntensity: number;
    warpCue: number;
    atmoGlow: number;

    // Scene Opacity (for transitions)
    spaceOpacity: number;  // Space scene elements (ship, stars, earth)
    scene2Opacity: number; // Scene 2 elements (terrain, water, sky)
    scene3Opacity: number; // Scene 3 elements (moon)
    transitionFlash: number; // White flash during transition

    // Transition 1 FX: Earth → Saturn
    t1StreakIntensity: number;    // 0-1: star streak visibility
    t1VignetteIntensity: number; // 0-1: radial vignette darkness
    t1ColorRampT: number;        // 0=cyan, 0.5=neutral, 1=warm amber
    t1HudOpacity: number;        // 0-1: HUD text visibility
    t1HudPhase: number;          // 0=lock-on, 1=warp, 2=arrival

    // Transition 2 FX: Saturn → Neptune
    t2StreakIntensity: number;
    t2VignetteIntensity: number;
    t2ColorRampT: number;        // 0=saturn palette, 1=neptune palette
    t2HudOpacity: number;
    t2IrisMask: number;          // 0=closed, 1=open

    // UI
    heroOpacity: number;
    contactOpacity: number;
    scrollCueOpacity: number;
}

// Initial state: matches the t=0 camera position exactly
export const timelineState: TimelineState = {
    // Camera - matches CAMERA.position.hero and CAMERA.lookAt.hero
    camX: CAMERA.position.hero.x,
    camY: CAMERA.position.hero.y,
    camZ: CAMERA.position.hero.z,
    lookX: CAMERA.lookAt.hero.x,
    lookY: CAMERA.lookAt.hero.y,
    lookZ: CAMERA.lookAt.hero.z,
    fov: CAMERA.fov.hero,
    roll: 0,

    // Ship
    shipZ: 0,
    shipScale: 1,
    shipVisible: 1,

    // FX
    bloomIntensity: 0.15,
    warpCue: 0,
    atmoGlow: 1,

    // Scene Opacity
    spaceOpacity: 1,
    scene2Opacity: 0,
    scene3Opacity: 0,
    transitionFlash: 0,

    // Transition 1 FX
    t1StreakIntensity: 0,
    t1VignetteIntensity: 0,
    t1ColorRampT: 0,
    t1HudOpacity: 0,
    t1HudPhase: 0,

    // Transition 2 FX
    t2StreakIntensity: 0,
    t2VignetteIntensity: 0,
    t2ColorRampT: 0,
    t2HudOpacity: 0,
    t2IrisMask: 0,

    // UI
    heroOpacity: 1,
    contactOpacity: 0,
    scrollCueOpacity: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// Master Timeline Creation
// ─────────────────────────────────────────────────────────────────────────────
function createMasterTimeline(): gsap.core.Timeline {
    const tl = gsap.timeline({ paused: true });

    // ═══════════════════════════════════════════════════════════════════════════
    // NOTE: Loop fade-in transition (0.00 - 0.02) was moved to LenisBridge
    // The transitionFlash is now set directly when the loop triggers at 0.98+
    // This prevents the transition from playing when simply scrolling backwards
    // ═══════════════════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════════════════
    // HERO CHAPTER (0.00 - 0.10)
    // Establish shot - camera stays mostly stable, slight orbit
    // ═══════════════════════════════════════════════════════════════════════════
    const heroEnd = DURATION * 0.10;

    tl.addLabel("hero", 0);

    // Subtle camera orbit during hero
    tl.to(timelineState, {
        camX: 0.5,
        camY: 0.35,
        duration: heroEnd,
        ease: "power1.inOut",
    }, 0);

    // Fade out hero UI at end of chapter
    tl.to(timelineState, {
        heroOpacity: 0,
        scrollCueOpacity: 0.3,
        duration: heroEnd * 0.3,
        ease: "power2.out",
    }, heroEnd * 0.7); // Start at 70% of hero chapter

    // ═══════════════════════════════════════════════════════════════════════════
    // APPROACH CHAPTER (0.10 - 0.23)
    // Camera moves to side and zooms out, then approaches
    // ═══════════════════════════════════════════════════════════════════════════
    const approachStart = DURATION * 0.10;
    const approachEnd = DURATION * 0.23;
    const approachDuration = approachEnd - approachStart;

    tl.addLabel("approach", approachStart);

    // Camera arc: move out, then approach
    tl.to(timelineState, {
        camX: 5.0,
        camY: 0.5,
        camZ: 22.0,
        fov: CAMERA.fov.approach,
        duration: approachDuration * 0.6,
        ease: "sine.inOut",
    }, approachStart);

    // Second half: start approaching
    tl.to(timelineState, {
        camZ: 18.0,
        camX: 3.5,
        duration: approachDuration * 0.4,
        ease: "power1.in",
    }, approachStart + approachDuration * 0.6);

    // Look target shifts
    tl.to(timelineState, {
        lookX: -2.0,
        lookZ: -15,
        duration: approachDuration,
        ease: "sine.inOut",
    }, approachStart);

    // Subtle roll
    tl.to(timelineState, {
        roll: 0.015,
        duration: approachDuration,
        ease: "power1.inOut",
    }, approachStart);

    // Scroll cue fades
    tl.to(timelineState, {
        scrollCueOpacity: 0,
        duration: approachDuration * 0.3,
        ease: "power1.out",
    }, approachStart + approachDuration * 0.5);

    // ═══════════════════════════════════════════════════════════════════════════
    // WARP CHAPTER (0.23 - 0.31)
    // Warp sequence - dramatic FOV change, camera pulls in
    // Enhanced: star streaks, vignette, color ramp, HUD
    // ═══════════════════════════════════════════════════════════════════════════
    const warpStart = DURATION * 0.23;
    const warpEnd = DURATION * 0.31;
    const warpDuration = warpEnd - warpStart;

    tl.addLabel("warp", warpStart);

    // Camera pulls in with dramatic FOV
    tl.to(timelineState, {
        camX: 2.0,
        camY: 0.5,
        camZ: 10.0,
        fov: CAMERA.fov.warp,
        duration: warpDuration,
        ease: "power2.in",
    }, warpStart);

    // Look target moves closer
    tl.to(timelineState, {
        lookZ: -12,
        duration: warpDuration,
        ease: "power2.in",
    }, warpStart);

    // Roll intensifies
    tl.to(timelineState, {
        roll: -0.008,
        duration: warpDuration,
        ease: "power1.inOut",
    }, warpStart);

    // Warp FX cue
    tl.to(timelineState, {
        warpCue: 1,
        bloomIntensity: 0.4,
        atmoGlow: 1.5,
        duration: warpDuration,
        ease: "power2.in",
    }, warpStart);

    // Ship moves forward
    tl.to(timelineState, {
        shipZ: 8,
        duration: warpDuration,
        ease: "power2.in",
    }, warpStart);

    // ─── TRANSITION 1 FX: Lock-on phase (first 25% of warp) ───
    // HUD appears: "TRAJECTORY LOCK"
    tl.to(timelineState, {
        t1HudOpacity: 1,
        t1HudPhase: 0,
        t1VignetteIntensity: 0.2,
        duration: warpDuration * 0.25,
        ease: "power2.out",
    }, warpStart);

    // Star streaks ramp up + vignette tightens (25-70% of warp)
    tl.to(timelineState, {
        t1StreakIntensity: 1,
        t1VignetteIntensity: 0.8,
        t1ColorRampT: 0.5,
        t1HudPhase: 1,
        t1HudOpacity: 0.6,
        duration: warpDuration * 0.45,
        ease: "power2.in",
    }, warpStart + warpDuration * 0.25);

    // ═══════════════════════════════════════════════════════════════════════════
    // TRANSITION/DESCENT CHAPTER (0.29 - 0.36)
    // Smooth crossfade from space to Scene 2 with white flash
    // FIX: Start space fadeout EARLIER to prevent overlap
    // ═══════════════════════════════════════════════════════════════════════════
    const transStart = DURATION * 0.29; // Earlier start for clean handoff
    const transEnd = DURATION * 0.36;
    const transDuration = transEnd - transStart;

    tl.addLabel("transition", transStart);

    // Flash peak - white flash at start of transition
    tl.to(timelineState, {
        transitionFlash: 1,
        bloomIntensity: 0.8,
        duration: transDuration * 0.15,
        ease: "power3.in",
    }, transStart);

    tl.to(timelineState, {
        transitionFlash: 0,
        duration: transDuration * 0.4,
        ease: "power2.out",
    }, transStart + transDuration * 0.15);

    // ─── TRANSITION 1 FX: Arrival phase ───
    // Color ramp completes: neutral → warm amber
    tl.to(timelineState, {
        t1ColorRampT: 1,
        t1StreakIntensity: 0.3,  // Streaks decelerate
        t1VignetteIntensity: 0.4,
        t1HudPhase: 2,
        t1HudOpacity: 1,
        duration: transDuration * 0.4,
        ease: "power2.out",
    }, transStart);

    // HUD + streaks + vignette fully fade out
    tl.to(timelineState, {
        t1StreakIntensity: 0,
        t1VignetteIntensity: 0,
        t1ColorRampT: 0,
        t1HudOpacity: 0,
        duration: transDuration * 0.4,
        ease: "power2.out",
    }, transStart + transDuration * 0.5);

    // Crossfade: space fades out FIRST, then scene2 fades in
    // FIX: Complete space fadeout BEFORE scene2 starts
    tl.to(timelineState, {
        spaceOpacity: 0,
        shipVisible: 0,
        duration: transDuration * 0.35,
        ease: "power2.inOut",
    }, transStart);

    // Scene 2 fadein starts AFTER FX are settling
    tl.to(timelineState, {
        scene2Opacity: 1,
        duration: transDuration * 0.45,
        ease: "power2.inOut",
    }, transStart + transDuration * 0.55);

    // Camera transitions to Scene 2 starting position
    tl.to(timelineState, {
        camX: SCENE2_CAMERA.position.start.x,
        camY: SCENE2_CAMERA.position.start.y,
        camZ: SCENE2_CAMERA.position.start.z,
        lookX: SCENE2_CAMERA.lookAt.start.x,
        lookY: SCENE2_CAMERA.lookAt.start.y,
        lookZ: SCENE2_CAMERA.lookAt.start.z,
        fov: SCENE2_CAMERA.fov.start,
        roll: 0,
        duration: transDuration,
        ease: "power2.inOut",
    }, transStart);

    // Reset bloom after flash
    tl.to(timelineState, {
        bloomIntensity: 0.2,
        warpCue: 0,
        atmoGlow: 1,
        duration: transDuration * 0.5,
        ease: "power2.out",
    }, transStart + transDuration * 0.3);

    // ═══════════════════════════════════════════════════════════════════════════
    // SCENE 2 CHAPTER (0.36 - 0.60)
    // Ground scene exploration + Cinematic Orbit
    // ═══════════════════════════════════════════════════════════════════════════
    const scene2Start = DURATION * 0.36;
    const scene2End = DURATION * 0.60;
    const scene2Duration = scene2End - scene2Start;

    tl.addLabel("scene2", scene2Start);

    // Camera move 1: Approach to Skate Start (Right)
    tl.to(timelineState, {
        camX: SCENE2_CAMERA.position.skateStart.x,
        camY: SCENE2_CAMERA.position.skateStart.y,
        camZ: SCENE2_CAMERA.position.skateStart.z,
        lookX: SCENE2_CAMERA.lookAt.skateStart.x,
        lookY: SCENE2_CAMERA.lookAt.skateStart.y,
        lookZ: SCENE2_CAMERA.lookAt.skateStart.z,
        duration: scene2Duration * 0.30,
        ease: "sine.inOut",
    }, scene2Start);

    // ═══════════════════════════════════════════════════════════════════════════
    // ORBIT SEQUENCE (30% approach + 70% orbit within Scene 2)
    // Buttery Smooth 2-Stage Arc
    // ═══════════════════════════════════════════════════════════════════════════
    const skateDuration = scene2Duration * 0.55; // Reduced from 0.70 to give 15% hold at ring angle
    const skateMidDuration = skateDuration * 0.5;
    const skateStartTime = scene2Start + scene2Duration * 0.30;

    // 1. Arc In (Right -> Apex/Mid) - Sine In for slow start, fast exit
    tl.to(timelineState, {
        camX: SCENE2_CAMERA.position.skateMid.x,
        camY: SCENE2_CAMERA.position.skateMid.y,
        camZ: SCENE2_CAMERA.position.skateMid.z,
        duration: skateMidDuration,
        ease: "sine.in",
    }, skateStartTime);

    // 2. Arc Out (Apex/Mid -> End) - Sine Out for fast entry, slow finish
    // Camera transitions to user-chosen ring angle from debug freeze tool
    tl.to(timelineState, {
        camX: SCENE2_CAMERA.position.skateEnd.x,
        camY: SCENE2_CAMERA.position.skateEnd.y,
        camZ: SCENE2_CAMERA.position.skateEnd.z,
        lookX: SCENE2_CAMERA.lookAt.skateEnd.x,
        lookY: SCENE2_CAMERA.lookAt.skateEnd.y,
        lookZ: SCENE2_CAMERA.lookAt.skateEnd.z,
        fov: SCENE2_CAMERA.fov.end,
        duration: skateMidDuration,
        ease: "sine.out",
    }, skateStartTime + skateMidDuration);

    // ═══════════════════════════════════════════════════════════════════════════
    // TRANSITION 2: SATURN → NEPTUNE (0.60 - 0.70)
    // Mirrors scene 1→2 feel: white flash + crossfade + gentle FX
    // ═══════════════════════════════════════════════════════════════════════════
    const trans2Start = DURATION * 0.60;
    const trans2End = DURATION * 0.70;
    const trans2Duration = trans2End - trans2Start;

    // ─── White flash peak at start (like scene 1→2) ───
    tl.to(timelineState, {
        t2IrisMask: 1,       // repurposed as white flash intensity
        t2VignetteIntensity: 0.5,
        t2HudOpacity: 1,
        duration: trans2Duration * 0.15,
        ease: "power3.in",
    }, trans2Start);

    // Flash decays
    tl.to(timelineState, {
        t2IrisMask: 0,
        duration: trans2Duration * 0.40,
        ease: "power2.out",
    }, trans2Start + trans2Duration * 0.15);

    // ─── Streak + color ramp build (like scene 1→2 arrival) ───
    tl.to(timelineState, {
        t2StreakIntensity: 0.6,
        t2ColorRampT: 1,
        t2VignetteIntensity: 0.4,
        duration: trans2Duration * 0.40,
        ease: "power2.out",
    }, trans2Start);

    // ─── Crossfade: scene 2 out, then scene 3 in ───
    // Scene 2 fades to black first
    tl.to(timelineState, {
        scene2Opacity: 0,
        duration: trans2Duration * 0.35,
        ease: "power2.inOut",
    }, trans2Start);

    // Scene 3 fades in AFTER FX settle begins
    tl.to(timelineState, {
        scene3Opacity: 1,
        duration: trans2Duration * 0.40,
        ease: "power2.inOut",
    }, trans2Start + trans2Duration * 0.60);

    // ─── All FX settle out (streaks, vignette, color ramp, HUD) ───
    tl.to(timelineState, {
        t2StreakIntensity: 0,
        t2VignetteIntensity: 0,
        t2ColorRampT: 0,
        t2HudOpacity: 0,
        duration: trans2Duration * 0.35,
        ease: "power2.out",
    }, trans2Start + trans2Duration * 0.55);

    // ═══════════════════════════════════════════════════════════════════════════
    // SCENE 3 - NEPTUNE (0.70 -> 1.00) - 30% of timeline
    // FOV-driven zoom-out — camera barely moves, FOV ramps 123 -> 220
    // Neptune "pulls away" through lens distortion, not camera movement
    // ═══════════════════════════════════════════════════════════════════════════
    const scene3Start = DURATION * 0.70;
    const scene3Duration = DURATION * 0.30;

    // Set initial camera position — BEFORE fade-in makes scene visible
    // Must fire at 0.66 (before trans2 fade-in at ~0.66) so camera is ready
    tl.set(timelineState, {
        camX: SCENE3_CAMERA.position.start.x,
        camY: SCENE3_CAMERA.position.start.y,
        camZ: SCENE3_CAMERA.position.start.z,
        lookX: SCENE3_CAMERA.lookAt.start.x,
        lookY: SCENE3_CAMERA.lookAt.start.y,
        lookZ: SCENE3_CAMERA.lookAt.start.z,
        fov: SCENE3_CAMERA.fov.start,
    }, DURATION * 0.66);

    // Gentle camera drift — barely perceptible movement to keep scene alive
    tl.to(timelineState, {
        camX: SCENE3_CAMERA.position.end.x,
        camY: SCENE3_CAMERA.position.end.y,
        camZ: SCENE3_CAMERA.position.end.z,
        lookX: SCENE3_CAMERA.lookAt.end.x,
        lookY: SCENE3_CAMERA.lookAt.end.y,
        lookZ: SCENE3_CAMERA.lookAt.end.z,
        duration: scene3Duration,
        ease: "sine.inOut",
    }, scene3Start);

    // THE MAIN EVENT: FOV ramp 123 -> 220
    // LINEAR ease = consistent 1:1 mapping to scroll position
    // No more "sometimes fast sometimes slow" — scroll position = FOV
    tl.to(timelineState, {
        fov: SCENE3_CAMERA.fov.end,
        duration: scene3Duration,
        ease: "linear",
    }, scene3Start);

    // Contact UI Fade In (during final third)
    tl.to(timelineState, {
        contactOpacity: 1,
        duration: DURATION * 0.06,
        ease: "power2.inOut",
    }, scene3Start + scene3Duration * 0.65);

    // ═══════════════════════════════════════════════════════════════════════════
    // NOTE: Loop exit transition removed — LenisBridge handles the full
    // loop-back sequence (flash + scene reset). The old GSAP fade at 0.94
    // was causing a black screen because it zeroed scene3Opacity before
    // the loop code could trigger and set spaceOpacity back to 1.
    // ═══════════════════════════════════════════════════════════════════════════

    // Scroll cue reappears during Scene 2
    tl.to(timelineState, {
        scrollCueOpacity: 0.5,
        duration: scene2Duration * 0.2,
        ease: "power2.out",
    }, scene2Start);

    return tl;
}

// ─────────────────────────────────────────────────────────────────────────────
// Export the master timeline (singleton)
// ─────────────────────────────────────────────────────────────────────────────
export const masterTimeline = createMasterTimeline();

// ─────────────────────────────────────────────────────────────────────────────
// Scrub function: call this each frame with normalized progress (0-1)
// ─────────────────────────────────────────────────────────────────────────────
export function scrubTimeline(progress: number): void {
    // Clamp progress to 0-1
    const p = Math.max(0, Math.min(1, progress));
    // Set timeline time based on progress
    masterTimeline.time(p * DURATION);
}

// ─────────────────────────────────────────────────────────────────────────────
// Get current state (for Director to read)
// ─────────────────────────────────────────────────────────────────────────────
export function getTimelineState(): TimelineState {
    return timelineState;
}

