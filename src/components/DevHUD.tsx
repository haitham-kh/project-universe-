"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { useDirector } from "../lib/useDirector";

// ═══════════════════════════════════════════════════════════════════════════════
// DEV PERFORMANCE HUD - FIXED TIMING
// 
// Records frame times from useFrame delta (ACTUAL GPU frame times)
// Updates display at 500ms intervals but samples EVERY frame
// Toggle with 'H' key (dev only)
// ═══════════════════════════════════════════════════════════════════════════════

// Frame time buffer (shared between component and useFrame)
const frameTimeBuffer: number[] = [];
const MAX_SAMPLES = 120; // 2 seconds at 60fps

export function DevHUD() {
    const [visible, setVisible] = useState(false);
    const [stats, setStats] = useState({
        tier: 2 as number,
        p95: 0,
        spikeRatio: 0,
        dpr: 1,
        fps: 0,
    });

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

    // Collect ACTUAL frame times from R3F's useFrame delta
    useFrame((_, delta) => {
        if (!visible) return;

        // delta is in seconds, convert to ms
        const frameTimeMs = delta * 1000;

        frameTimeBuffer.push(frameTimeMs);
        if (frameTimeBuffer.length > MAX_SAMPLES) {
            frameTimeBuffer.shift();
        }
    });

    // Update display stats every 500ms (not every frame!)
    useEffect(() => {
        if (!visible) return;

        const interval = setInterval(() => {
            if (frameTimeBuffer.length < 10) return;

            const sorted = [...frameTimeBuffer].sort((a, b) => a - b);
            const p95 = sorted[Math.floor(sorted.length * 0.95)] || 16;
            const spikeRatio = frameTimeBuffer.filter((t) => t > 22).length / frameTimeBuffer.length;
            const avgFrameTime = frameTimeBuffer.reduce((a, b) => a + b, 0) / frameTimeBuffer.length;
            const fps = 1000 / avgFrameTime;

            setStats({
                tier: useDirector.getState().tier,
                p95: Math.round(p95 * 10) / 10,
                spikeRatio: Math.round(spikeRatio * 100),
                dpr: Math.round(window.devicePixelRatio * 100) / 100,
                fps: Math.round(fps),
            });
        }, 500);

        return () => clearInterval(interval);
    }, [visible]);

    // Only render in development
    if (process.env.NODE_ENV !== "development") return null;
    if (!visible) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: 12,
                right: 12,
                background: "rgba(0, 0, 0, 0.85)",
                color: "#0f0",
                fontFamily: "monospace",
                fontSize: 11,
                padding: "8px 12px",
                borderRadius: 6,
                zIndex: 99999,
                pointerEvents: "none",
                lineHeight: 1.5,
                border: "1px solid rgba(0, 255, 0, 0.3)",
            }}
        >
            <div>Tier: <span style={{ color: stats.tier === 3 ? "#a855f7" : stats.tier === 2 ? "#0f0" : stats.tier === 1 ? "#ff0" : "#f00" }}>{stats.tier}</span></div>
            <div>FPS: <span style={{ color: stats.fps >= 55 ? "#0f0" : stats.fps >= 45 ? "#ff0" : "#f00" }}>{stats.fps}</span></div>
            <div>P95: <span style={{ color: stats.p95 < 18 ? "#0f0" : stats.p95 < 24 ? "#ff0" : "#f00" }}>{stats.p95}ms</span></div>
            <div>Spikes: <span style={{ color: stats.spikeRatio < 5 ? "#0f0" : stats.spikeRatio < 12 ? "#ff0" : "#f00" }}>{stats.spikeRatio}%</span></div>
            <div>DPR: {stats.dpr}</div>
            <div style={{ marginTop: 4, color: "#666", fontSize: 9 }}>Press H to hide</div>
        </div>
    );
}
