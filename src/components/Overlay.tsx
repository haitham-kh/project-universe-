"use client";

import { useEffect, useState, useRef } from "react";
import { useDirector } from "../lib/useDirector";

// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// QUALITY TIERS - imported from single source of truth
// ═══════════════════════════════════════════════════════════════════════════════
import { TIER_LABELS } from "../lib/performanceTiers";

type QualityTierKey = 0 | 1 | 2 | 3;

// Static gradient for UNIVERSE text (Deep Ocean theme)
const UNIVERSE_GRADIENT = [
    { offset: "0%", color: "#083344" },
    { offset: "12%", color: "#0e7490" },
    { offset: "25%", color: "#0891b2" },
    { offset: "40%", color: "#06b6d4" },
    { offset: "58%", color: "#22d3ee" },
    { offset: "78%", color: "#67e8f9" },
    { offset: "92%", color: "#a5f3fc" },
    { offset: "100%", color: "#e0f7ff" },
];

const SHINE_INTENSITY = 0.95;
const SHINE_WIDTH = 12;

// ═══════════════════════════════════════════════════════════════════════════════
// OVERLAY - Refined Elegance
// 
// Design Philosophy:
// - Lightweight typography
// - Subtle interactive shine on letters only
// - Sophisticated and minimal
// ═══════════════════════════════════════════════════════════════════════════════

