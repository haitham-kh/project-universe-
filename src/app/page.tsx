"use client";

import { LoadingScreen } from "@/components/LoadingScreen";
import { LandscapePrompt, LandscapeExitButton } from "@/components/LandscapePrompt";
import { ScrollWarning } from "@/components/ScrollGuardian";
import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useDirector } from "@/lib/useDirector"; // Used in PersistentHUD

// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC IMPORT - SSR disabled to prevent R3F serialization errors
// ═══════════════════════════════════════════════════════════════════════════════
const SceneClient = dynamic(() => import("./SceneClient"), {
  ssr: false,
  loading: () => null,
});

// ═══════════════════════════════════════════════════════════════════════════════
// PERSISTENT HUD - Rendered OUTSIDE of R3F ScrollControls
// Uses imperative DOM refs to avoid 60fps React re-renders
// ═══════════════════════════════════════════════════════════════════════════════
function PersistentHUD() {
  const fillRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let rafId: number;

    const update = () => {
      const t = Math.max(0, Math.min(1, useDirector.getState().globalT));
      const pct = Math.round(t * 100);

      if (textRef.current) textRef.current.textContent = `${pct}%`;
      if (fillRef.current) fillRef.current.style.height = `${Math.max(2, pct)}%`;

      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          VERTICAL PROGRESS BAR - Right edge, always visible
          Cinematic film-style: thin, subtle, glowing
      ═══════════════════════════════════════════════════════════════════ */}
      <div
        className="fixed z-[100] pointer-events-none"
        style={{
          right: '20px',
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      >
        <div className="flex flex-col items-center gap-3">
          {/* Progress percentage - minimal */}
          <span
            ref={textRef}
            className="text-[9px] font-mono tracking-widest"
            style={{
              color: 'rgba(255,255,255,0.4)',
              textShadow: '0 0 10px rgba(0,0,0,0.8)',
            }}
          >
            0%
          </span>

          {/* Track */}
          <div
            className="relative w-[2px] h-32 rounded-full overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.1)',
              boxShadow: 'inset 0 0 4px rgba(0,0,0,0.5)',
            }}
          >
            {/* Fill - grows from BOTTOM to TOP */}
            <div
              ref={fillRef}
              className="absolute bottom-0 left-0 w-full rounded-full"
              style={{
                height: '2%',
                background: 'linear-gradient(to top, rgba(56,189,248,0.9), rgba(14,165,233,0.7), rgba(59,130,246,0.5))',
                boxShadow: '0 0 8px rgba(56,189,248,0.6), 0 0 2px rgba(255,255,255,0.8)',
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME - Entry point with Loading → Landscape Gate → Experience flow
// ═══════════════════════════════════════════════════════════════════════════════

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLandscapeReady, setIsLandscapeReady] = useState(false);

  const handleLoadComplete = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleLandscapeReady = useCallback(() => {
    setIsLandscapeReady(true);
  }, []);

  // The full experience is only interactive after BOTH loading AND landscape are satisfied
  const isFullyReady = isLoaded && isLandscapeReady;

  return (
    <main className="w-full h-screen relative bg-black overflow-hidden">
      {/* Loading Screen Overlay - shown until loaded */}
      {!isLoaded && <LoadingScreen onComplete={handleLoadComplete} />}

      {/* LANDSCAPE PROMPT - shown AFTER loading, BEFORE experience is interactive */}
      {isLoaded && !isLandscapeReady && (
        <LandscapePrompt onReady={handleLandscapeReady} />
      )}

      {/* 3D Canvas - ALWAYS mounted immediately (dynamic import handles SSR) */}
      <div
        id="canvas-container"
        className="absolute inset-0 z-0"
      >
        <SceneClient enableIdlePreload={isFullyReady} />
      </div>

      {/* PERSISTENT HUD - Outside R3F, always visible */}
      {isFullyReady && <PersistentHUD />}

      {/* LANDSCAPE EXIT - Floating button to leave forced landscape on mobile */}
      {isFullyReady && <LandscapeExitButton />}

      {/* SCROLL WARNING - Frantic scroll popup overlay */}
      <ScrollWarning />
    </main>
  );
}
