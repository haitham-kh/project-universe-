"use client";

import { useEffect, useState } from "react";
import { AssetOrchestrator } from "../lib/AssetOrchestrator";

// ═══════════════════════════════════════════════════════════════════════════════
// UPLINK INDICATOR - Subtle pulsing indicator during background streaming
//
// Shows when assets are being streamed in the background.
// - subtle enough not to distract, but gives users confidence something is happening.
// ═══════════════════════════════════════════════════════════════════════════════

export function UplinkIndicator() {
    const [activePreloads, setActivePreloads] = useState<string[]>([]);
    const [vramPercent, setVramPercent] = useState(0);

    // Poll orchestrator state
    useEffect(() => {
        const interval = setInterval(() => {
            setActivePreloads(AssetOrchestrator.getActivePreloads());
            setVramPercent(AssetOrchestrator.getMemoryUsage().percent);
        }, 500);

        return () => clearInterval(interval);
    }, []);

    // Don't show if nothing is loading
    if (activePreloads.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 pointer-events-none">
            {/* Pulsing dot */}
            <div className="relative">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                <div className="absolute inset-0 w-2 h-2 bg-cyan-400 rounded-full animate-ping opacity-75" />
            </div>

            {/* Label */}
            <span className="text-xs font-mono text-cyan-400/60 uppercase tracking-wider">
                Uplink
            </span>

            {/* VRAM usage (only show if significant) */}
            {vramPercent > 30 && (
                <span className="text-xs font-mono text-white/30 ml-2">
                    {vramPercent}%
                </span>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STREAMING STATUS (optional debug display)
// ═══════════════════════════════════════════════════════════════════════════════

export function StreamingStatus() {
    const [activePreloads, setActivePreloads] = useState<string[]>([]);
    const [vram, setVram] = useState({ used: 0, budget: 0, percent: 0 });
    const [chapters, setChapters] = useState<Record<string, string>>({});

    useEffect(() => {
        const interval = setInterval(() => {
            setActivePreloads(AssetOrchestrator.getActivePreloads());
            setVram(AssetOrchestrator.getMemoryUsage());
            setChapters(AssetOrchestrator.getAllChapterStatuses());
        }, 250);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed top-12 right-4 z-50 bg-black/80 text-white p-3 rounded-lg font-mono text-xs">
            <div className="text-cyan-400 font-bold mb-2">Streaming Status</div>

            {/* VRAM Usage */}
            <div className="flex items-center gap-2 mb-2">
                <span className="text-white/50">VRAM:</span>
                <div className="w-20 h-2 bg-gray-700 rounded overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                        style={{ width: `${vram.percent}%` }}
                    />
                </div>
                <span className="text-white/50">{vram.percent}%</span>
            </div>

            {/* Chapters */}
            <div className="mb-2">
                <span className="text-white/50">Chapters:</span>
                <div className="flex gap-2 mt-1">
                    {Object.entries(chapters).map(([id, status]) => (
                        <span
                            key={id}
                            className={`px-1 rounded text-[10px] ${status === 'buffered' ? 'bg-green-500/30 text-green-400' :
                                status === 'streaming' ? 'bg-yellow-500/30 text-yellow-400' :
                                    status === 'evicted' ? 'bg-red-500/30 text-red-400' :
                                        'bg-gray-500/30 text-gray-400'
                                }`}
                        >
                            {id}
                        </span>
                    ))}
                </div>
            </div>

            {/* Active Preloads */}
            {activePreloads.length > 0 && (
                <div>
                    <span className="text-white/50">Loading:</span>
                    <div className="text-yellow-400 text-[10px] mt-1">
                        {activePreloads.slice(0, 3).join(', ')}
                        {activePreloads.length > 3 && ` +${activePreloads.length - 3}`}
                    </div>
                </div>
            )}
        </div>
    );
}
