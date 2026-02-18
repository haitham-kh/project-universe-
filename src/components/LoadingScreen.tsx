"use client";

import { useState, useEffect, useRef, useCallback } from "react";

import { useProgress } from "@react-three/drei";
import { AssetOrchestrator } from "../lib/AssetOrchestrator";
import { BASE_PATH } from "../lib/basePath";

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SCREEN - Shell-First Boot Pattern
//
// Streaming: Complete loading on CRITICAL PATH only (~3 seconds)
// Non-critical assets stream in background after reveal.
//
// Critical Path: Ship model, HDR, Stars (procedural)
// Deferred: Saturn, Starback, Scene 2 assets
// ═══════════════════════════════════════════════════════════════════════════════

interface LoadingScreenProps {
    onComplete: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎵 AUDIO CLIP DURATION - FINE TUNE THIS VALUE (in seconds)
// The audio file is ~2.5s but we cut it here to remove trailing mic noise
// ═══════════════════════════════════════════════════════════════════════════════
const AUDIO_CLIP_DURATION = 2.3; // <-- ADJUST THIS VALUE (seconds)

// Rainbow gradient colors for UNIVERSE
const letterColors = [
    "#4F46E5", // U - Indigo
    "#3B82F6", // N - Blue
    "#22D3EE", // I - Cyan
    "#10B981", // V - Emerald
    "#84CC16", // E - Lime
    "#F59E0B", // R - Amber
    "#EF4444", // S - Red
    "#EC4899", // E - Pink
];

// Critical path assets that MUST load before reveal
const CRITICAL_PATH_ASSETS = [
    "models_ship.glb",
];

// Minimum time before shell can complete (buffer for model setup)
const MIN_LOAD_TIME_MS = 1000;

// Shell time target - complete within this even if still loading
const SHELL_TARGET_MS = 4000;

// Absolute failsafe
const FAILSAFE_MS = 8000;

/**
 * Check if critical path is ready via AssetOrchestrator
 */
function checkCriticalPath(): { ready: boolean; loaded: number; total: number } {
    let loaded = 0;
    for (const key of CRITICAL_PATH_ASSETS) {
        const status = AssetOrchestrator.getStatus(key);
        if (status === "ready" || status === "pooled") {
            loaded++;
        }
    }
    return {
        ready: loaded === CRITICAL_PATH_ASSETS.length,
        loaded,
        total: CRITICAL_PATH_ASSETS.length,
    };
}

/**
 * Play welcome sound with Web Audio API for smooth fade-in, processing, and clipping
 */
function playWelcomeSound(): void {
    try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

        fetch(`${BASE_PATH}/sound-effects/welcome-to-universe.mp3`)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;

                // Create gain node for volume control and fade-in
                const gainNode = audioContext.createGain();
                gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.85, audioContext.currentTime + 0.5); // Smooth 0.5s fade-in

