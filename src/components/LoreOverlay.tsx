"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useLoreStore, LORE_THEMES, LORE_DATA, type LoreTarget } from "../lib/useLoreStore";

// ═══════════════════════════════════════════════════════════════════════════════
// LORE OVERLAY — Award-level cinematic dossier panel
//
// Cross-platform compatible version. All effects use standard CSS only.
// No SVG calc(), all clip-paths have -webkit- prefix, no per-char DOM reads.
// ═══════════════════════════════════════════════════════════════════════════════

const FILL: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
};

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZÆŌΣΔΩλγ0123456789!@#$%&*";

// ── Inject CSS keyframes once ──
let stylesInjected = false;
function injectStyles() {
    if (stylesInjected || typeof document === 'undefined') return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
        @keyframes lore-glitch-1 {
            0%, 100% { -webkit-clip-path: inset(0 0 95% 0); clip-path: inset(0 0 95% 0); transform: translate(-2px, 0); }
            20% { -webkit-clip-path: inset(15% 0 60% 0); clip-path: inset(15% 0 60% 0); transform: translate(3px, 0); }
            40% { -webkit-clip-path: inset(45% 0 30% 0); clip-path: inset(45% 0 30% 0); transform: translate(-1px, 0); }
            60% { -webkit-clip-path: inset(70% 0 10% 0); clip-path: inset(70% 0 10% 0); transform: translate(2px, 0); }
            80% { -webkit-clip-path: inset(5% 0 80% 0); clip-path: inset(5% 0 80% 0); transform: translate(-3px, 0); }
        }
        @keyframes lore-glitch-2 {
            0%, 100% { -webkit-clip-path: inset(90% 0 0 0); clip-path: inset(90% 0 0 0); transform: translate(2px, 0); }
            25% { -webkit-clip-path: inset(30% 0 40% 0); clip-path: inset(30% 0 40% 0); transform: translate(-3px, 0); }
            50% { -webkit-clip-path: inset(60% 0 20% 0); clip-path: inset(60% 0 20% 0); transform: translate(1px, 0); }
            75% { -webkit-clip-path: inset(10% 0 70% 0); clip-path: inset(10% 0 70% 0); transform: translate(-2px, 0); }
        }

        @keyframes lore-shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
        @keyframes lore-pulse-glow {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.6; }
        }
        @keyframes lore-data-flicker {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        @keyframes lore-scroll-bounce {
            0%, 100% { transform: translateY(0); opacity: 0.6; }
            50% { transform: translateY(6px); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEXT SCRAMBLE HOOK
// ═══════════════════════════════════════════════════════════════════════════════
function useTextScramble(text: string, active: boolean, delay: number = 0) {
    const [displayed, setDisplayed] = useState('');

    useEffect(() => {
        if (!active) { setDisplayed(''); return; }

        let cancelled = false;
        const chars = text.split('');
        const settled = new Array(chars.length).fill(false);
        let iteration = 0;

        const timeout = setTimeout(() => {
            const interval = setInterval(() => {
                if (cancelled) return;
                iteration++;
                const result = chars.map((char, i) => {
                    if (char === ' ') return ' ';
                    if (settled[i]) return char;
                    if (iteration > i * 2 + 4) { settled[i] = true; return char; }
                    return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
                });
                setDisplayed(result.join(''));
                if (settled.every(Boolean)) clearInterval(interval);
            }, 30);
            return () => clearInterval(interval);
        }, delay);

        return () => { cancelled = true; clearTimeout(timeout); };
    }, [text, active, delay]);

    return displayed || (active ? text.replace(/[^ ]/g, ' ') : '');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED COUNTER
// ═══════════════════════════════════════════════════════════════════════════════
function AnimatedValue({ value, active, delay }: { value: string; active: boolean; delay: number }) {
    const [displayed, setDisplayed] = useState(value);

    useEffect(() => {
        if (!active) { setDisplayed(value); return; }
        const match = value.match(/^([\d,.]+)(.*)/);
        if (!match) { setDisplayed(value); return; }

        const numStr = match[1].replace(/,/g, '');
        const suffix = match[2];
        const target = parseFloat(numStr);
        if (isNaN(target)) { setDisplayed(value); return; }

        let frame = 0;
        const totalFrames = 40;
        let cancelled = false;

        const timeout = setTimeout(() => {
            const interval = setInterval(() => {
                if (cancelled) return;
                frame++;
                const eased = 1 - Math.pow(1 - Math.min(frame / totalFrames, 1), 3);
                const current = target * eased;
                const formatted = current >= 1000
                    ? Math.round(current).toLocaleString()
                    : current % 1 === 0 ? Math.round(current).toString() : current.toFixed(1);
                setDisplayed(formatted + suffix);
                if (frame >= totalFrames) { clearInterval(interval); setDisplayed(value); }
            }, 25);
            return () => clearInterval(interval);
        }, delay);

        return () => { cancelled = true; clearTimeout(timeout); };
    }, [value, active, delay]);

    return <>{displayed}</>;
}



// ═══════════════════════════════════════════════════════════════════════════════
// PROXIMITY GLOW TEXT — Word-level glow based on cursor distance.
// Splits text into words (~20-30 per paragraph) instead of characters (~300).
// Direct DOM manipulation (no React re-renders). Runs at ~30fps.
// Uses only color + textShadow — 100% cross-browser.
// ═══════════════════════════════════════════════════════════════════════════════
function ProximityGlowText({ text, baseColor, glowColor, accentRgb }: {
    text: string; baseColor: string; glowColor: string; accentRgb: string;
}) {
    const containerRef = useRef<HTMLSpanElement>(null);
    const posRef = useRef({ x: -9999, y: -9999 });
    const rafRef = useRef<number>(0);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Disable on touch devices
        if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;

        const handleMove = (e: MouseEvent) => {
            posRef.current.x = e.clientX;
            posRef.current.y = e.clientY;
        };

        let frame = 0;
        const update = () => {
            frame++;
            // Run every 2nd frame (~30fps) for performance
            if (frame % 2 === 0) {
                const words = container.querySelectorAll<HTMLSpanElement>('[data-w]');
                const mx = posRef.current.x;
                const my = posRef.current.y;

                words.forEach((span) => {
                    const rect = span.getBoundingClientRect();
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;
                    const dist = Math.hypot(mx - cx, my - cy);
                    // Glow radius: 120px from word center
                    const glow = Math.max(0, 1 - dist / 120);

                    if (glow > 0.01) {
                        span.style.color = `rgba(${accentRgb}, ${(0.55 + glow * 0.4).toFixed(2)})`;
                        span.style.textShadow = `0 0 ${Math.round(8 + glow * 25)}px rgba(${accentRgb}, ${(glow * 0.5).toFixed(2)})`;
                    } else {
                        span.style.color = '';
                        span.style.textShadow = '';
                    }
                });
            }
            rafRef.current = requestAnimationFrame(update);
        };

        window.addEventListener('mousemove', handleMove);
        rafRef.current = requestAnimationFrame(update);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            cancelAnimationFrame(rafRef.current);
        };
    }, [text, accentRgb]);

    // Split into words, preserving whitespace
    const tokens = text.split(/(\s+)/);

    return (
        <span ref={containerRef} style={{ cursor: 'default' }}>
            {tokens.map((token, i) => {
                // Whitespace tokens — render as-is
                if (/^\s+$/.test(token)) return <span key={i}>{token}</span>;
                // Word tokens — trackable with data-w attribute
                return (
                    <span
                        key={i}
                        data-w=""
                        style={{ color: baseColor, transition: 'color 0.1s, text-shadow 0.1s' }}
                    >
                        {token}
                    </span>
                );
            })}
        </span>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCROLL INDICATOR ARROW
// ═══════════════════════════════════════════════════════════════════════════════
function ScrollIndicator({ color, visible }: { color: string; visible: boolean }) {
    if (!visible) return null;
    return (
        <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            animation: 'lore-scroll-bounce 2s ease-in-out infinite',
            pointerEvents: 'none',
            zIndex: 10,
        }}>
            <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '7px',
                letterSpacing: '0.2em',
                color,
                opacity: 0.5,
                textTransform: 'uppercase',
            }}>
                SCROLL
            </span>
            {/* Chevron arrow */}
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                <path d="M1 1L8 8L15 1" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
            </svg>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN OVERLAY
// ═══════════════════════════════════════════════════════════════════════════════
export function LoreOverlay() {
    const { mode, target, clickPos, closeLore } = useLoreStore();
    const [phase, setPhase] = useState<'hidden' | 'glitch' | 'reveal' | 'visible' | 'exiting'>('hidden');
    const [scanProgress, setScanProgress] = useState(0);
    const [visibleLines, setVisibleLines] = useState(0);
    const [canScroll, setCanScroll] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Smoothed parallax values (lerped)
    const parallaxRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
    const rafRef = useRef<number>(0);

    useEffect(() => { injectStyles(); }, []);

    // ── Phase state machine ──
    useEffect(() => {
        if (mode === 'focusing') {
            setPhase('glitch');
            setScanProgress(0);
            setVisibleLines(0);
            const t1 = setTimeout(() => setPhase('reveal'), 300);
            return () => clearTimeout(t1);
        }
        if (mode === 'open') {
            if (phase === 'glitch' || phase === 'reveal') {
                setPhase('reveal');
                let progress = 0;
                const interval = setInterval(() => {
                    progress += 0.03;
                    setScanProgress(Math.min(progress, 1));
                    if (progress >= 1) { clearInterval(interval); setPhase('visible'); }
                }, 16);
                return () => clearInterval(interval);
            }
        }
        if (mode === 'closing') {
            setPhase('exiting');
            const t = setTimeout(() => setPhase('hidden'), 500);
            return () => clearTimeout(t);
        }
        if (mode === 'idle') {
            setPhase('hidden');
        }
    }, [mode]);

    // ── Scanline text reveal ──
    useEffect(() => {
        if (phase === 'visible' && target) {
            setVisibleLines(0);
            const data = LORE_DATA[target];
            const totalItems = 1 + 1 + data.body.length + (data.facts?.length || 0);
            let line = 0;
            const interval = setInterval(() => {
                line++;
                setVisibleLines(line);
                if (line >= totalItems) clearInterval(interval);
            }, 60);
            return () => clearInterval(interval);
        }
    }, [phase, target]);

    // ── Damped parallax (lerp instead of snapping) ──
    useEffect(() => {
        if (phase !== 'visible' && phase !== 'reveal') return;

        // Disable on touch devices
        if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;

        const handleMouseMove = (e: MouseEvent) => {
            parallaxRef.current.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
            parallaxRef.current.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
        };

        const animate = () => {
            const p = parallaxRef.current;
            // Smooth lerp factor — 0.04 for heavy damping
            p.x += (p.targetX - p.x) * 0.04;
            p.y += (p.targetY - p.y) * 0.04;

            if (contentRef.current) {
                contentRef.current.style.transform = `translate(${p.x * 6}px, ${p.y * 4}px)`;
            }
            rafRef.current = requestAnimationFrame(animate);
        };

        window.addEventListener('mousemove', handleMouseMove);
        rafRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(rafRef.current);
        };
    }, [phase]);

    // ── Check if panel is scrollable ──
    useEffect(() => {
        if (phase !== 'visible') { setCanScroll(false); return; }
        const check = () => {
            const el = panelRef.current;
            if (el) {
                setCanScroll(el.scrollHeight > el.clientHeight + 20);
            }
        };
        check();
        const timer = setTimeout(check, 800); // re-check after text reveals
        return () => clearTimeout(timer);
    }, [phase, visibleLines]);

    // ── Hide scroll arrow when user scrolls ──
    useEffect(() => {
        const el = panelRef.current;
        if (!el || !canScroll) return;
        const handleScroll = () => {
            if (el.scrollTop > 30) setCanScroll(false);
        };
        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => el.removeEventListener('scroll', handleScroll);
    }, [canScroll, phase]);

    // ── ESC ──
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape' && (mode === 'open' || mode === 'focusing')) closeLore();
    }, [mode, closeLore]);
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    if (phase === 'hidden' || !target) return null;

    const theme = LORE_THEMES[target as Exclude<LoreTarget, null>];
    const data = LORE_DATA[target as Exclude<LoreTarget, null>];
    if (!theme || !data) return null;

    const cx = clickPos.x * 100;
    const cy = clickPos.y * 100;
    const isGlitch = phase === 'glitch';
    const isRevealing = phase === 'reveal';
    const isVisible = phase === 'visible';
    const isExiting = phase === 'exiting';

    // Build clip-path value for scanline reveal (with -webkit- prefix)
    const scanClip = isRevealing
        ? `inset(0 0 ${Math.max(0, (1 - scanProgress) * 100)}% 0)`
        : isVisible ? 'none' : isExiting ? 'none' : 'inset(0 0 100% 0)';

    return (
        <div style={{
            ...FILL, zIndex: 100,
            opacity: isExiting ? 0 : 1,
            transition: isExiting ? 'opacity 0.4s ease-in' : 'opacity 0.15s ease-out',
            pointerEvents: mode === 'open' ? 'auto' : 'none',
        }}>
            {/* ── Background ── */}
            <div style={{
                ...FILL,
                background: `linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd})`,
                opacity: isGlitch ? 0.5 : 1,
                transition: 'opacity 0.3s',
            }} onClick={closeLore} />

            {/* ── Shimmer ── */}
            <div style={{
                ...FILL, pointerEvents: 'none',
                background: `linear-gradient(90deg, transparent 30%, rgba(${theme.accentRgb}, 0.03) 50%, transparent 70%)`,
                backgroundSize: '200% 100%',
                animation: 'lore-shimmer 4s linear infinite',
                opacity: isVisible ? 1 : 0, transition: 'opacity 0.5s',
            }} />

            {/* ── Radial glow ── */}
            <div style={{
                ...FILL, pointerEvents: 'none',
                background: `radial-gradient(circle at ${cx}% ${cy}%, ${theme.glowColor} 0%, transparent 50%)`,
                opacity: isGlitch ? 1.5 : isRevealing ? 0.8 : 0.5,
                transition: 'opacity 0.5s',
            }} />

            {/* ── Glitch layers ── */}
            {isGlitch && (
                <>
                    <div style={{ ...FILL, pointerEvents: 'none', background: `rgba(${theme.accentRgb}, 0.15)`, animation: 'lore-glitch-1 0.15s steps(5) infinite' }} />
                    <div style={{ ...FILL, pointerEvents: 'none', background: `rgba(${theme.accentRgb}, 0.1)`, animation: 'lore-glitch-2 0.12s steps(4) infinite' }} />
                    <div style={{ ...FILL, pointerEvents: 'none', background: 'white', opacity: 0.15 }} />
                </>
            )}

            {/* ── Scanline sweep ── */}
            {(isRevealing || isGlitch) && (
                <div style={{ ...FILL, pointerEvents: 'none', overflow: 'hidden', zIndex: 2 }}>
                    <div style={{
                        position: 'absolute', left: 0, right: 0, height: '2px',
                        top: `${scanProgress * 100}%`,
                        background: `linear-gradient(90deg, transparent 5%, ${theme.accentColor} 30%, ${theme.accentColor} 70%, transparent 95%)`,
                        boxShadow: `0 0 20px 4px ${theme.glowColor}, 0 0 60px 10px ${theme.glowColor}`,
                        opacity: isRevealing ? 0.9 : 0,
                    }} />
                </div>
            )}

            {/* ── CRT scanlines ── */}
            <div style={{
                ...FILL, pointerEvents: 'none',
                backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)`,
                opacity: 0.5, zIndex: 3,
            }} />

            {/* ── Film grain ── */}
            <div style={{
                ...FILL, pointerEvents: 'none', opacity: 0.04, zIndex: 4,
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
                backgroundSize: "128px 128px",
            }} />

            {/* ── Content with damped parallax ── */}
            <div style={{
                ...FILL,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '5vh 5vw', zIndex: 5,
                // Both prefixed and unprefixed clip-path for Safari
                WebkitClipPath: scanClip,
                clipPath: scanClip,
            }}>
                <div
                    ref={contentRef}
                    style={{
                        maxWidth: '700px', width: '100%',
                        position: 'relative',
                        willChange: 'transform',
                    }}
                >
                    <div
                        ref={panelRef}
                        style={{
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            padding: '48px',
                            position: 'relative',
                            // Solid fallback background for browsers without backdrop-filter
                            background: 'rgba(8, 12, 24, 0.85)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderRadius: '6px',
                            border: `1px solid rgba(${theme.accentRgb}, ${(isVisible || isRevealing) ? 0.35 : 0.1})`,
                            // Glowing border via box-shadow — works everywhere, unaffected by overflow
                            boxShadow: (isVisible || isRevealing)
                                ? `0 0 0 1px rgba(${theme.accentRgb}, 0.2), 0 0 20px 0 rgba(${theme.accentRgb}, 0.15), 0 0 60px 0 rgba(${theme.accentRgb}, 0.06), inset 0 0 30px 0 rgba(${theme.accentRgb}, 0.04)`
                                : 'none',
                            opacity: isGlitch ? 0 : 1,
                            transform: isExiting ? 'scale(0.97)' : 'scale(1)',
                            transition: 'opacity 0.3s, transform 0.4s ease-in, box-shadow 1.2s ease-out, border-color 1.2s ease-out',
                        }}
                    >

                        {/* ── Close button ── */}
                        <button
                            onClick={(e) => { e.stopPropagation(); closeLore(); }}
                            style={{
                                position: 'absolute', top: '16px', right: '16px',
                                background: 'none',
                                border: `1px solid rgba(${theme.accentRgb}, 0.3)`,
                                color: theme.accentColor,
                                width: '48px', height: '48px', // Touch-friendly
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', fontSize: '16px',
                                fontFamily: "'JetBrains Mono', monospace",
                                opacity: 0.5,
                                transition: 'opacity 0.2s, border-color 0.2s, box-shadow 0.2s',
                                borderRadius: '2px', zIndex: 10,
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = '1';
                                e.currentTarget.style.borderColor = theme.accentColor;
                                e.currentTarget.style.boxShadow = `0 0 12px rgba(${theme.accentRgb}, 0.3)`;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = '0.5';
                                e.currentTarget.style.borderColor = `rgba(${theme.accentRgb}, 0.3)`;
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            ✕
                        </button>

                        {/* ── Classification tag ── */}
                        <div style={{
                            opacity: visibleLines >= 1 ? 0.4 : 0,
                            transition: 'opacity 0.3s',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '8px', letterSpacing: '0.4em',
                            color: theme.accentColor,
                            marginBottom: '8px', textTransform: 'uppercase',
                        }}>
                            ◆ CLASSIFIED DOSSIER ◆
                        </div>

                        {/* ── Title with scramble ── */}
                        <div style={{ opacity: visibleLines >= 1 ? 1 : 0, transition: 'opacity 0.3s' }}>
                            <h2 style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: '32px', fontWeight: 700,
                                letterSpacing: '0.35em',
                                color: theme.accentColor,
                                margin: '0 0 6px 0', textTransform: 'uppercase',
                                textShadow: `0 0 30px rgba(${theme.accentRgb}, 0.4)`,
                            }}>
                                <ScrambleText text={data.title} active={visibleLines >= 1} />
                            </h2>
                        </div>

                        {/* ── Subtitle ── */}
                        <div style={{
                            opacity: visibleLines >= 2 ? 1 : 0,
                            transform: visibleLines >= 2 ? 'translateY(0)' : 'translateY(4px)',
                            transition: 'opacity 0.4s, transform 0.4s',
                        }}>
                            <p style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: '10px', letterSpacing: '0.3em',
                                color: `rgba(${theme.accentRgb}, 0.45)`,
                                marginBottom: '28px', textTransform: 'uppercase',
                            }}>
                                {data.subtitle}
                            </p>
                            <div style={{
                                width: '80px', height: '1px',
                                background: `linear-gradient(90deg, ${theme.accentColor}, rgba(${theme.accentRgb}, 0.2), transparent)`,
                                marginBottom: '24px',
                                animation: isVisible ? 'lore-pulse-glow 3s ease-in-out infinite' : 'none',
                            }} />
                        </div>

                        {/* ── Body with proximity glow ── */}
                        {data.body.map((paragraph, i) => (
                            <div key={i} style={{
                                opacity: visibleLines >= 3 + i ? 1 : 0,
                                transform: visibleLines >= 3 + i ? 'translateY(0)' : 'translateY(6px)',
                                transition: 'opacity 0.5s ease-out, transform 0.5s ease-out',
                            }}>
                                <p style={{
                                    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
                                    fontSize: '14px', lineHeight: 1.8,
                                    marginBottom: '18px', fontWeight: 300,
                                    letterSpacing: '0.01em',
                                }}>
                                    <ProximityGlowText
                                        text={paragraph}
                                        baseColor="rgba(255, 255, 255, 0.55)"
                                        glowColor={theme.accentColor}
                                        accentRgb={theme.accentRgb}
                                    />
                                </p>
                            </div>
                        ))}

                        {/* ── Facts grid ── */}
                        {data.facts && (
                            <div style={{
                                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '16px', marginTop: '64px',
                            }}>
                                {data.facts.map((fact, i) => {
                                    const isFactVisible = visibleLines >= 3 + data.body.length + i;
                                    return (
                                        <div key={i} style={{
                                            opacity: isFactVisible ? 1 : 0,
                                            transform: isFactVisible ? 'translateY(0)' : 'translateY(6px)',
                                            transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
                                            padding: '12px',
                                            background: `rgba(${theme.accentRgb}, 0.03)`,
                                            borderRadius: '3px',
                                        }}>
                                            <div style={{
                                                fontFamily: "'JetBrains Mono', monospace",
                                                fontSize: '8px', letterSpacing: '0.25em',
                                                color: `rgba(${theme.accentRgb}, 0.4)`,
                                                marginBottom: '4px', textTransform: 'uppercase',
                                            }}>
                                                {fact.label}
                                            </div>
                                            <div style={{
                                                fontFamily: "'JetBrains Mono', monospace",
                                                fontSize: '18px', fontWeight: 600,
                                                color: theme.accentColor,
                                                textShadow: `0 0 15px rgba(${theme.accentRgb}, 0.3)`,
                                            }}>
                                                <AnimatedValue value={fact.value} active={isFactVisible} delay={i * 100} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}


                        {/* ── Credit / Source ── */}
                        {data.credit && (
                            <div style={{
                                marginTop: '32px',
                                display: 'flex', justifyContent: 'center',
                                opacity: isVisible ? 1 : 0,
                                transform: isVisible ? 'translateY(0)' : 'translateY(4px)',
                                transition: 'opacity 0.5s ease-out 0.2s, transform 0.5s ease-out 0.2s',
                            }}>
                                <a
                                    href={data.credit.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        fontFamily: "'JetBrains Mono', monospace",
                                        fontSize: '9px', letterSpacing: '0.1em',
                                        color: `rgba(${theme.accentRgb}, 0.6)`,
                                        textDecoration: 'none',
                                        border: `1px solid rgba(${theme.accentRgb}, 0.2)`,
                                        padding: '8px 12px',
                                        borderRadius: '2px',
                                        background: `rgba(${theme.accentRgb}, 0.05)`,
                                        transition: 'all 0.2s',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        textTransform: 'uppercase',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = theme.accentColor;
                                        e.currentTarget.style.color = theme.accentColor;
                                        e.currentTarget.style.background = `rgba(${theme.accentRgb}, 0.1)`;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = `rgba(${theme.accentRgb}, 0.2)`;
                                        e.currentTarget.style.color = `rgba(${theme.accentRgb}, 0.6)`;
                                        e.currentTarget.style.background = `rgba(${theme.accentRgb}, 0.05)`;
                                    }}
                                >
                                    <span>3D MODEL CREDITS: {data.credit.text}</span>
                                    <span style={{ fontSize: '10px' }}>↗</span>
                                </a>
                            </div>
                        )}

                        {/* ── Bottom status bar ── */}
                        <div style={{
                            marginTop: '28px', paddingTop: '16px',
                            borderTop: `1px solid rgba(${theme.accentRgb}, 0.06)`,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            opacity: isVisible ? 0.3 : 0, transition: 'opacity 0.6s',
                        }}>
                            <span style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: '8px', letterSpacing: '0.2em',
                                color: theme.accentColor, textTransform: 'uppercase',
                            }}>
                                FROST PROTOCOL // {target?.toUpperCase()} DOSSIER
                            </span>
                            <span style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: '8px', color: `rgba(${theme.accentRgb}, 0.5)`,
                                animation: 'lore-data-flicker 2s ease-in-out infinite',
                            }}>
                                ● LIVE FEED
                            </span>
                        </div>

                        {/* ── Scroll indicator ── */}
                        <ScrollIndicator
                            color={theme.accentColor}
                            visible={canScroll}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function ScrambleText({ text, active }: { text: string; active: boolean }) {
    const scrambled = useTextScramble(text, active, 100);
    return <>{scrambled}</>;
}
