"use client";

import { useEffect } from "react";
import { useAudioStore } from "../lib/useAudioStore";

export function AudioToggle() {
    const { isMuted, isUnlocked, toggleMute, initialize } = useAudioStore();

    useEffect(() => {
        initialize();
    }, [initialize]);

    // Simple interaction to unlock audio if user clicks anywhere on the document
    useEffect(() => {
        const handleInteraction = () => {
            if (!isUnlocked) {
                toggleMute();
            }
            // Remove event listeners once unlocked
            document.removeEventListener("click", handleInteraction);
            document.removeEventListener("keydown", handleInteraction);
        };

        if (!isUnlocked) {
            document.addEventListener("click", handleInteraction);
            document.addEventListener("keydown", handleInteraction);
        }

        return () => {
            document.removeEventListener("click", handleInteraction);
            document.removeEventListener("keydown", handleInteraction);
        };
    }, [isUnlocked, toggleMute]);

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                toggleMute();
            }}
            style={{
                position: "fixed",
                bottom: "20px",
                left: "20px",
                zIndex: 9999,
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "rgba(10, 10, 15, 0.65)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                outline: "none",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: isMuted 
                    ? "0 4px 12px rgba(0, 0, 0, 0.4)" 
                    : "0 4px 16px rgba(100, 181, 246, 0.25)",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.08)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
                if (!isMuted) {
                    e.currentTarget.style.boxShadow = "0 4px 20px rgba(100, 181, 246, 0.4)";
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.boxShadow = isMuted 
                    ? "0 4px 12px rgba(0, 0, 0, 0.4)" 
                    : "0 4px 16px rgba(100, 181, 246, 0.25)";
            }}
            title={isMuted ? "Unmute Audio" : "Mute Audio"}
        >
            <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "16px" }}>
                {/* Visualizer bars */}
                <div
                    style={{
                        width: "3px",
                        height: "100%",
                        background: isMuted ? "#888888" : "#64B5F6",
                        borderRadius: "2px",
                        transition: "all 0.3s ease",
                        animation: isMuted ? "none" : "audioWave 0.8s ease-in-out infinite alternate",
                    }}
                />
                <div
                    style={{
                        width: "3px",
                        height: "100%",
                        background: isMuted ? "#888888" : "#64B5F6",
                        borderRadius: "2px",
                        transition: "all 0.3s ease",
                        animation: isMuted ? "none" : "audioWave 0.5s ease-in-out infinite alternate 0.15s",
                    }}
                />
                <div
                    style={{
                        width: "3px",
                        height: "100%",
                        background: isMuted ? "#888888" : "#64B5F6",
                        borderRadius: "2px",
                        transition: "all 0.3s ease",
                        animation: isMuted ? "none" : "audioWave 0.9s ease-in-out infinite alternate 0.3s",
                    }}
                />
                <div
                    style={{
                        width: "3px",
                        height: "100%",
                        background: isMuted ? "#888888" : "#64B5F6",
                        borderRadius: "2px",
                        transition: "all 0.3s ease",
                        animation: isMuted ? "none" : "audioWave 0.6s ease-in-out infinite alternate 0.05s",
                    }}
                />
            </div>

            {/* Injected style for audio wave visualizer animations */}
            <style jsx global>{`
                @keyframes audioWave {
                    0% {
                        height: 4px;
                    }
                    100% {
                        height: 16px;
                    }
                }
            `}</style>
        </button>
    );
}
