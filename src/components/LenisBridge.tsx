"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { timelineState } from "../lib/gsapTimeline";
import { CAMERA } from "../lib/sceneConfig";

// ═══════════════════════════════════════════════════════════════════════════════
// LENIS BRIDGE - Connects Lenis smooth scrolling to R3F ScrollControls
// 
// Key concept: Lenis wraps the ScrollControls container, providing buttery
// smooth scrolling while ScrollControls still provides scroll.offset for animations.
// 
// ScrollControls damping is set to 0 to avoid double-smoothing.
// ═══════════════════════════════════════════════════════════════════════════════

// Flag to track if we're in a loop transition (coming from 0.98+ → 0)
// This prevents the transition animation from playing when simply scrolling backwards
let isLoopTriggered = false;

export function LenisBridge() {
    const scroll = useScroll();
    const lenisRef = useRef<Lenis | null>(null);

    useEffect(() => {
        const wrapper = scroll.el;
        if (!wrapper) return;

        // Find the scroll content element inside wrapper
        // ScrollControls creates: wrapper > content (with pages)
        const content = wrapper.firstElementChild as HTMLElement | null;
        if (!content) {
            console.warn("[LenisBridge] Could not find scroll content element");
            return;
        }

        // Force scroll to top on mount to protect initial camera position
        wrapper.scrollTop = 0;

        const lenis = new Lenis({
            wrapper,
            content,
            // Tuned for premium feel without being floaty
            lerp: 0.07,             // 0.07 = buttery, heavier feel
            smoothWheel: true,
            wheelMultiplier: 1,
        });

        // Ensure we start at exactly 0
        lenis.scrollTo(0, { immediate: true });

        lenisRef.current = lenis;

        return () => {
            lenis.destroy();
            lenisRef.current = null;
        };
    }, [scroll.el]);

    // Use R3F's frame loop for Lenis updates (single RAF, no conflicts)
    useFrame((state, delta) => {
        lenisRef.current?.raf(state.clock.elapsedTime * 1000);

        // ═══════════════════════════════════════════════════════════════════════════
        // LOOP LOGIC - Only loop at END, not at start
        // "Transition back to first scene as if it is a full loop"
        // ═══════════════════════════════════════════════════════════════════════════

        // Trigger loop when reaching the END (0.98+)
        if (scroll.offset > 0.98 && !isLoopTriggered) {
            isLoopTriggered = true; // Mark that we're looping

            // Reset timeline state to initial values for clean Scene 1 return
            timelineState.scene3Opacity = 0;
            timelineState.scene2Opacity = 0;
            timelineState.spaceOpacity = 1;
            timelineState.heroOpacity = 1;
            timelineState.contactOpacity = 0;
            timelineState.scrollCueOpacity = 1;
            timelineState.shipVisible = 1;
            timelineState.transitionFlash = 0;
            timelineState.warpCue = 0;
            timelineState.bloomIntensity = 0.2;
            timelineState.atmoGlow = 1;
            // Reset camera to hero position — using CAMERA config (single source of truth)
            timelineState.fov = CAMERA.fov.hero;
            timelineState.camX = CAMERA.position.hero.x;
            timelineState.camY = CAMERA.position.hero.y;
            timelineState.camZ = CAMERA.position.hero.z;
            timelineState.lookX = CAMERA.lookAt.hero.x;
            timelineState.lookY = CAMERA.lookAt.hero.y;
            timelineState.lookZ = CAMERA.lookAt.hero.z;
            timelineState.roll = 0;

            // Reset both the wrapper and Lenis for robustness
            const wrapper = scroll.el;
            if (wrapper) {
                wrapper.scrollTop = 0;
            }
            lenisRef.current?.scrollTo(0, { immediate: true, force: true });
        }

        // Once we've scrolled past the loop reset point, mark loop as complete
        if (isLoopTriggered && scroll.offset > 0.01 && scroll.offset < 0.95) {
            isLoopTriggered = false;
        }
    });

    return null;
}

// Export the loop flag for gsapTimeline to check
export function getIsLoopTriggered(): boolean {
    return isLoopTriggered;
}
