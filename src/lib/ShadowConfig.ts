"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// SHADOW CONFIG - Tier-based shadow optimization
// ═══════════════════════════════════════════════════════════════════════════════
//
// PERFORMANCE IMPACT:
// - Shadow maps are expensive (1024x1024 = 4MB VRAM per light)
// - Shadow rendering requires an extra draw call per shadow-casting object
// - Lower tiers should use smaller shadow maps or disable shadows entirely
//
// STRATEGY:
// - Tier 0: No shadows (mobile battery savings)
// - Tier 1: Small shadow maps (512x512), hero only
// - Tier 2: Medium shadow maps (1024x1024), key meshes
// - Tier 3: Large shadow maps (2048x2048), full quality
//
// ═══════════════════════════════════════════════════════════════════════════════

export interface ShadowConfig {
    enabled: boolean;
    mapSize: number;
    bias: number;
    normalBias: number;
    radius: number;
    castShadow: boolean;
    receiveShadow: boolean;
}

// Tier-based shadow configurations
export const SHADOW_CONFIGS: Record<0 | 1 | 2 | 3, ShadowConfig> = {
    0: {
        // TIER 0: No shadows (mobile)
        enabled: false,
        mapSize: 256,
        bias: -0.0005,
        normalBias: 0.02,
        radius: 1,
        castShadow: false,
        receiveShadow: false,
    },
    1: {
        // TIER 1: Minimal shadows (low-end)
        enabled: true,
        mapSize: 512,
        bias: -0.0003,
        normalBias: 0.02,
        radius: 1.5,
        castShadow: true,
        receiveShadow: true,
    },
    2: {
        // TIER 2: Standard shadows (mid-range)
        enabled: true,
        mapSize: 1024,
        bias: -0.0002,
        normalBias: 0.015,
        radius: 2,
        castShadow: true,
        receiveShadow: true,
    },
    3: {
        // TIER 3: High-quality shadows (high-end)
        enabled: true,
        mapSize: 2048,
        bias: -0.0001,
        normalBias: 0.01,
        radius: 3,
        castShadow: true,
        receiveShadow: true,
    },
};

/**
 * Get shadow configuration for a given tier.
 */
export function getShadowConfig(tier: 0 | 1 | 2 | 3): ShadowConfig {
    return SHADOW_CONFIGS[tier];
}

/**
 * Check if object should cast shadows at the given tier.
 * Use for mesh.castShadow property.
 * 
 * @param tier - Current performance tier
 * @param isHero - Whether this is a hero/important mesh
 */
export function shouldCastShadow(tier: 0 | 1 | 2 | 3, isHero: boolean = false): boolean {
    if (tier === 0) return false;
    if (tier === 1) return isHero; // Only hero meshes on low tier
    return true; // Tier 2+ all meshes
}

/**
 * Check if object should receive shadows at the given tier.
 */
export function shouldReceiveShadow(tier: 0 | 1 | 2 | 3): boolean {
    return SHADOW_CONFIGS[tier].receiveShadow;
}

/**
 * Apply shadow settings to a THREE.DirectionalLight shadow.
 * 
 * Usage:
 * ```tsx
 * const config = getShadowConfig(tier);
 * applyShadowConfig(directionalLight, config);
 * ```
 */
export function applyShadowConfig(
    light: { shadow: { mapSize: { width: number; height: number }; bias: number; normalBias: number; radius: number } },
    config: ShadowConfig
): void {
    if (!config.enabled) return;

    light.shadow.mapSize.width = config.mapSize;
    light.shadow.mapSize.height = config.mapSize;
    light.shadow.bias = config.bias;
    light.shadow.normalBias = config.normalBias;
    light.shadow.radius = config.radius;
}

/**
 * Utility to traverse a scene and disable shadows on all meshes.
 * Useful for quick tier-0 optimization.
 */
export function disableAllShadows(object: {
    traverse: (callback: (child: any) => void) => void
}): void {
    object.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
        }
    });
}

/**
 * Enable shadows only on hero meshes (by name pattern).
 */
export function enableHeroShadowsOnly(
    object: { traverse: (callback: (child: any) => void) => void },
    heroPattern: RegExp = /hero|ship|player/i
): void {
    object.traverse((child) => {
        if (child.isMesh) {
            const isHero = heroPattern.test(child.name);
            child.castShadow = isHero;
            child.receiveShadow = true;
        }
    });
}
