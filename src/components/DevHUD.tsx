"use client";

import { useEffect, useState } from "react";
import { useDirector, ChapterId } from "../lib/useDirector";

// ═══════════════════════════════════════════════════════════════════════════════
// DEV PERFORMANCE HUD - Interactive Menu
// 
// Toggle with 'H' key (dev only)
// ═══════════════════════════════════════════════════════════════════════════════

export function DevHUD() {
    const [visible, setVisible] = useState(true);

    const chapterId = useDirector(state => state.chapterId);
    const tierOverride = useDirector(state => state.tierOverride);
    const smaaEnabled = useDirector(state => state.smaaEnabled);
    const fsrEnabled = useDirector(state => state.fsrEnabled);
    const setTierOverride = useDirector(state => state.setTierOverride);
    const setSmaaEnabled = useDirector(state => state.setSmaaEnabled);
    const setFsrEnabled = useDirector(state => state.setFsrEnabled);

    // Toggle with H key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === "h" && !e.ctrlKey && !e.metaKey) {
                setVisible((v) => !v);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    if (!visible) return null;

    // Format chapter name
    const formatChapter = (id: ChapterId) => {
        if (!id) return "Unknown Scene";
        return id.charAt(0).toUpperCase() + id.slice(1);
    };

    return (
        <div
            style={{
                position: "fixed",
                top: 24,
                right: 24,
                background: "rgba(15, 20, 35, 0.25)", // More glassy/transparent
                backdropFilter: "blur(16px) saturate(200%)",
                WebkitBackdropFilter: "blur(16px) saturate(200%)",
                boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.1)",
                color: "#e2e8f0",
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontSize: 12,
                fontWeight: 500,
                padding: "16px",
                borderRadius: 16,
                zIndex: 99999,
                pointerEvents: "auto",
                lineHeight: 1.6,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                minWidth: "180px",
            }}
        >
            {/* Header / Scene Indicator */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "rgba(255, 255, 255, 0.5)" }}>
                    Current Scene
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80" }} />
                    {formatChapter(chapterId)}
                </div>
            </div>

            <hr style={{ borderColor: 'rgba(255, 255, 255, 0.1)', margin: '2px 0', borderTop: 'none' }} />

            {/* Controls Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label htmlFor="tier-override" style={{ cursor: 'pointer', color: "rgba(255, 255, 255, 0.8)" }}>Tier Override:</label>
                    <select
                        id="tier-override"
                        value={tierOverride === null ? 'auto' : tierOverride}
                        onChange={(e) => {
                            const val = e.target.value;
                            setTierOverride(val === 'auto' ? null : parseInt(val) as 0 | 1 | 2 | 3);
                        }}
                        style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            color: '#fff',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            outline: 'none',
                            transition: "all 0.2s"
                        }}
                    >
                        <option value="auto">Auto</option>
                        <option value="0">0 (Low)</option>
                        <option value="1">1 (Med)</option>
                        <option value="2">2 (High)</option>
                        <option value="3">3 (Ultra)</option>
                    </select>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', color: "rgba(255, 255, 255, 0.8)" }}>
                    <input
                        type="checkbox"
                        checked={smaaEnabled}
                        onChange={(e) => setSmaaEnabled(e.target.checked)}
                        style={{ accentColor: '#3b82f6', width: '14px', height: '14px', cursor: 'pointer' }}
                    />
                    SMAA (Anti-Aliasing)
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', color: "rgba(255, 255, 255, 0.8)" }}>
                    <input
                        type="checkbox"
                        checked={fsrEnabled}
                        onChange={(e) => setFsrEnabled(e.target.checked)}
                        style={{ accentColor: '#3b82f6', width: '14px', height: '14px', cursor: 'pointer' }}
                    />
                    FSR (Sharpening)
                </label>
            </div>

            <div
                onClick={() => setVisible(false)}
                style={{ marginTop: 4, color: "rgba(255, 255, 255, 0.3)", fontSize: 9, textAlign: "center", fontStyle: "italic", cursor: "pointer" }}
            >
                Press H or tap here to close
            </div>
        </div>
    );
}
