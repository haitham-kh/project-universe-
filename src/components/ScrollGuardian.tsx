"use client";

import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// SCROLL GUARDIAN - Anti-frantic-scroll with 3-strike escalation
// ═══════════════════════════════════════════════════════════════════════════════

export const scrollGuardian = {
    strikes: 0,
    showWarning: false,
    warningMessage: "",
    warningSubtext: "",
    isPunished: false,
    _listeners: new Set<() => void>(),

    addStrike() {
        // Once punished, no more strikes — punishment is permanent
        if (this.isPunished) return;

        this.strikes++;
        if (this.strikes === 1) {
            this.warningMessage = "Slow down, Captain";
            this.warningSubtext = "The cosmos isn't going anywhere";
        } else if (this.strikes === 2) {
            this.warningMessage = "Seriously... take it easy";
            this.warningSubtext = "One more and you'll regret it";
        } else if (this.strikes >= 3) {
            this.warningMessage = "You asked for it.";
            this.warningSubtext = "Scroll privileges revoked — reload to restore";
            this.isPunished = true;
        }
        this.showWarning = true;
        this._notify();

        setTimeout(() => {
            this.showWarning = false;
            this._notify();
        }, this.isPunished ? 5000 : 2800);
    },

    subscribe(fn: () => void) {
        this._listeners.add(fn);
        return () => { this._listeners.delete(fn); };
    },

    _notify() {
        this._listeners.forEach(fn => fn());
    },
};

// ── Detection tuning ─────────────────────────────────────────────────────────
export const SCROLL_GUARD_CONFIG = {
    SPIKE_THRESHOLD: 0.008,
    SPIKE_WINDOW: 30,
    SPIKE_COUNT: 6,
    COOLDOWN_MS: 5000,
};

// ── ScrollWarning UI ─────────────────────────────────────────────────────────

export function ScrollWarning() {
    const [visible, setVisible] = useState(false);
    const [message, setMessage] = useState("");
    const [subtext, setSubtext] = useState("");
    const [strikeCount, setStrikeCount] = useState(0);
    const [leaving, setLeaving] = useState(false);

    useEffect(() => {
        return scrollGuardian.subscribe(() => {
            if (scrollGuardian.showWarning) {
                setLeaving(false);
                setVisible(true);
            } else {
                // Trigger exit animation, then hide
                setLeaving(true);
                setTimeout(() => setVisible(false), 500);
            }
            setMessage(scrollGuardian.warningMessage);
            setSubtext(scrollGuardian.warningSubtext);
            setStrikeCount(scrollGuardian.strikes);
        });
    }, []);

    if (!visible) return null;

    const isPunished = strikeCount >= 3;
    const isSecond = strikeCount === 2;

    // Color theme per strike level
    const accentColor = isPunished ? "#ef4444" : isSecond ? "#f59e0b" : "#22d3ee";
    const glowColor = isPunished
        ? "rgba(239,68,68,0.25)"
        : isSecond
            ? "rgba(245,158,11,0.2)"
            : "rgba(34,211,238,0.15)";

    return (
        <div
            className="fixed inset-0 z-[998] flex items-center justify-center pointer-events-none"
            style={{
                opacity: leaving ? 0 : 1,
                transition: "opacity 0.5s ease-out",
            }}
        >
            <style>{`
                @keyframes warningSlideIn {
                    0%   { opacity: 0; transform: translateY(20px) scale(0.92); }
                    60%  { opacity: 1; transform: translateY(-4px) scale(1.02); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes warningShake {
                    0%, 100% { transform: translateX(0); }
                    15% { transform: translateX(-6px); }
                    30% { transform: translateX(5px); }
                    45% { transform: translateX(-4px); }
                    60% { transform: translateX(3px); }
                    75% { transform: translateX(-1px); }
                }
                @keyframes lockPulse {
                    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 6px ${accentColor}); }
                    50%      { transform: scale(1.15); filter: drop-shadow(0 0 16px ${accentColor}); }
                }
                @keyframes borderGlow {
                    0%, 100% { border-color: ${accentColor}40; box-shadow: 0 0 20px ${glowColor}; }
                    50%      { border-color: ${accentColor}80; box-shadow: 0 0 40px ${glowColor}, 0 0 80px ${glowColor}; }
                }
                @keyframes strikeFill {
                    from { transform: scale(0); opacity: 0; }
                    to   { transform: scale(1); opacity: 1; }
                }
                .warning-card {
                    animation: warningSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards,
                               borderGlow 2s ease-in-out infinite 0.5s;
                }
                .warning-shake {
                    animation: warningShake 0.5s ease-in-out;
                }
                .lock-pulse {
                    animation: lockPulse 1.5s ease-in-out infinite;
                }
                .strike-dot {
                    animation: strikeFill 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
            `}</style>

            <div
                className={`warning-card ${isSecond || isPunished ? 'warning-shake' : ''} px-8 py-7 rounded-2xl text-center max-w-[300px]`}
                style={{
                    background: "rgba(6, 6, 18, 0.82)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: `1px solid ${accentColor}40`,
                    boxShadow: `0 0 30px ${glowColor}, 0 16px 48px rgba(0,0,0,0.6)`,
                }}
            >
                {/* Strike dots */}
                <div className="flex items-center justify-center gap-2 mb-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="relative w-3 h-3">
                            {/* Track */}
                            <div
                                className="absolute inset-0 rounded-full"
                                style={{
                                    background: "rgba(255,255,255,0.08)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                }}
                            />
                            {/* Active fill */}
                            {i <= strikeCount && (
                                <div
                                    className="absolute inset-0 rounded-full strike-dot"
                                    style={{
                                        background: `radial-gradient(circle, ${accentColor}, ${accentColor}88)`,
                                        boxShadow: `0 0 10px ${accentColor}88`,
                                        animationDelay: `${(i - 1) * 0.1}s`,
                                    }}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Icon */}
                <div className="mb-3 flex justify-center">
                    {isPunished ? (
                        <div className="lock-pulse">
                            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                <circle cx="12" cy="16" r="1" fill={accentColor} />
                            </svg>
                        </div>
                    ) : isSecond ? (
                        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    ) : (
                        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    )}
                </div>

                {/* Message */}
                <h3
                    className="text-[15px] font-bold tracking-[0.12em] uppercase mb-2"
                    style={{ color: accentColor }}
                >
                    {message}
                </h3>

                {/* Subtext */}
                <p className="text-white/35 font-mono text-[9px] tracking-[0.08em] uppercase leading-[1.7]">
                    {subtext}
                </p>

                {/* Punishment bar */}
                {isPunished && (
                    <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(239,68,68,0.15)" }}>
                        <p className="text-[8px] font-mono tracking-[0.1em] uppercase" style={{ color: "rgba(239,68,68,0.5)" }}>
                            ↻ Reload page to restore scrolling
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
