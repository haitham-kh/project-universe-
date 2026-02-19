"use client";

import { useEffect, useState, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// LANDSCAPE PROMPT - Forces mobile users to rotate before entering the experience
// ═══════════════════════════════════════════════════════════════════════════════

interface LandscapePromptProps {
    onReady: () => void;
}

function detectMobile(): boolean {
    if (typeof window === "undefined") return false;
    return (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        ) ||
        ("ontouchstart" in window && window.innerWidth <= 1024)
    );
}

function detectPortrait(): boolean {
    if (typeof window === "undefined") return false;
    return window.innerHeight > window.innerWidth;
}

export function LandscapePrompt({ onReady }: LandscapePromptProps) {
    const [isMobile] = useState(() => detectMobile());
    const [isPortrait, setIsPortrait] = useState(() => detectPortrait());
    const [dismissed, setDismissed] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);

    // Desktop → immediately ready
    useEffect(() => {
        if (!isMobile) onReady();
    }, [isMobile, onReady]);

    // Auto-dismiss when rotated to landscape
    useEffect(() => {
        if (isMobile && !isPortrait && !dismissed) {
            const t = setTimeout(() => {
                setFadeOut(true);
                setTimeout(() => { setDismissed(true); onReady(); }, 600);
            }, 300);
            return () => clearTimeout(t);
        }
    }, [isMobile, isPortrait, dismissed, onReady]);

    // Orientation listener
    useEffect(() => {
        if (!isMobile) return;
        const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
        window.addEventListener("resize", check);
        window.addEventListener("orientationchange", check);
        return () => {
            window.removeEventListener("resize", check);
            window.removeEventListener("orientationchange", check);
        };
    }, [isMobile]);

    const enableLandscape = useCallback(async () => {
        try {
            const docEl = document.documentElement as any;
            if (docEl.requestFullscreen) await docEl.requestFullscreen();
            else if (docEl.webkitRequestFullscreen) await docEl.webkitRequestFullscreen();
            if (screen.orientation && (screen.orientation as any).lock)
                await (screen.orientation as any).lock("landscape");
        } catch (e) {
            console.warn("[LandscapePrompt] Could not lock orientation.", e);
        }
    }, []);

    const handleDismiss = useCallback(() => {
        setFadeOut(true);
        setTimeout(() => { setDismissed(true); onReady(); }, 600);
    }, [onReady]);

    if (!isMobile || dismissed || !isPortrait) return null;

    return (
        <div
            className={`fixed inset-0 z-[999] flex flex-col items-center justify-center text-white touch-none pointer-events-auto transition-opacity duration-[600ms] ${fadeOut ? "opacity-0" : "opacity-100"}`}
            style={{
                background: "rgba(0, 0, 0, 0.55)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
            }}
        >
            <style>{`
                @keyframes phoneToLandscape {
                    0%, 15%  {
                        transform: translate(-50%, -50%) rotate(0deg);
                        width: 48px; height: 82px;
                    }
                    40%, 70% {
                        transform: translate(-50%, -50%) rotate(90deg);
                        width: 48px; height: 82px;
                    }
                    85%, 100% {
                        transform: translate(-50%, -50%) rotate(0deg);
                        width: 48px; height: 82px;
                    }
                }
                @keyframes glowPulse {
                    0%, 100% { box-shadow: 0 0 20px rgba(56,189,248,0.15); }
                    50%      { box-shadow: 0 0 40px rgba(56,189,248,0.35); }
                }
                .phone-anim {
                    animation: phoneToLandscape 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }
                .glow-pulse {
                    animation: glowPulse 3.2s ease-in-out infinite;
                }
            `}</style>

            {/* Phone animation */}
            <div className="relative w-40 h-40 mb-8 glow-pulse rounded-full">
                <div className="phone-anim absolute left-1/2 top-1/2"
                    style={{ width: 48, height: 82 }}>
                    <div className="w-full h-full border-2 border-white/60 rounded-[12px] bg-white/5 flex flex-col items-center justify-between py-1.5 overflow-hidden">
                        {/* Notch */}
                        <div className="w-5 h-[2px] bg-white/30 rounded-full" />
                        {/* Screen */}
                        <div className="flex-1 w-[78%] my-1 rounded-sm border border-white/8 bg-gradient-to-b from-cyan-500/8 to-blue-500/8" />
                        {/* Home bar */}
                        <div className="w-6 h-[2px] bg-white/20 rounded-full" />
                    </div>
                </div>
            </div>

            {/* Title */}
            <h2 className="text-lg font-bold tracking-[0.2em] uppercase mb-2 text-center bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                Rotate Your Device
            </h2>

            {/* Subtitle */}
            <p className="text-white/40 font-mono text-[9px] tracking-[0.12em] text-center max-w-[200px] mb-8 uppercase leading-[1.7]">
                Landscape mode for the optimal cosmos experience
            </p>

            {/* Force Landscape */}
            <button
                onClick={enableLandscape}
                className="group relative px-6 py-2.5 bg-transparent outline-none overflow-hidden rounded-full transition-all duration-500 mb-5"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 opacity-60 group-active:opacity-100 transition-opacity blur-md" />
                <div className="relative border border-white/15 rounded-full bg-white/5 px-5 py-2 flex items-center justify-center gap-2.5 group-active:bg-white/10 backdrop-blur-sm transition-colors">
                    <svg className="w-3.5 h-3.5 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    <span className="font-mono text-[10px] font-bold tracking-[0.15em] text-white uppercase">
                        Force Landscape
                    </span>
                </div>
            </button>

            {/* Dismiss / Continue */}
            <button
                onClick={handleDismiss}
                className="text-white/25 font-mono text-[9px] tracking-[0.12em] uppercase active:text-white/60 transition-colors py-2 px-4"
            >
                Continue in Portrait →
            </button>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANDSCAPE EXIT BUTTON - Floating button to leave forced landscape mode
// Render this in page.tsx when the experience is active on mobile
// ═══════════════════════════════════════════════════════════════════════════════

export function LandscapeExitButton() {
    const [isMobile] = useState(() => detectMobile());
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const check = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", check);
        return () => document.removeEventListener("fullscreenchange", check);
    }, []);

    const exitLandscape = useCallback(async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
            if (screen.orientation && (screen.orientation as any).unlock) {
                (screen.orientation as any).unlock();
            }
        } catch (e) {
            console.warn("[LandscapeExitButton] Could not exit.", e);
        }
    }, []);

    // Only show on mobile when in fullscreen/locked mode
    if (!isMobile || !isFullscreen) return null;

    return (
        <button
            onClick={exitLandscape}
            className="fixed top-3 right-3 z-[998] bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-2 active:bg-white/10 transition-colors"
        >
            <svg className="w-3 h-3 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="font-mono text-[8px] text-white/40 uppercase tracking-wider">
                Exit Landscape
            </span>
        </button>
    );
}