                // Fade out at the end to make clip seamless
                const fadeOutStart = AUDIO_CLIP_DURATION - 0.15;
                gainNode.gain.setValueAtTime(0.85, audioContext.currentTime + fadeOutStart);
                gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + AUDIO_CLIP_DURATION);

                // Create a subtle low-pass filter for warmth
                const lowPassFilter = audioContext.createBiquadFilter();
                lowPassFilter.type = "lowpass";
                lowPassFilter.frequency.setValueAtTime(6000, audioContext.currentTime);
                lowPassFilter.frequency.linearRampToValueAtTime(18000, audioContext.currentTime + 1.0); // Open up over time

                // Create a compressor for smoother dynamics
                const compressor = audioContext.createDynamicsCompressor();
                compressor.threshold.setValueAtTime(-20, audioContext.currentTime);
                compressor.knee.setValueAtTime(25, audioContext.currentTime);
                compressor.ratio.setValueAtTime(3, audioContext.currentTime);
                compressor.attack.setValueAtTime(0.003, audioContext.currentTime);
                compressor.release.setValueAtTime(0.2, audioContext.currentTime);

                // Connect the chain: source -> lowpass -> compressor -> gain -> output
                source.connect(lowPassFilter);
                lowPassFilter.connect(compressor);
                compressor.connect(gainNode);
                gainNode.connect(audioContext.destination);

                // Start playback and stop at clip duration to cut off mic noise
                source.start(0);
                source.stop(audioContext.currentTime + AUDIO_CLIP_DURATION);

                // Close AudioContext after playback ends to free resources
                source.onended = () => {
                    audioContext.close().catch(() => { });
                };

                console.log(`[LoadingScreen] Welcome sound started (clipped to ${AUDIO_CLIP_DURATION}s)`);
            })
            .catch(err => {
                console.warn("[LoadingScreen] Audio decode failed:", err);
            });
    } catch (err) {
        console.error("[LoadingScreen] Web Audio API not supported:", err);
    }
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
    // drei's useProgress still tracks all assets for the progress bar
    const { progress, active } = useProgress();
    const [displayProgress, setDisplayProgress] = useState(0);
    const [phase, setPhase] = useState("Initializing...");
    const [isReady, setIsReady] = useState(false); // Assets ready, waiting for user click
    const [isExiting, setIsExiting] = useState(false);
    const completedRef = useRef(false);
    const mountTimeRef = useRef(Date.now());
    const isReadyRef = useRef(false);
    const failSafeTriggeredRef = useRef(false);

    // Keep isReadyRef in sync with isReady state
    useEffect(() => {
        isReadyRef.current = isReady;
    }, [isReady]);

    // Mark as ready (waiting for user interaction) - stable callback (no isReady in deps)
    const markReady = useCallback(() => {
        if (isReadyRef.current || completedRef.current) return;
        console.log(`[LoadingScreen] Ready for user interaction`);
        setIsReady(true);
    }, []);

    // Handle user click to enter - this guarantees audio plays
    const handleEnterClick = useCallback(() => {
        if (completedRef.current || isExiting) return;
        completedRef.current = true;

        console.log("[LoadingScreen] User clicked to enter, playing sound...");

        // Play the welcome sound - guaranteed to work because it's user-initiated
        playWelcomeSound();

        // Start fade out
        setIsExiting(true);

        // Wait for fade out to complete before unmounting
        setTimeout(() => {
            onComplete();
        }, 2000); // 2s transition
    }, [onComplete, isExiting]);

    // Smooth progress animation
    useEffect(() => {
        let animationId: number;
        const animate = () => {
            setDisplayProgress(prev => {
                const target = Math.min(progress, 100);
                const diff = target - prev;
                if (Math.abs(diff) < 0.5) return target;
                return prev + diff * 0.15;
            });
            animationId = requestAnimationFrame(animate);
        };
        animationId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationId);
    }, [progress]);

    // Update phase text based on progress
    useEffect(() => {
        if (isReady) {
            setPhase("Ready to explore");
        } else if (displayProgress < 15) {
            setPhase("Initializing universe...");
        } else if (displayProgress < 35) {
            setPhase("Loading spacecraft...");
        } else if (displayProgress < 55) {
            setPhase("Preparing environment...");
        } else if (displayProgress < 75) {
            setPhase("Rendering star fields...");
        } else if (displayProgress < 95) {
            setPhase("Calibrating systems...");
        } else {
            setPhase("Finalizing...");
        }
    }, [displayProgress, isReady]);

    // ═══════════════════════════════════════════════════════════════════════════
    // SHELL-FIRST COMPLETION LOGIC (Deterministic)
    // Fires when displayProgress reaches 100 — no polling interval.
    // markReady is stable (no isReady dep), so this only re-runs on progress changes.
    // ═══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (isReadyRef.current || completedRef.current) return;

        // Don't evaluate readiness until progress UI is at 100
        if (displayProgress < 100) return;

        const elapsed = Date.now() - mountTimeRef.current;
        const { ready: criticalReady } = checkCriticalPath();

        if (criticalReady && elapsed > MIN_LOAD_TIME_MS) {
            const t = window.setTimeout(markReady, 300);
            return () => window.clearTimeout(t);
        }

        if (elapsed >= SHELL_TARGET_MS) {
            markReady();
        }
    }, [displayProgress, markReady]);

    // Also mark ready when drei reports all assets loaded AND displayProgress is 100
    useEffect(() => {
        if (progress >= 100 && !active && displayProgress >= 100 && !isReadyRef.current && !completedRef.current) {
            const timer = setTimeout(markReady, 300);
            return () => clearTimeout(timer);
        }
    }, [progress, active, markReady, displayProgress]);

    // FAILSAFE: Runs ONCE on mount. Triggers after FAILSAFE_MS regardless of progress.
    useEffect(() => {
        const t = window.setTimeout(() => {
            if (!completedRef.current && !isReadyRef.current) {
                console.warn("[LoadingScreen] Failsafe triggered");
                failSafeTriggeredRef.current = true;
                setDisplayProgress(100); // Force UI to show 100% so it matches
                markReady(); // Let user in; assets can continue streaming.
            }
        }, FAILSAFE_MS);

        return () => window.clearTimeout(t);
    }, [markReady]);

    const title = "UNIVERSE";

    // Show enter button only when isReady AND (progress is 100+ OR failsafe bypassed)
    const showEnterButton = isReady && (displayProgress >= 100 || failSafeTriggeredRef.current) && !isExiting;

    return (
        <div
            className={`fixed inset-0 bg-black flex flex-col items-center justify-center z-50 transition-opacity duration-[2000ms] ${isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
            {/* Project Label */}
            <p className="text-white/40 font-mono text-xs mb-2 tracking-widest">PROJECT</p>

            {/* Rainbow UNIVERSE Title */}
            <h1 className="text-6xl font-black tracking-tight mb-1 flex">
                {title.split("").map((letter, i) => (
                    <span
                        key={i}
                        style={{
                            color: letterColors[i],
                            textShadow: `0 0 30px ${letterColors[i]}80, 0 0 60px ${letterColors[i]}40`,
                        }}
                        className="transition-all duration-300"
                    >
                        {letter}
                    </span>
                ))}
            </h1>

            {/* Subtitle */}
            <p className="text-white/50 font-mono text-xs mb-12 tracking-widest">
                // EXPLORE THE COSMOS
            </p>

            {/* Progress bar - transforms into button area */}
            <div className="relative h-14 flex items-center justify-center mb-4">
                {/* Progress bar - fades out when ready */}
                <div
                    className={`absolute w-72 transition-all duration-700 ease-out ${showEnterButton ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}
                >
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: `${displayProgress}%`,
                                background: "linear-gradient(90deg, #4F46E5, #3B82F6, #22D3EE, #10B981, #84CC16, #F59E0B, #EF4444)",
                                transition: "width 0.1s ease-out",
                                boxShadow: "0 0 20px rgba(59,130,246,0.5)",
                            }}
                        />
                    </div>
                </div>

                {/* Enter Button - Elite Cosmetic Redesign */}
                <button
                    onClick={handleEnterClick}
                    disabled={!showEnterButton}
                    className={`
                        group relative px-8 py-4 bg-transparent outline-none
                        transition-all duration-700 ease-out
                        ${showEnterButton
                            ? 'opacity-100 scale-100 pointer-events-auto translate-y-0'
                            : 'opacity-0 scale-90 pointer-events-none translate-y-4'
                        }
                    `}
                >
                    {/* 1. Ambient Background Blur & Gradient Glow (Hover) */}
                    <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl bg-gradient-to-r from-blue-600/30 via-purple-500/30 to-blue-400/30" />

                    {/* 2. Glass Container with Gradient Border */}
                    <div
                        className="relative rounded-full overflow-hidden transition-all duration-500"
                        style={{
                            background: "rgba(10, 10, 20, 0.6)",
                            backdropFilter: "blur(12px)",
                            padding: "1px", // Space for border
                        }}
                    >
                        {/* Gradient Border Layer */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/10 via-white/30 to-white/10 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

                        {/* Inner Content Container */}
                        <div className="relative rounded-full bg-black/40 px-8 py-3 flex items-center gap-4 transition-colors duration-500 group-hover:bg-black/20">

                            {/* Text */}
                            <span className="font-mono text-xs font-bold tracking-[0.2em] text-white uppercase relative z-10 transition-colors duration-300 group-hover:text-blue-100">
                                Enter Cosmos
                            </span>

                            {/* Animated Arrow Icon */}
                            <div className="relative w-4 h-4 overflow-hidden">
                                <svg
                                    className="w-4 h-4 text-blue-200 transform transition-transform duration-500 group-hover:translate-x-full group-hover:opacity-0"
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                                <svg
                                    className="absolute inset-0 w-4 h-4 text-blue-200 transform -translate-x-full opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100"
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>
                        </div>

                        {/* Shimmer Effect */}
                        <div
                            className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"
                            style={{
                                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
                            }}
                        />
                    </div>
                </button>
            </div>

            {/* Phase text */}
            <p className={`text-white/40 font-mono text-[10px] tracking-wider transition-opacity duration-500 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
                {phase}
            </p>

            {/* Progress percentage - hides when ready */}
            <p className={`text-white/25 font-mono text-[10px] mt-2 transition-all duration-500 ${showEnterButton || isExiting ? 'opacity-0' : 'opacity-100'}`}>
                {Math.round(displayProgress)}%
            </p>

            {/* Shimmer animation keyframes */}
            <style jsx>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
}
