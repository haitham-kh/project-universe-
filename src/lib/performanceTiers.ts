// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE TIERS — Single Source of Truth
// All tier-related constants and types live here.
// ═══════════════════════════════════════════════════════════════════════════════

/** Rendering / particle parameters used by R3F components. */
export interface PerformanceTier {
    tier: 0 | 1 | 2 | 3;
    dpr: number;
    particleMultiplier: number;
    sparkleCount: number;
    ashCount: number;
}

export type TierKey = 0 | 1 | 2 | 3;

/**
 * Core rendering parameters per tier.
 * Used by usePerformanceTier, Experience, Effects, etc.
 */
export const TIERS: Record<TierKey, PerformanceTier> = {
    0: { tier: 0, dpr: 1, particleMultiplier: 0.3, sparkleCount: 200, ashCount: 80 },
    1: { tier: 1, dpr: 1.35, particleMultiplier: 0.6, sparkleCount: 200, ashCount: 150 },
    2: { tier: 2, dpr: 1.5, particleMultiplier: 1.0, sparkleCount: 200, ashCount: 250 },
    3: { tier: 3, dpr: 2.0, particleMultiplier: 1.5, sparkleCount: 400, ashCount: 500 },
};

/**
 * Engine-level parameters per tier (MSAA, star count, etc.).
 * Used by sceneConfig, scene pipeline setup, etc.
 */
export const ENGINE_TIERS = {
    0: { dpr: 1.0, msaa: 0, particles: 0.3, stars: 3000 },
    1: { dpr: 1.35, msaa: 2, particles: 0.6, stars: 4500 },
    2: { dpr: 1.5, msaa: 4, particles: 1.0, stars: 6000 },
    3: { dpr: 2.0, msaa: 8, particles: 1.5, stars: 10000 },
} as const;

/** Display metadata for tier selection UI in Overlay. */
export const TIER_LABELS: Record<TierKey, { name: string; particles: string; effects: string; description: string }> = {
    0: { name: "Low", particles: "30%", effects: "Minimal", description: "Best for older devices" },
    1: { name: "Medium", particles: "60%", effects: "Balanced", description: "Balanced performance" },
    2: { name: "High", particles: "100%", effects: "SMAA + Bloom", description: "Premium quality" },
    3: { name: "OVERKILL", particles: "150%", effects: "ULTRA everything", description: "5070ti+ Required" },
};
