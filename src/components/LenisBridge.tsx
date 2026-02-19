"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { timelineState } from "../lib/gsapTimeline";
import { CAMERA } from "../lib/sceneConfig";
import { scrollGuardian, SCROLL_GUARD_CONFIG } from "./ScrollGuardian";
import { scrollFlags } from "../lib/scrollFlags";

// ═══════════════════════════════════════════════════════════════════════════════
// LENIS BRIDGE - Connects Lenis smooth scrolling to R3F ScrollControls
// ═══════════════════════════════════════════════════════════════════════════════

export function LenisBridge() {
    const scroll = useScroll();
    const lenisRef = useRef<Lenis | null>(null);
    const lastOffsetRef = useRef(0);
    const spikeBufferRef = useRef<boolean[]>([]);
    const lastStrikeTimeRef = useRef(0);
    const wrapperRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const wrapper = scroll.el;
        if (!wrapper) return;
        wrapperRef.current = wrapper;

        const content = wrapper.firstElementChild as HTMLElement | null;
        if (!content) return;

        wrapper.scrollTop = 0;

        // GPU compositing hints
        wrapper.style.willChange = "scroll-position";
        wrapper.style.transform = "translateZ(0)";
        wrapper.style.backfaceVisibility = "hidden";
        (wrapper.style as any).webkitOverflowScrolling = "touch";
        wrapper.style.overscrollBehavior = "none";
        content.style.willChange = "transform";
        content.style.transform = "translateZ(0)";
        content.style.backfaceVisibility = "hidden";

        const lenis = new Lenis({
            wrapper,
            content,
            lerp: 0.06,
            smoothWheel: true,
            wheelMultiplier: 0.8,
            touchMultiplier: 0.8,
        });

        lenis.scrollTo(0, { immediate: true });
        lenisRef.current = lenis;

        return () => {
            lenis.destroy();
            lenisRef.current = null;
        };
    }, [scroll.el]);

    useFrame((state) => {
        const lenis = lenisRef.current;
        if (!lenis) return;
        const wrapper = wrapperRef.current;

        // ═══════════════════════════════════════════════════════════════
        // PUNISHMENT MODE
        // ═══════════════════════════════════════════════════════════════
        if (scrollGuardian.isPunished) {
            lenis.stop();
            if (wrapper) {
                wrapper.style.overflow = "hidden";
                wrapper.style.touchAction = "none";
                wrapper.style.pointerEvents = "none";
            }
            return;
        }

        // ═══════════════════════════════════════════════════════════════
        // FRANTIC SCROLL DETECTION
        // ═══════════════════════════════════════════════════════════════
        const currentOffset = scroll.offset;
        const offsetDelta = Math.abs(currentOffset - lastOffsetRef.current);
        lastOffsetRef.current = currentOffset;

        const isSpike = offsetDelta > SCROLL_GUARD_CONFIG.SPIKE_THRESHOLD;
        const buffer = spikeBufferRef.current;
        buffer.push(isSpike);
        if (buffer.length > SCROLL_GUARD_CONFIG.SPIKE_WINDOW) buffer.shift();

        const spikeCount = buffer.filter(Boolean).length;
        const now = Date.now();

        if (spikeCount >= SCROLL_GUARD_CONFIG.SPIKE_COUNT
            && now - lastStrikeTimeRef.current > SCROLL_GUARD_CONFIG.COOLDOWN_MS) {
            lastStrikeTimeRef.current = now;
            scrollGuardian.addStrike();
            spikeBufferRef.current = [];
        }

        // Skip raf + loop during active transition
        if (scrollFlags.isLoopTransitioning) return;

        lenis.raf(state.clock.elapsedTime * 1000);

        // ═══════════════════════════════════════════════════════════════
        // LOOP DETECTION - Use scroll.offset (reliably hits 1.0)
        //
        // scroll.offset comes directly from ScrollControls' wrapper
        // scrollTop — same source CinematicCamera uses for globalT.
        // This works on both desktop and mobile, unlike lenis.progress.
        // ═══════════════════════════════════════════════════════════════

        if (currentOffset >= 0.97 && !scrollFlags.isLoopTransitioning) {
            scrollFlags.isLoopTransitioning = true;

            // ═══════════════════════════════════════════════════════════
            // LOOP TRANSITION - Drives TransitionOverlay + TransitionHUD
            //
            // TransitionOverlay activates when t1VignetteIntensity > 0.01
            // It renders: radial vignette, color ramp wash, film grain
            // TransitionHUD activates when t1HudOpacity > 0.01
            //
            // Sequence matches scene 1→2 GSAP proportions:
            //   0%  → FX build (vignette, streaks, color, HUD)
            //   15% → Flash peak, reset state behind white
            //   55% → Scene 1 reveals, FX fade
            //   90% → All FX gone
            // ═══════════════════════════════════════════════════════════
            const T = 1800;

            // ── 0ms: FX ramp up (triggers TransitionOverlay + HUD) ──
            timelineState.t1VignetteIntensity = 0.8;
            timelineState.t1StreakIntensity = 1;
            timelineState.t1ColorRampT = 0.5;
            timelineState.t1HudOpacity = 1;
            timelineState.t1HudPhase = 3;      // "RETURN WARP" phase
            timelineState.transitionFlash = 0.3;
            timelineState.bloomIntensity = 0.5;

            // ── 270ms (15%): Flash peak + reset state ──
            setTimeout(() => {
                // Flash peaks
                timelineState.transitionFlash = 1;
                timelineState.bloomIntensity = 0.8;
                timelineState.t1VignetteIntensity = 0.4;
                timelineState.t1ColorRampT = 1;
                timelineState.t1HudPhase = 4;   // "RETURNING HOME / EARTH ORBIT"

                // Reset scenes (hidden behind flash)
                timelineState.scene3Opacity = 0;
                timelineState.scene2Opacity = 0;
                timelineState.spaceOpacity = 1;
                timelineState.contactOpacity = 0;
                timelineState.shipVisible = 1;
                timelineState.fov = CAMERA.fov.hero;
                timelineState.camX = CAMERA.position.hero.x;
                timelineState.camY = CAMERA.position.hero.y;
                timelineState.camZ = CAMERA.position.hero.z;
                timelineState.lookX = CAMERA.lookAt.hero.x;
                timelineState.lookY = CAMERA.lookAt.hero.y;
                timelineState.lookZ = CAMERA.lookAt.hero.z;
                timelineState.roll = 0;
                timelineState.shipZ = 0;
                timelineState.shipScale = 1;

                // Reset scroll
                if (wrapper) wrapper.scrollTop = 0;
                lenisRef.current?.scrollTo(0, { immediate: true, force: true });
            }, T * 0.15);

            // ── 540ms (30%): Flash decaying, FX settling ──
            setTimeout(() => {
                timelineState.transitionFlash = 0.5;
                timelineState.bloomIntensity = 0.4;
                timelineState.t1VignetteIntensity = 0.3;
                timelineState.t1StreakIntensity = 0.3;
            }, T * 0.30);

            // ── 810ms (45%): FX fading, flash low ──
            setTimeout(() => {
                timelineState.transitionFlash = 0.15;
                timelineState.bloomIntensity = 0.25;
                timelineState.t1HudOpacity = 0.6;
            }, T * 0.45);

            // ── 990ms (55%): Scene 1 reveals ──
            setTimeout(() => {
                timelineState.transitionFlash = 0;
                timelineState.heroOpacity = 1;
                timelineState.scrollCueOpacity = 1;
                timelineState.t1VignetteIntensity = 0.15;
                timelineState.t1StreakIntensity = 0.1;
                timelineState.t1ColorRampT = 0.3;
                timelineState.t1HudOpacity = 0.3;
            }, T * 0.55);

            // ── 1440ms (80%): Near done ──
            setTimeout(() => {
                timelineState.bloomIntensity = 0.2;
                timelineState.t1VignetteIntensity = 0.05;
                timelineState.t1StreakIntensity = 0;
                timelineState.t1ColorRampT = 0.05;
                timelineState.t1HudOpacity = 0.1;
                timelineState.warpCue = 0;
                timelineState.atmoGlow = 1;
            }, T * 0.80);

            // ── 1620ms (90%): All FX zeroed ──
            setTimeout(() => {
                timelineState.t1StreakIntensity = 0;
                timelineState.t1VignetteIntensity = 0;
                timelineState.t1ColorRampT = 0;
                timelineState.t1HudOpacity = 0;
                timelineState.t1HudPhase = 0;
                timelineState.t2StreakIntensity = 0;
                timelineState.t2VignetteIntensity = 0;
                timelineState.t2ColorRampT = 0;
                timelineState.t2HudOpacity = 0;
                timelineState.t2IrisMask = 0;
            }, T * 0.90);

            // ── 1800ms (100%): Resume scrubbing + kill velocity ──
            setTimeout(() => {
                timelineState.bloomIntensity = 0.15;

                // Kill all momentum — scrollTo(0, immediate) resets velocity
                if (wrapper) wrapper.scrollTop = 0;
                lenisRef.current?.scrollTo(0, { immediate: true, force: true });

                scrollFlags.isLoopTransitioning = false;
            }, T);
        }
    });

    return null;
}

// Keep for backwards compat
export function getIsLoopTriggered(): boolean {
    return scrollFlags.isLoopTransitioning;
}
