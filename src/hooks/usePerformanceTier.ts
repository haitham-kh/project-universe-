"use client";

import { useState, useRef, createContext, useContext } from "react";
import { useDirector } from "../lib/useDirector";
import { TIERS, type PerformanceTier } from "../lib/performanceTiers";
import { log } from "../lib/logger";

// Re-export for backwards compatibility
export type { PerformanceTier };
export { TIERS };

// ═══════════════════════════════════════════════════════════════════════════════
// STABLE TIER CONTROLLER - No oscillation
// EMA smoothing, threshold timing, cooldowns
// Mobile: starts Tier 1, max Tier 1, downgrade only
// ═══════════════════════════════════════════════════════════════════════════════

// Context for performance tier
const PerformanceContext = createContext<PerformanceTier>(TIERS[2]);
export const usePerformanceTier = () => useContext(PerformanceContext);
export { PerformanceContext };

// ═══════════════════════════════════════════════════════════════════════════════
// EMA TIER CONTROLLER HOOK - Advanced Performance-Based Tier Selection
// ═══════════════════════════════════════════════════════════════════════════════
//
// METRICS USED:
// 1. P95 Frame Time - Captures worst-case performance, not just average
// 2. Spike Ratio - % of frames > 22ms (missed 60fps)
// 3. Frame Time Variance - Measures stability/consistency (low = smooth)
// 4. EMA Trend - Tracks if performance is improving or degrading over time
// 5. GPU Headroom - Estimates how much capacity is left based on frame time distribution
//
// ═══════════════════════════════════════════════════════════════════════════════

export interface TierControllerConfig {
    startTier: 0 | 1 | 2 | 3;
    maxTier: 0 | 1 | 2 | 3;
    downshiftDuration: number;     // ms with bad metrics before downshift
    upshiftDuration: number;       // ms with good metrics before upshift
    cooldownDuration: number;      // ms cooldown after any tier change
}

interface PerformanceMetrics {
    p95: number;           // 95th percentile frame time (ms)
    spikeRatio: number;    // % of frames > 22ms
    variance: number;      // Frame time variance (stability)
    trend: number;         // EMA trend (-1 = degrading, +1 = improving)
    headroom: number;      // Estimated GPU headroom (0-1)
    score: number;         // Combined performance score (0-100)
}