export function Overlay() {
    const logoRef = useRef<SVGSVGElement>(null);
    const shineRef = useRef<SVGLinearGradientElement>(null);
    const [showDebug, setShowDebug] = useState(false);

    // ═══════════════════════════════════════════════════════════════════════════
    // ZUSTAND SELECTORS - Only re-render when these specific values change
    // This avoids 60fps React re-renders!
    // ═══════════════════════════════════════════════════════════════════════════
    const heroOpacity = useDirector(state => state.ui.heroOpacity);
    const contactOpacity = useDirector(state => state.ui.contactOpacity);
    const currentTier = useDirector(state => state.tier);
    const tierOverride = useDirector(state => state.tierOverride);
    const fsrEnabled = useDirector(state => state.fsrEnabled);

    // Hide Scene 1 overlay when Scene 2 OR Scene 3 is active
    const scene2Opacity = useDirector(state => state.sceneOpacity?.scene2Opacity ?? 0);
    const scene3Opacity = useDirector(state => state.sceneOpacity?.scene3Opacity ?? 0);

    // Get actions from Director - MUST be called before any early return!
    const setTierOverride = useDirector(state => state.setTierOverride);
    const setFsrEnabled = useDirector(state => state.setFsrEnabled);

    // ═══════════════════════════════════════════════════════════════════════════
    // REF-BASED SHINE UPDATE - Zero re-renders for mouse movement
    // Updates SVG gradient stops directly via DOM, not React state
    // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURN!
    // ═══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        // Skip if Scene 2 or Scene 3 is visible
        if (scene2Opacity > 0.05 || scene3Opacity > 0.05) return;

        let lastMouseX = 0;

        // Subscribe to store changes without triggering React re-renders
        const unsubscribe = useDirector.subscribe((state) => {
            const mouseX = state.mouseX;

            // Only update if mouseX actually changed
            if (Math.abs(mouseX - lastMouseX) > 0.001) {
                lastMouseX = mouseX;

                // Update shine position directly on DOM
                const shinePosition = (mouseX + 1) * 50; // 0 to 100
                const stops = shineRef.current?.querySelectorAll('stop');
                if (stops && stops.length >= 7) {
                    const positions = [
                        Math.max(0, shinePosition - SHINE_WIDTH),
                        Math.max(0, shinePosition - SHINE_WIDTH * 0.4),
                        Math.max(0, shinePosition - SHINE_WIDTH * 0.16),
                        shinePosition,
                        Math.min(100, shinePosition + SHINE_WIDTH * 0.16),
                        Math.min(100, shinePosition + SHINE_WIDTH * 0.4),
                        Math.min(100, shinePosition + SHINE_WIDTH),
                    ];
                    stops.forEach((stop, i) => {
                        if (positions[i] !== undefined) {
                            stop.setAttribute('offset', `${positions[i]}%`);
                        }
                    });
                }
            }
        });
        return unsubscribe;
    }, [scene2Opacity, scene3Opacity]);

    // Keyboard shortcut to toggle debug menu
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '`' || e.key === '~') {
                setShowDebug(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Only read once for initial render; live updates come from subscribe()
    const initialMouseXRef = useRef(useDirector.getState().mouseX);

    // Initial shine position (only used for first render)
    const shinePosition = (initialMouseXRef.current + 1) * 50;

    // EARLY RETURN AFTER ALL HOOKS - Don't render Scene 1 overlay when Scene 2 or Scene 3 is visible
    if (scene2Opacity > 0.05 || scene3Opacity > 0.05) return null;

    return (
        <div className="fixed inset-0 pointer-events-none select-none overflow-hidden">

            {/* ═══════════════════════════════════════════════════════════════════
                HERO SECTION - Compact, Elegant Title
            ═══════════════════════════════════════════════════════════════════ */}
            <div
                className="absolute transition-all duration-700 ease-out"
                style={{
                    opacity: heroOpacity,
                    transform: `translateY(${(1 - heroOpacity) * -30}px)`,
                    left: 'clamp(32px, 5vw, 80px)',
                    top: 'clamp(48px, 8vh, 100px)',
                }}
            >
                <div className="flex flex-col gap-2">
                    {/* PROJECT label */}
                    <div className="flex items-center gap-2">
                        <div
                            className="w-0.5 h-0.5 rounded-full"
                            style={{
                                background: 'rgba(103,232,249,0.5)',
                                boxShadow: '0 0 4px rgba(103,232,249,0.5)',
                            }}
                        />
                        <p
                            className="text-[9px] sm:text-[10px] font-light tracking-[0.35em] uppercase"
                            style={{
                                color: 'rgba(255,255,255,0.55)',
                                textShadow: `
                                    0 0 30px rgba(0,0,0,1),
                                    0 2px 8px rgba(0,0,0,0.9)
                                `,
                            }}
                        >
                            Project
                        </p>
                    </div>

                    {/* UNIVERSE - SVG-based for precise letter masking */}
                    <svg
                        ref={logoRef}
                        viewBox="0 0 420 65"
                        className="w-[280px] sm:w-[360px] md:w-[420px] h-auto"
                        style={{
                            overflow: 'visible',
                            filter: `
                                drop-shadow(0 0 1px rgba(255,255,255,0.5))
                                drop-shadow(0 0 5px rgba(103,232,249,0.35))
                                drop-shadow(0 0 16px rgba(34,211,238,0.2))
                                drop-shadow(0 2px 12px rgba(0,0,0,0.6))
                            `,
                        }}
                    >
                        <defs>
                            {/* Base gradient for text - static Deep Ocean theme */}
                            <linearGradient id="universeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                {UNIVERSE_GRADIENT.map((stop, i) => (
                                    <stop key={i} offset={stop.offset} stopColor={stop.color} />
                                ))}
                            </linearGradient>

                            {/* Shine gradient - moves with mouse (updated via ref, not state) */}
                            <linearGradient ref={shineRef} id="shineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset={`${Math.max(0, shinePosition - SHINE_WIDTH)}%`} stopColor="transparent" />
                                <stop offset={`${Math.max(0, shinePosition - SHINE_WIDTH * 0.4)}%`} stopColor={`rgba(255,255,255,${SHINE_INTENSITY * 0.26})`} />
                                <stop offset={`${Math.max(0, shinePosition - SHINE_WIDTH * 0.16)}%`} stopColor={`rgba(255,255,255,${SHINE_INTENSITY * 0.63})`} />
                                <stop offset={`${shinePosition}%`} stopColor={`rgba(255,255,255,${SHINE_INTENSITY})`} />
                                <stop offset={`${Math.min(100, shinePosition + SHINE_WIDTH * 0.16)}%`} stopColor={`rgba(255,255,255,${SHINE_INTENSITY * 0.63})`} />
                                <stop offset={`${Math.min(100, shinePosition + SHINE_WIDTH * 0.4)}%`} stopColor={`rgba(255,255,255,${SHINE_INTENSITY * 0.26})`} />
                                <stop offset={`${Math.min(100, shinePosition + SHINE_WIDTH)}%`} stopColor="transparent" />
                            </linearGradient>

                            {/* ClipPath using text - this is the key! */}
                            <clipPath id="universeClip">
                                <text
                                    x="0"
                                    y="52"
                                    fontSize="62"
                                    fontWeight="500"
                                    fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                                    letterSpacing="0.03em"
                                >
                                    UNIVERSE
                                </text>
                            </clipPath>
                        </defs>

                        {/* Layer 1: Base gradient text */}
                        <text
                            x="0"
                            y="52"
                            fontSize="62"
                            fontWeight="500"
                            fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                            letterSpacing="0.03em"
                            fill="url(#universeGradient)"
                        >
                            UNIVERSE
                        </text>

                        {/* Layer 2: Shine layer - CLIPPED to text shape */}
                        <rect
                            x="0"
                            y="0"
                            width="420"
                            height="65"
                            fill="url(#shineGradient)"
                            clipPath="url(#universeClip)"
                            style={{
                                mixBlendMode: 'overlay',
                                transition: 'none', // No transition for smooth mouse following
                            }}
                        />
                    </svg>

                    {/* Tagline - compact */}
                    <div className="flex items-start gap-3 mt-0.5">
                        {/* Subtle accent line */}
                        <div
                            className="w-[1px] h-9 rounded-full mt-0.5"
                            style={{
                                background: 'linear-gradient(to bottom, rgba(103,232,249,0.5), rgba(34,211,238,0.12), transparent)',
                                boxShadow: '0 0 3px rgba(103,232,249,0.2)',
                            }}
                        />
                        <div className="flex flex-col gap-0.5">
                            <p
                                className="text-[12px] sm:text-[13px] font-light"
                                style={{
                                    color: 'rgba(255,255,255,0.65)',
                                    textShadow: `
                                        0 0 20px rgba(0,0,0,1),
                                        0 2px 8px rgba(0,0,0,0.8)
                                    `,
                                }}
                            >
                                Explore the cosmos
                            </p>
                            <p
                                className="text-[9px] sm:text-[10px] tracking-[0.15em] uppercase font-light"
                                style={{
                                    color: 'rgba(255,255,255,0.38)',
                                    textShadow: '0 0 20px rgba(0,0,0,1), 0 2px 6px rgba(0,0,0,0.8)',
                                }}
                            >
                                Haitham Industries
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                SCROLL INDICATOR - CENTERED
            ═══════════════════════════════════════════════════════════════════ */}
            <div
                className="absolute left-1/2 transition-all duration-700"
                style={{
                    transform: `translate(-50%, ${(1 - heroOpacity) * 20}px)`,
                    opacity: heroOpacity,
                    bottom: 'clamp(28px, 5vh, 50px)',
                }}
            >
                <div className="flex flex-col items-center gap-3">
                    {/* SCROLL text */}
                    <p
                        className="text-[10px] sm:text-[11px] tracking-[0.38em] uppercase font-semibold"
                        style={{
                            color: 'rgba(255,255,255,0.8)',
                            textShadow: `
                                0 0 20px rgba(0,0,0,1),
                                0 0 40px rgba(0,0,0,0.9),
                                0 2px 6px rgba(0,0,0,1),
                                0 0 10px rgba(34,211,238,0.35)
                            `,
                        }}
                    >
                        Scroll to Explore
                    </p>

                    {/* Animated scroll line */}
                    <div
                        className="w-[1.5px] h-14 relative overflow-hidden rounded-full"
                        style={{
                            background: 'linear-gradient(to bottom, rgba(255,255,255,0.35), rgba(255,255,255,0.05))',
                            boxShadow: '0 0 6px rgba(255,255,255,0.12)',
                        }}
                    >
                        {/* Traveling light */}
                        <div
                            className="absolute w-[5px] h-[5px] rounded-full"
                            style={{
                                left: '-1.75px',
                                background: 'radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(103,232,249,0.55) 50%, transparent 100%)',
                                boxShadow: '0 0 6px rgba(103,232,249,0.6), 0 0 14px rgba(34,211,238,0.35)',
                                animation: 'scrollLine 2s ease-in-out infinite',
                            }}
                        />
                    </div>

                    {/* Subtle chevron */}
                    <div style={{ animation: 'chevronPulse 2s ease-in-out infinite' }}>
                        <svg width="12" height="7" viewBox="0 0 12 7" fill="none">
                            <path
                                d="M1 1L6 6L11 1"
                                stroke="rgba(255,255,255,0.55)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                    filter: 'drop-shadow(0 0 5px rgba(103,232,249,0.35))'
                                }}
                            />
                        </svg>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                CONTACT SECTION
            ═══════════════════════════════════════════════════════════════════ */}
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center transition-all duration-700 px-8 w-full max-w-md"
                style={{
                    opacity: contactOpacity,
                    transform: `translate(-50%, calc(-50% + ${(1 - contactOpacity) * 40}px))`,
                }}
            >
                <p
                    className="text-[11px] tracking-[0.4em] uppercase font-semibold mb-5"
                    style={{
                        color: 'rgba(103,232,249,0.8)',
                        textShadow: '0 0 30px rgba(34,211,238,0.4), 0 0 10px rgba(34,211,238,0.7)',
                    }}
                >
                    /// Initiate Uplink
                </p>

                <h2
                    className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-5"
                    style={{
                        color: '#ffffff',
                        textShadow: `
                            0 0 20px rgba(34,211,238,0.35),
                            0 0 45px rgba(34,211,238,0.18),
                            0 4px 30px rgba(0,0,0,0.6)
                        `,
                    }}
                >
                    Join the Orbit
                </h2>

                <p
                    className="text-sm sm:text-base font-normal max-w-xs mx-auto mb-8 leading-relaxed"
                    style={{
                        color: 'rgba(255,255,255,0.62)',
                        textShadow: '0 2px 20px rgba(0,0,0,0.8)',
                    }}
                >
                    Enter the stream. Become part of the eternal signal.
                </p>

                <button
                    className="pointer-events-auto px-10 py-4 text-sm font-bold tracking-widest uppercase rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
                    style={{
                        background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 50%, #6366f1 100%)',
                        color: '#ffffff',
                        boxShadow: `
                            0 0 30px rgba(56,189,248,0.35),
                            0 0 45px rgba(59,130,246,0.18),
                            0 4px 20px rgba(0,0,0,0.4),
                            inset 0 1px 0 rgba(255,255,255,0.2)
                        `,
                        border: '1px solid rgba(255,255,255,0.15)',
                    }}
                >
                    Transmit →
                </button>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                CROSSHAIR
            ═══════════════════════════════════════════════════════════════════ */}
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500 hidden sm:block"
                style={{
                    opacity: 0.16 * (1 - contactOpacity),
                }}
            >
                <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
                    <line x1="0" y1="21" x2="16" y2="21" stroke="white" strokeWidth="1" opacity="0.45" />
                    <line x1="26" y1="21" x2="42" y2="21" stroke="white" strokeWidth="1" opacity="0.45" />
                    <line x1="21" y1="0" x2="21" y2="16" stroke="white" strokeWidth="1" opacity="0.45" />
                    <line x1="21" y1="26" x2="21" y2="42" stroke="white" strokeWidth="1" opacity="0.45" />
                    <circle cx="21" cy="21" r="3.5" stroke="rgba(103,232,249,0.4)" strokeWidth="1" fill="none" />
                    <circle cx="21" cy="21" r="1" fill="rgba(103,232,249,0.35)" />
                </svg>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                NASA ATTRIBUTION
            ═══════════════════════════════════════════════════════════════════ */}
            <div
                className="absolute bottom-4 right-4 sm:bottom-5 sm:right-6"
                style={{ opacity: 0.48 }}
            >
                <p
                    className="text-[10px] sm:text-[11px] tracking-wide font-light"
                    style={{
                        color: 'rgba(255,255,255,0.7)',
                        textShadow: `
                            0 0 20px rgba(0,0,0,1),
                            0 0 40px rgba(0,0,0,1),
                            0 1px 2px rgba(0,0,0,1)
                        `,
                    }}
                >
                    Spacecraft: NASA/JHUAPL (Parker Solar Probe)
                </p>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                DEBUG MENU - Press ` to toggle - Quality Tier Control
            ═══════════════════════════════════════════════════════════════════ */}
            {showDebug && (
                <div
                    className="absolute top-4 right-4 pointer-events-auto"
                    style={{
                        background: 'rgba(0,0,0,0.9)',
                        backdropFilter: 'blur(12px)',
                        borderRadius: '12px',
                        padding: '16px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        minWidth: '240px',
                    }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold tracking-wider uppercase text-white/80">
                            Quality Tier
                        </p>
                        <button
                            onClick={() => setShowDebug(false)}
                            className="text-white/50 hover:text-white/90 transition-colors text-lg leading-none"
                        >
                            ×
                        </button>
                    </div>

                    {/* Current status - show EFFECTIVE tier (override takes priority) */}
                    <div className="mb-3 px-2 py-1.5 rounded bg-white/5 border border-white/10">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Active:</span>
                            <span className={`font-bold ${(tierOverride ?? currentTier) === 3 ? 'text-purple-400' : (tierOverride ?? currentTier) === 2 ? 'text-green-400' : (tierOverride ?? currentTier) === 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                                Tier {tierOverride ?? currentTier} ({TIER_LABELS[tierOverride ?? currentTier].name})
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-1">
                            <span className="text-white/50">Mode:</span>
                            <span className={tierOverride !== null ? 'text-orange-400' : 'text-cyan-400'}>
                                {tierOverride !== null ? 'Manual Override' : 'Auto'}
                            </span>
                        </div>
                    </div>

                    {/* Tier buttons */}
                    <div className="flex flex-col gap-2 mb-3">
                        {([3, 2, 1, 0] as const).map((tier) => {
                            const preset = TIER_LABELS[tier];
                            const isActive = tierOverride === tier;
                            const isCurrent = (tierOverride ?? currentTier) === tier;

                            return (
                                <button
                                    key={tier}
                                    onClick={() => setTierOverride(tier)}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left"
                                    style={{
                                        background: isActive
                                            ? 'rgba(255,165,0,0.2)'
                                            : isCurrent
                                                ? 'rgba(100,200,255,0.15)'
                                                : 'rgba(255,255,255,0.05)',
                                        border: isActive
                                            ? '1px solid rgba(255,165,0,0.5)'
                                            : isCurrent
                                                ? '1px solid rgba(100,200,255,0.3)'
                                                : '1px solid transparent',
                                    }}
                                >
                                    {/* Tier indicator */}
                                    <div
                                        className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 font-bold text-lg"
                                        style={{
                                            background: tier === 3 ? 'linear-gradient(135deg, #a855f7, #7c3aed)' :
                                                tier === 2 ? 'linear-gradient(135deg, #22c55e, #16a34a)' :
                                                    tier === 1 ? 'linear-gradient(135deg, #eab308, #ca8a04)' :
                                                        'linear-gradient(135deg, #ef4444, #b91c1c)',
                                            color: 'white',
                                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                        }}
                                    >
                                        {tier}
                                    </div>
                                    <div className="flex flex-col flex-1">
                                        <span className="text-white/90 text-sm font-medium">
                                            {preset.name}
                                        </span>
                                        <span className="text-white/40 text-[10px]">
                                            {preset.particles} particles · {preset.effects}
                                        </span>
                                    </div>
                                    {isActive && (
                                        <span className="text-[9px] text-orange-400 uppercase tracking-wider">
                                            Override
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* FSR Toggle */}
                    <button
                        onClick={() => {
                            setFsrEnabled(!fsrEnabled);
                        }}
                        className="w-full px-3 py-2 rounded-lg transition-all text-sm font-medium mb-2 flex items-center justify-between"
                        style={{
                            background: fsrEnabled
                                ? 'rgba(168,85,247,0.2)'
                                : 'rgba(255,255,255,0.05)',
                            border: fsrEnabled
                                ? '1px solid rgba(168,85,247,0.5)'
                                : '1px solid rgba(255,255,255,0.1)',
                            color: fsrEnabled ? '#a855f7' : 'rgba(255,255,255,0.6)',
                        }}
                    >
                        <span>🔍 FSR Sharpen</span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{
                            background: fsrEnabled ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.1)',
                        }}>
                            {fsrEnabled ? 'ON' : 'OFF'}
                        </span>
                    </button>

                    {/* Auto button */}
                    <button
                        onClick={() => setTierOverride(null)}
                        className="w-full px-3 py-2 rounded-lg transition-all text-sm font-medium"
                        style={{
                            background: tierOverride === null
                                ? 'rgba(34,211,238,0.2)'
                                : 'rgba(255,255,255,0.05)',
                            border: tierOverride === null
                                ? '1px solid rgba(34,211,238,0.5)'
                                : '1px solid rgba(255,255,255,0.1)',
                            color: tierOverride === null ? '#22d3ee' : 'rgba(255,255,255,0.6)',
                        }}
                    >
                        ⚡ Auto (Performance-based)
                    </button>

                    <p className="text-[10px] text-white/40 mt-3 text-center">
                        Press <kbd className="px-1 py-0.5 bg-white/10 rounded text-white/60">~</kbd> to close
                    </p>
                </div>
            )}
        </div>
    );
}
