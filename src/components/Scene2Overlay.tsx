"use client";

import { useEffect, useRef } from "react";
import { useDirector } from "../lib/useDirector";

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE 2 OVERLAY - EXACT MATCH of Scene 1 style, with golden gradient
// ═══════════════════════════════════════════════════════════════════════════════

// Golden gradient (same structure as Scene 1's UNIVERSE_GRADIENT)
const UNIVERSE_GRADIENT = [
    { offset: "0%", color: "#4a3000" },
    { offset: "12%", color: "#7a5810" },
    { offset: "25%", color: "#b8860b" },
    { offset: "40%", color: "#daa520" },
    { offset: "58%", color: "#f0c93c" },
    { offset: "78%", color: "#ffd84a" },
    { offset: "92%", color: "#ffe066" },
    { offset: "100%", color: "#fff4b0" },
];

const SHINE_INTENSITY = 0.95;
const SHINE_WIDTH = 12;

export function Scene2Overlay() {
    const logoRef = useRef<SVGSVGElement>(null);
    const shineRef = useRef<SVGLinearGradientElement>(null);
    const initialMouseXRef = useRef(useDirector.getState().mouseX);
    const opacity = useDirector(state => state.sceneOpacity.scene2Opacity);

    // ═══════════════════════════════════════════════════════════════════════════
    // REF-BASED SHINE UPDATE - ALL HOOKS BEFORE EARLY RETURN
    // ═══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (opacity < 0.1) return;

        let lastMouseX = 0;
        const unsubscribe = useDirector.subscribe((state) => {
            if (Math.abs(state.mouseX - lastMouseX) < 0.005) return;
            lastMouseX = state.mouseX;
            if (!shineRef.current) return;

            const shinePosition = (state.mouseX + 1) * 50;
            const stops = shineRef.current.querySelectorAll('stop');
            if (stops.length >= 7) {
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
        });
        return unsubscribe;
    }, [opacity]);

    // EARLY RETURN AFTER ALL HOOKS
    if (opacity < 0.1) return null;

    // Initial shine position
    const shinePosition = (initialMouseXRef.current + 1) * 50;

    return (
        <div
            className="fixed inset-0 pointer-events-none select-none overflow-hidden"
            style={{ opacity, transition: 'opacity 0.3s ease-out' }}
        >
            {/* ═══════════════════════════════════════════════════════════════════
                HERO SECTION - EXACT SAME as Scene 1
            ═══════════════════════════════════════════════════════════════════ */}
            <div
                className="absolute transition-all duration-700 ease-out"
                style={{
                    left: 'clamp(32px, 5vw, 80px)',
                    top: 'clamp(48px, 8vh, 100px)',
                }}
            >
                <div className="flex flex-col gap-2">
                    {/* PROJECT label - same as Scene 1 but golden dot */}
                    <div className="flex items-center gap-2">
                        <div
                            className="w-0.5 h-0.5 rounded-full"
                            style={{
                                background: 'rgba(255,215,0,0.5)',
                                boxShadow: '0 0 4px rgba(255,215,0,0.5)',
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

                    {/* UNIVERSE - EXACT SAME SVG structure as Scene 1 */}
                    <svg
                        ref={logoRef}
                        viewBox="0 0 420 65"
                        className="w-[280px] sm:w-[360px] md:w-[420px] h-auto"
                        style={{
                            overflow: 'visible',
                            filter: `
                                drop-shadow(0 0 1px rgba(255,255,255,0.5))
                                drop-shadow(0 0 5px rgba(255,200,50,0.35))
                                drop-shadow(0 0 16px rgba(255,180,0,0.2))
                                drop-shadow(0 2px 12px rgba(0,0,0,0.6))
                            `,
                        }}
                    >
                        <defs>
                            {/* Base gradient - golden */}
                            <linearGradient id="scene2UniverseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                {UNIVERSE_GRADIENT.map((stop, i) => (
                                    <stop key={i} offset={stop.offset} stopColor={stop.color} />
                                ))}
                            </linearGradient>

                            {/* Shine gradient */}
                            <linearGradient ref={shineRef} id="scene2ShineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset={`${Math.max(0, shinePosition - SHINE_WIDTH)}%`} stopColor="transparent" />
                                <stop offset={`${Math.max(0, shinePosition - SHINE_WIDTH * 0.4)}%`} stopColor={`rgba(255,255,255,${SHINE_INTENSITY * 0.26})`} />
                                <stop offset={`${Math.max(0, shinePosition - SHINE_WIDTH * 0.16)}%`} stopColor={`rgba(255,255,255,${SHINE_INTENSITY * 0.63})`} />
                                <stop offset={`${shinePosition}%`} stopColor={`rgba(255,255,255,${SHINE_INTENSITY})`} />
                                <stop offset={`${Math.min(100, shinePosition + SHINE_WIDTH * 0.16)}%`} stopColor={`rgba(255,255,255,${SHINE_INTENSITY * 0.63})`} />
                                <stop offset={`${Math.min(100, shinePosition + SHINE_WIDTH * 0.4)}%`} stopColor={`rgba(255,255,255,${SHINE_INTENSITY * 0.26})`} />
                                <stop offset={`${Math.min(100, shinePosition + SHINE_WIDTH)}%`} stopColor="transparent" />
                            </linearGradient>

                            {/* ClipPath */}
                            <clipPath id="scene2UniverseClip">
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

                        {/* Base gradient text */}
                        <text
                            x="0"
                            y="52"
                            fontSize="62"
                            fontWeight="500"
                            fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                            letterSpacing="0.03em"
                            fill="url(#scene2UniverseGradient)"
                        >
                            UNIVERSE
                        </text>

                        {/* Shine layer */}
                        <rect
                            x="0"
                            y="0"
                            width="420"
                            height="65"
                            fill="url(#scene2ShineGradient)"
                            clipPath="url(#scene2UniverseClip)"
                            style={{ mixBlendMode: 'overlay' }}
                        />
                    </svg>

                    {/* Tagline - same as Scene 1 but golden accent */}
                    <div className="flex items-start gap-3 mt-0.5">
                        <div
                            className="w-[1px] h-9 rounded-full mt-0.5"
                            style={{
                                background: 'linear-gradient(to bottom, rgba(255,200,50,0.5), rgba(255,180,0,0.12), transparent)',
                                boxShadow: '0 0 3px rgba(255,200,50,0.2)',
                            }}
                        />
                        <div className="flex flex-col gap-0.5">
                            <p
                                className="text-[12px] sm:text-[13px] font-light"
                                style={{
                                    color: 'rgba(255,255,255,0.65)',
                                    textShadow: '0 0 20px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.6)',
                                }}
                            >
                                Exploring the Cosmos
                            </p>
                            <p
                                className="text-[10px] sm:text-[11px] font-light"
                                style={{
                                    color: 'rgba(255,255,255,0.4)',
                                    textShadow: '0 0 15px rgba(0,0,0,0.6)',
                                }}
                            >
                                Scene 2 • Saturn
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
