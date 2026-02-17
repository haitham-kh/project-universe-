"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR GRADING CONFIG - Scene-consistent visual cohesion
// ═══════════════════════════════════════════════════════════════════════════════
//
// PURPOSE: Establish consistent visual language across all scenes.
// - Unified tonemapping (ACES Filmic baseline)
// - Scene-specific exposure adjustments
// - Consistent vignette and grain parameters
// - Easy-to-tweak centralized configuration
//
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// TONEMAPPING BASELINE
// ═══════════════════════════════════════════════════════════════════════════════

export const TONEMAPPING = {
    /** ACES Filmic provides cinematic look with good highlight rolloff */
    mode: 'ACES_FILMIC' as const,

    /** Base exposure multiplier (1.0 = neutral) */
    baseExposure: 1.0,

    /** Gamma correction (2.2 = sRGB standard) */
    gamma: 2.2,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE-SPECIFIC COLOR GRADES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SceneColorGrade {
    /** Scene identifier */
    id: string;

    /** Exposure adjustment relative to baseline */
    exposure: number;

    /** Saturation multiplier (1.0 = neutral) */
    saturation: number;

    /** Contrast adjustment (1.0 = neutral) */
    contrast: number;

    /** Vignette intensity */
    vignetteIntensity: number;

    /** Vignette falloff */
    vignetteOffset: number;

    /** Film grain intensity */
    grainIntensity: number;

    /** Color temperature shift (Kelvin offset, 0 = neutral) */
    temperatureShift: number;

    /** Tint shift (green-magenta, 0 = neutral) */
    tintShift: number;

    /** Shadow lift (adds light to shadows, 0-0.2 typical) */
    shadowLift: number;

    /** Highlight compression (0-1, higher = more compressed) */
    highlightCompression: number;
}

/** Scene 1: Hero/Intro - Clean, slightly cool, mysterious */
export const SCENE1_GRADE: SceneColorGrade = {
    id: 'scene1',
    exposure: 1.0,
    saturation: 0.95,
    contrast: 1.05,
    vignetteIntensity: 0.25,
    vignetteOffset: 0.15,
    grainIntensity: 0.006,
    temperatureShift: -200, // Slightly cooler
    tintShift: 0,
    shadowLift: 0.02,
    highlightCompression: 0.1,
};

/** Scene 2: Planets - Warm, golden, majestic */
export const SCENE2_GRADE: SceneColorGrade = {
    id: 'scene2',
    exposure: 1.05,
    saturation: 1.1,
    contrast: 1.08,
    vignetteIntensity: 0.35,
    vignetteOffset: 0.10,
    grainIntensity: 0.005,
    temperatureShift: 300, // Golden warmth
    tintShift: 5, // Slight magenta
    shadowLift: 0.03,
    highlightCompression: 0.15,
};

/** Scene 3: Neptune - Deep blue, cold, ethereal */
export const SCENE3_GRADE: SceneColorGrade = {
    id: 'scene3',
    exposure: 0.95,
    saturation: 1.0,
    contrast: 1.1,
    vignetteIntensity: 0.4,
    vignetteOffset: 0.08,
    grainIntensity: 0.007,
    temperatureShift: -400, // Cold blue
    tintShift: -5, // Slight green
    shadowLift: 0.01,
    highlightCompression: 0.2,
};

/** All scene grades indexed by ID */
export const SCENE_GRADES: Record<string, SceneColorGrade> = {
    scene1: SCENE1_GRADE,
    scene2: SCENE2_GRADE,
    scene3: SCENE3_GRADE,
};

// ═══════════════════════════════════════════════════════════════════════════════
// VIGNETTE PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

export const VIGNETTE_PRESETS = {
    /** Subtle - for clean scenes */
    subtle: { intensity: 0.25, offset: 0.15 },

    /** Medium - standard cinematic */
    medium: { intensity: 0.40, offset: 0.10 },

    /** Strong - dramatic focus */
    strong: { intensity: 0.55, offset: 0.08 },

    /** Oval - portrait style */
    oval: { intensity: 0.35, offset: 0.05 },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// GRAIN PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

export const GRAIN_PRESETS = {
    /** Film - visible but unobtrusive */
    film: { intensity: 0.012, shadowWeight: 1.5 },

    /** Subtle - barely visible */
    subtle: { intensity: 0.006, shadowWeight: 1.2 },

    /** Heavy - stylized/vintage */
    heavy: { intensity: 0.02, shadowWeight: 2.0 },

    /** Clean - minimal grain */
    clean: { intensity: 0.003, shadowWeight: 1.0 },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// BLOOM PRESETS (per-scene)
// ═══════════════════════════════════════════════════════════════════════════════

export const BLOOM_PRESETS = {
    /** Scene 1 - subtle, clean */
    scene1: {
        threshold: 0.88,
        intensity: 0.15,
        radius: 0.4,
    },

    /** Scene 2 - warm glow on Saturn rings */
    scene2: {
        threshold: 0.85,
        intensity: 0.22,
        radius: 0.45,
    },

    /** Scene 3 - ethereal Neptune glow */
    scene3: {
        threshold: 0.82,
        intensity: 0.18,
        radius: 0.5,
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Interpolate between scene grades
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Linearly interpolate between two scene color grades.
 * Useful for smooth scene transitions.
 */
export function lerpColorGrade(
    from: SceneColorGrade,
    to: SceneColorGrade,
    t: number
): SceneColorGrade {
    const lerp = (a: number, b: number) => a + (b - a) * t;

    return {
        id: t < 0.5 ? from.id : to.id,
        exposure: lerp(from.exposure, to.exposure),
        saturation: lerp(from.saturation, to.saturation),
        contrast: lerp(from.contrast, to.contrast),
        vignetteIntensity: lerp(from.vignetteIntensity, to.vignetteIntensity),
        vignetteOffset: lerp(from.vignetteOffset, to.vignetteOffset),
        grainIntensity: lerp(from.grainIntensity, to.grainIntensity),
        temperatureShift: lerp(from.temperatureShift, to.temperatureShift),
        tintShift: lerp(from.tintShift, to.tintShift),
        shadowLift: lerp(from.shadowLift, to.shadowLift),
        highlightCompression: lerp(from.highlightCompression, to.highlightCompression),
    };
}

/**
 * Get blended color grade based on scene opacities.
 * Handles multi-scene transitions smoothly.
 */
export function blendSceneGrades(
    sceneOpacities: Record<string, number>
): SceneColorGrade {
    // Start with default (scene1)
    let result = { ...SCENE1_GRADE };
    let totalWeight = 0;

    for (const [sceneId, opacity] of Object.entries(sceneOpacities)) {
        if (opacity > 0 && SCENE_GRADES[sceneId]) {
            const grade = SCENE_GRADES[sceneId];
            const weight = opacity;

            if (totalWeight === 0) {
                result = { ...grade };
                totalWeight = weight;
            } else {
                result = lerpColorGrade(result, grade, weight / (totalWeight + weight));
                totalWeight += weight;
            }
        }
    }

    return result;
}