export function useTierController(config: TierControllerConfig) {
    const [currentTier, setCurrentTier] = useState<0 | 1 | 2 | 3>(config.startTier);

    // Timing refs
    const lastFrameTimeRef = useRef(performance.now());
    const downshiftTimerRef = useRef(0);
    const upshiftTimerRef = useRef(0);
    const cooldownTimerRef = useRef(0);
    const lastTierChangeRef = useRef(0);

    // WARMUP GATE: Don't make tier decisions during initial loading
    const warmupLeftRef = useRef(3000); // 3 seconds warmup

    // Frame time tracking (100 frames for statistical accuracy)
    const frameTimesRef = useRef<number[]>([]);

    // EMA tracking for trend analysis
    const emaShortRef = useRef(16.67); // Short-term EMA (~10 frames)
    const emaLongRef = useRef(16.67);  // Long-term EMA (~50 frames)

    // TIER FLOOR: Track peak tier to prevent oscillation during transitions
    // Once we reach tier 3, floor becomes 2. Once we reach tier 2, floor becomes 1.
    const peakTierRef = useRef<0 | 1 | 2 | 3>(config.startTier);
    const tierFloorRef = useRef<0 | 1 | 2 | 3>(0);

    // Helper: reset buffers after tier change
    const resetBuffers = () => {
        frameTimesRef.current = [];
        emaShortRef.current = 16.67;
        emaLongRef.current = 16.67;
        downshiftTimerRef.current = 0;
        upshiftTimerRef.current = 0;
    };

    // Calculate advanced performance metrics
    const calculateMetrics = (): PerformanceMetrics | null => {
        const frames = frameTimesRef.current;
        if (frames.length < 30) return null;

        const sorted = [...frames].sort((a, b) => a - b);
        const p95 = sorted[Math.floor(sorted.length * 0.95)] || 16.67;
        const p50 = sorted[Math.floor(sorted.length * 0.50)] || 16.67;

        // Spike ratio: frames over 22ms (missed 45fps)
        const spikeRatio = frames.filter(t => t > 22).length / frames.length;

        // Variance: standard deviation of frame times (measures consistency)
        const mean = frames.reduce((a, b) => a + b, 0) / frames.length;
        const variance = Math.sqrt(frames.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / frames.length);

        // Trend: compare short-term vs long-term EMA (-1 to +1)
        const trend = Math.max(-1, Math.min(1, (emaLongRef.current - emaShortRef.current) / 5));

        // GPU Headroom: estimate based on frame time distribution
        // If p50 is well under 16.67ms, there's headroom
        const headroom = Math.max(0, Math.min(1, (16.67 - p50) / 10));

        // Combined score (0-100):
        // - Low p95 = good (target: < 18ms for 100)
        // - Low spike ratio = good (target: 0% for 100)
        // - Low variance = good (target: < 2ms for 100)
        // - Positive trend = good
        // - High headroom = good
        const p95Score = Math.max(0, 100 - (p95 - 16.67) * 8);
        const spikeScore = 100 - (spikeRatio * 300);
        const varianceScore = Math.max(0, 100 - variance * 15);
        const trendScore = 50 + (trend * 30);
        const headroomScore = headroom * 100;

        const score = (
            p95Score * 0.35 +        // P95 is most important
            spikeScore * 0.25 +      // Spikes hurt experience
            varianceScore * 0.20 +   // Consistency matters
            trendScore * 0.10 +      // Trend is a hint
            headroomScore * 0.10     // Headroom for upshift potential
        );

        return { p95, spikeRatio, variance, trend, headroom, score: Math.max(0, Math.min(100, score)) };
    };

    // Determine target tier based on metrics
    const getTargetTier = (metrics: PerformanceMetrics): 0 | 1 | 2 | 3 => {
        const { score, p95, spikeRatio, variance, headroom } = metrics;

        // TIER 3 REQUIREMENTS (Overkill - very strict)
        // Score > 90, p95 < 14ms, no spikes, low variance, high headroom
        if (score > 90 && p95 < 14 && spikeRatio < 0.01 && variance < 1.5 && headroom > 0.3) {
            return 3;
        }

        // TIER 2 REQUIREMENTS (High quality)
        // Score > 75, p95 < 17ms, minimal spikes
        if (score > 75 && p95 < 17 && spikeRatio < 0.05) {
            return 2;
        }

        // TIER 1 REQUIREMENTS (Balanced)
        // Score > 50, p95 < 22ms
        if (score > 50 && p95 < 22) {
            return 1;
        }

        // TIER 0 (Survival mode)
        return 0;
    };

    const updatePerformance = (delta: number) => {
        const now = performance.now();
        const frameTime = now - lastFrameTimeRef.current;
        lastFrameTimeRef.current = now;
        const deltaMs = delta * 1000;

        // Track frame times (100 frames for statistical accuracy)
        frameTimesRef.current.push(frameTime);
        if (frameTimesRef.current.length > 100) {
            frameTimesRef.current.shift();
        }

        // Update EMAs for trend analysis
        const alphaShort = 0.2;  // Fast response (~10 frames)
        const alphaLong = 0.04;  // Slow response (~50 frames)
        emaShortRef.current = emaShortRef.current * (1 - alphaShort) + frameTime * alphaShort;
        emaLongRef.current = emaLongRef.current * (1 - alphaLong) + frameTime * alphaLong;

        // CHECK FOR MANUAL OVERRIDE from Director store
        const tierOverride = useDirector.getState().tierOverride;
        if (tierOverride !== null) {
            if (currentTier !== tierOverride) {
                setCurrentTier(tierOverride);
                resetBuffers();
            }
            return;
        }

        // WARMUP GATE: Skip tier decisions during warmup
        if (warmupLeftRef.current > 0) {
            warmupLeftRef.current -= deltaMs;
            return;
        }

        // Update cooldown timer
        if (cooldownTimerRef.current > 0) {
            cooldownTimerRef.current -= deltaMs;
            downshiftTimerRef.current = 0;
            upshiftTimerRef.current = 0;
            return;
        }

        // Calculate metrics
        const metrics = calculateMetrics();
        if (!metrics) return;

        const targetTier = getTargetTier(metrics);

        // DOWNSHIFT: Target tier is lower
        if (targetTier < currentTier) {
            downshiftTimerRef.current += deltaMs;
            upshiftTimerRef.current = 0;

            // Faster downshift if performance is really bad
            const urgency = metrics.p95 > 30 || metrics.spikeRatio > 0.2 ? 0.5 : 1;

            if (downshiftTimerRef.current >= config.downshiftDuration * urgency) {
                // Apply tier floor - don't drop more than 1 tier below peak
                const floorTier = tierFloorRef.current;
                const proposedTier = (currentTier - 1) as 0 | 1 | 2 | 3;
                const newTier = Math.max(proposedTier, floorTier) as 0 | 1 | 2 | 3;

                if (newTier < currentTier) {
                    setCurrentTier(newTier);
                    cooldownTimerRef.current = config.cooldownDuration;
                    lastTierChangeRef.current = now;
                    resetBuffers();
                    log(`[TierController] ⬇️ Downshift to Tier ${newTier} (floor: ${floorTier}) | Score: ${metrics.score.toFixed(0)} | P95: ${metrics.p95.toFixed(1)}ms`);
                } else {
                    // At floor, just reset timer
                    downshiftTimerRef.current = 0;
                }
            }
        }
        // UPSHIFT: Target tier is higher
        else if (targetTier > currentTier && currentTier < config.maxTier) {
            upshiftTimerRef.current += deltaMs;
            downshiftTimerRef.current = 0;

            // Conservative upshift (longer duration required)
            if (upshiftTimerRef.current >= config.upshiftDuration) {
                const newTier = (currentTier + 1) as 0 | 1 | 2 | 3;
                setCurrentTier(newTier);

                // Update peak and floor when we reach higher tiers
                if (newTier > peakTierRef.current) {
                    peakTierRef.current = newTier;
                    // Floor is 1 tier below peak (min 0)
                    tierFloorRef.current = Math.max(0, newTier - 1) as 0 | 1 | 2 | 3;
                    log(`[TierController] 🎯 New peak tier ${newTier}, floor set to ${tierFloorRef.current}`);
                }

                cooldownTimerRef.current = config.cooldownDuration * 1.5; // Longer cooldown after upshift
                lastTierChangeRef.current = now;
                resetBuffers();
                log(`[TierController] ⬆️ Upshift to Tier ${newTier} | Score: ${metrics.score.toFixed(0)} | P95: ${metrics.p95.toFixed(1)}ms | Headroom: ${(metrics.headroom * 100).toFixed(0)}%`);
            }
        }
        // Performance is stable - decay timers
        else {
            downshiftTimerRef.current = Math.max(0, downshiftTimerRef.current - deltaMs * 0.3);
            upshiftTimerRef.current = Math.max(0, upshiftTimerRef.current - deltaMs * 0.3);
        }
    };

    return { currentTier, updatePerformance };
}
