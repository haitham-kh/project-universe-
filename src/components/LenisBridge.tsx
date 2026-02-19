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

const LOOP_TRIGGER_OFFSET = 0.92;
const LOOP_REARM_OFFSET = 0.78;
const LOOP_RESET_OFFSET = 0.04;
const LOOP_DURATION_MS = 1800;
const LOOP_COOLDOWN_MS = 500;
const LOOP_RELEASE_MAX_ATTEMPTS = 8;
const MOBILE_VIEWPORT_MAX_WIDTH = 900;
const MOBILE_MAX_SCROLL_PX_PER_SEC = 1700;

type WrapperInteractionSnapshot = {
    overflow: string;
    touchAction: string;
    pointerEvents: string;
};

export function LenisBridge() {
    const scroll = useScroll();
    const lenisRef = useRef<Lenis | null>(null);
    const lastOffsetRef = useRef(0);
    const spikeBufferRef = useRef<boolean[]>([]);
    const lastStrikeTimeRef = useRef(0);
    const wrapperRef = useRef<HTMLElement | null>(null);
    const loopTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const baseWrapperInteractionRef = useRef<WrapperInteractionSnapshot | null>(null);
    const loopArmedRef = useRef(true);
    const loopCooldownUntilRef = useRef(0);
    const lastProgressRef = useRef(0);
    const lastScrollTopRef = useRef(0);
    const isMobileRef = useRef(false);
    const initializedRef = useRef(false);

    const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

    const getWrapperProgress = (wrapper: HTMLElement | null): number | null => {
        if (!wrapper) return null;
        const maxScrollable = wrapper.scrollHeight - wrapper.clientHeight;
        if (maxScrollable <= 1) return null;
        return clamp01(wrapper.scrollTop / maxScrollable);
    };

    const getEffectiveProgress = (
        wrapper: HTMLElement | null,
        scrollOffset: number
    ): number => {
        const candidates = [clamp01(scrollOffset)];

        const wrapperProgress = getWrapperProgress(wrapper);
        if (wrapperProgress !== null) {
            candidates.push(wrapperProgress);
        }

        return Math.max(...candidates);
    };

    const lockWrapperInput = (locked: boolean) => {
        const wrapper = wrapperRef.current;
        const base = baseWrapperInteractionRef.current;
        if (!wrapper || !base) return;

        if (locked) {
            wrapper.style.overflow = "hidden";
            wrapper.style.touchAction = "none";
            wrapper.style.pointerEvents = "none";
            return;
        }

        wrapper.style.overflow = base.overflow;
        wrapper.style.touchAction = base.touchAction;
        wrapper.style.pointerEvents = base.pointerEvents;
    };

    const hardResetToTop = () => {
        const wrapper = wrapperRef.current;
        if (wrapper) wrapper.scrollTo({ top: 0 });
        lenisRef.current?.scrollTo(0, { immediate: true, force: true });
        lastOffsetRef.current = 0;
        lastProgressRef.current = 0;
        lastScrollTopRef.current = 0;
        spikeBufferRef.current = [];
    };

    useEffect(() => {
        const wrapper = scroll.el;
        if (!wrapper) return;
        wrapperRef.current = wrapper;
        baseWrapperInteractionRef.current = {
            overflow: wrapper.style.overflow,
            touchAction: wrapper.style.touchAction,
            pointerEvents: wrapper.style.pointerEvents,
        };

        const content = wrapper.firstElementChild as HTMLElement | null;
        if (!content) return;

        scrollFlags.isLoopTransitioning = false;
        loopArmedRef.current = true;
        loopCooldownUntilRef.current = 0;
        isMobileRef.current =
            window.matchMedia("(pointer: coarse)").matches
            || window.innerWidth <= MOBILE_VIEWPORT_MAX_WIDTH
            || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (!initializedRef.current) {
            wrapper.scrollTo({ top: 0 });
        }

        // GPU compositing hints
        wrapper.style.willChange = "scroll-position";
        wrapper.style.transform = "translateZ(0)";
        wrapper.style.backfaceVisibility = "hidden";
        wrapper.style.setProperty("-webkit-overflow-scrolling", "touch");
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

        if (!initializedRef.current) {
            lenis.scrollTo(0, { immediate: true });
            initializedRef.current = true;
        }

        lastOffsetRef.current = scroll.offset;
        lastProgressRef.current = getEffectiveProgress(wrapper, scroll.offset);
        lastScrollTopRef.current = wrapper.scrollTop;
        lenisRef.current = lenis;

        return () => {
            lenis.destroy();
            lenisRef.current = null;
            loopTimeoutsRef.current.forEach(clearTimeout);
            loopTimeoutsRef.current = [];
            lockWrapperInput(false);
            scrollFlags.isLoopTransitioning = false;
            loopArmedRef.current = true;
            loopCooldownUntilRef.current = 0;
        };
    }, [scroll.el]);

    useFrame((state, delta) => {
        const lenis = lenisRef.current;
        if (!lenis) return;
        const wrapper = wrapperRef.current;

        // 1. PUNISHMENT MODE
        if (scrollGuardian.isPunished) {
            lenis.stop();
            if (wrapper) {
                wrapper.style.overflow = "hidden";
                wrapper.style.touchAction = "none";
                wrapper.style.pointerEvents = "none";
            }
            return;
        }

        // 2. LENIS RAF - run first so scroll.offset is fresh this frame
        if (!scrollFlags.isLoopTransitioning) {
            lenis.raf(state.clock.elapsedTime * 1000);
        }

        if (!scrollFlags.isLoopTransitioning && wrapper) {
            const currentTop = wrapper.scrollTop;
            const deltaTop = currentTop - lastScrollTopRef.current;

            if (isMobileRef.current) {
                const maxDelta = MOBILE_MAX_SCROLL_PX_PER_SEC * Math.min(0.05, Math.max(0.008, delta));
                if (Math.abs(deltaTop) > maxDelta) {
                    const cappedTop = lastScrollTopRef.current + Math.sign(deltaTop) * maxDelta;
                    wrapper.scrollTo({ top: cappedTop });
                    lenis.scrollTo(cappedTop, { immediate: true, force: true });
                }
            }

            lastScrollTopRef.current = wrapper.scrollTop;
        }

        // 3. READ OFFSET
        const previousOffset = lastOffsetRef.current;
        const previousProgress = lastProgressRef.current;
        const currentOffset = scroll.offset;
        const currentProgress = getEffectiveProgress(wrapper, currentOffset);
        const offsetDelta = Math.abs(currentOffset - previousOffset);

        // 4. FRANTIC SCROLL DETECTION
        if (!scrollFlags.isLoopTransitioning) {
            const isSpike = offsetDelta > SCROLL_GUARD_CONFIG.SPIKE_THRESHOLD;
            const buffer = spikeBufferRef.current;
            buffer.push(isSpike);
            if (buffer.length > SCROLL_GUARD_CONFIG.SPIKE_WINDOW) buffer.shift();

            const spikeCount = buffer.filter(Boolean).length;
            const now = Date.now();

            if (
                spikeCount >= SCROLL_GUARD_CONFIG.SPIKE_COUNT
                && now - lastStrikeTimeRef.current > SCROLL_GUARD_CONFIG.COOLDOWN_MS
            ) {
                lastStrikeTimeRef.current = now;
                scrollGuardian.addStrike();
                spikeBufferRef.current = [];
            }
        }

        if (!scrollFlags.isLoopTransitioning && currentProgress <= LOOP_REARM_OFFSET) {
            loopArmedRef.current = true;
        }

        // 5. LOOP DETECTION - edge-triggered while moving forward
        const now = Date.now();
        const crossedLoopThreshold = previousProgress < LOOP_TRIGGER_OFFSET && currentProgress >= LOOP_TRIGGER_OFFSET;
        const movingForward = currentProgress > previousProgress;
        const canTriggerLoop =
            !scrollFlags.isLoopTransitioning
            && loopArmedRef.current
            && now >= loopCooldownUntilRef.current
            && crossedLoopThreshold
            && movingForward;

        if (canTriggerLoop) {
            scrollFlags.isLoopTransitioning = true;
            loopArmedRef.current = false;

            // Clear any stale timeouts
            loopTimeoutsRef.current.forEach(clearTimeout);
            loopTimeoutsRef.current = [];

            lenis.stop();
            lockWrapperInput(true);

            const schedule = (fn: () => void, delay: number) => {
                loopTimeoutsRef.current.push(setTimeout(fn, delay));
            };

            const releaseLoop = (attemptsLeft: number) => {
                hardResetToTop();
                const wrapperProgress = getWrapperProgress(wrapperRef.current) ?? 1;
                const progressSettled = wrapperProgress <= LOOP_RESET_OFFSET;

                if (!progressSettled && attemptsLeft > 0) {
                    loopTimeoutsRef.current.push(
                        setTimeout(() => releaseLoop(attemptsLeft - 1), 16)
                    );
                    return;
                }

                lockWrapperInput(false);
                lenisRef.current?.start();
                scrollFlags.isLoopTransitioning = false;
                loopCooldownUntilRef.current = Date.now() + LOOP_COOLDOWN_MS;
                lastOffsetRef.current = scroll.offset;
                lastProgressRef.current = getEffectiveProgress(wrapperRef.current, scroll.offset);
                lastScrollTopRef.current = wrapperRef.current?.scrollTop ?? 0;
                loopTimeoutsRef.current = [];
            };

            // 0ms: FX ramp up
            timelineState.t1VignetteIntensity = 0.8;
            timelineState.t1StreakIntensity = 1;
            timelineState.t1ColorRampT = 0.5;
            timelineState.t1HudOpacity = 1;
            timelineState.t1HudPhase = 3;
            timelineState.transitionFlash = 0.3;
            timelineState.bloomIntensity = 0.5;

            // 270ms: Flash peak + reset
            schedule(() => {
                timelineState.transitionFlash = 1;
                timelineState.bloomIntensity = 0.8;
                timelineState.t1VignetteIntensity = 0.4;
                timelineState.t1ColorRampT = 1;
                timelineState.t1HudPhase = 4;

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

                hardResetToTop();
            }, LOOP_DURATION_MS * 0.15);

            // 540ms: Flash decaying
            schedule(() => {
                timelineState.transitionFlash = 0.5;
                timelineState.bloomIntensity = 0.4;
                timelineState.t1VignetteIntensity = 0.3;
                timelineState.t1StreakIntensity = 0.3;
            }, LOOP_DURATION_MS * 0.3);

            // 810ms: FX fading
            schedule(() => {
                timelineState.transitionFlash = 0.15;
                timelineState.bloomIntensity = 0.25;
                timelineState.t1HudOpacity = 0.6;
            }, LOOP_DURATION_MS * 0.45);

            // 990ms: Scene 1 reveals
            schedule(() => {
                timelineState.transitionFlash = 0;
                timelineState.heroOpacity = 1;
                timelineState.scrollCueOpacity = 1;
                timelineState.t1VignetteIntensity = 0.15;
                timelineState.t1StreakIntensity = 0.1;
                timelineState.t1ColorRampT = 0.3;
                timelineState.t1HudOpacity = 0.3;
            }, LOOP_DURATION_MS * 0.55);

            // 1440ms: Near done
            schedule(() => {
                timelineState.bloomIntensity = 0.2;
                timelineState.t1VignetteIntensity = 0.05;
                timelineState.t1StreakIntensity = 0;
                timelineState.t1ColorRampT = 0.05;
                timelineState.t1HudOpacity = 0.1;
                timelineState.warpCue = 0;
                timelineState.atmoGlow = 1;
            }, LOOP_DURATION_MS * 0.8);

            // 1620ms: All FX zeroed
            schedule(() => {
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
            }, LOOP_DURATION_MS * 0.9);

            // 1800ms: Done
            schedule(() => {
                timelineState.bloomIntensity = 0.15;
                releaseLoop(LOOP_RELEASE_MAX_ATTEMPTS);
            }, LOOP_DURATION_MS);
        }

        lastOffsetRef.current = currentOffset;
        lastProgressRef.current = currentProgress;
    });

    return null;
}

export function getIsLoopTriggered(): boolean {
    return scrollFlags.isLoopTransitioning;
}
