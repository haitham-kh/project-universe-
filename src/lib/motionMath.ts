"use client";

import * as THREE from "three";

// ═══════════════════════════════════════════════════════════════════════════════
// MOTION MATH UTILITIES
// Unified easing, damping, and interpolation for cinematic motion
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Basic Math
// ─────────────────────────────────────────────────────────────────────────────
export const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
export const clamp01 = (x: number) => clamp(x, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const remap = (value: number, inMin: number, inMax: number, outMin: number, outMax: number) =>
    outMin + (outMax - outMin) * clamp01((value - inMin) / (inMax - inMin));
export const invLerp = (a: number, b: number, v: number) => clamp01((v - a) / (b - a));

// ─────────────────────────────────────────────────────────────────────────────
// Smoothstep Variants
// ─────────────────────────────────────────────────────────────────────────────
export const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
};

export const smootherstep = (edge0: number, edge1: number, x: number) => {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * t * (t * (t * 6 - 15) + 10);
};

// ─────────────────────────────────────────────────────────────────────────────
// Easing Functions
// ─────────────────────────────────────────────────────────────────────────────
export const easeInQuad = (t: number) => t * t;
export const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
export const easeInOutQuad = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const easeInCubic = (t: number) => t * t * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeInQuint = (t: number) => t * t * t * t * t;
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
export const easeInOutQuint = (t: number) => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;

export const easeOutExpo = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
export const easeInExpo = (t: number) => t === 0 ? 0 : Math.pow(2, 10 * t - 10);
export const easeInOutExpo = (t: number) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;

export const easeOutBack = (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// ─────────────────────────────────────────────────────────────────────────────
// Damping (frame-rate independent)
// ─────────────────────────────────────────────────────────────────────────────
export const damp = (current: number, target: number, lambda: number, dt: number) =>
    THREE.MathUtils.damp(current, target, lambda, dt);

export const dampVec3 = (current: THREE.Vector3, target: THREE.Vector3, lambda: number, dt: number) => {
    current.x = damp(current.x, target.x, lambda, dt);
    current.y = damp(current.y, target.y, lambda, dt);
    current.z = damp(current.z, target.z, lambda, dt);
    return current;
};

export const lerpVec3 = (current: THREE.Vector3, target: THREE.Vector3, alpha: number) => {
    current.lerp(target, alpha);
    return current;
};

// ─────────────────────────────────────────────────────────────────────────────
// Angle Helpers
// ─────────────────────────────────────────────────────────────────────────────
export const lerpAngle = (a: number, b: number, t: number) => {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
};

export const dampAngle = (current: number, target: number, lambda: number, dt: number) => {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return current + diff * (1 - Math.exp(-lambda * dt));
};

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Helpers
// ─────────────────────────────────────────────────────────────────────────────
export const getChapterProgress = (
    globalT: number,
    chapterStart: number,
    chapterEnd: number
): number => {
    if (globalT < chapterStart) return 0;
    if (globalT > chapterEnd) return 1;
    return (globalT - chapterStart) / (chapterEnd - chapterStart);
};

export const isInChapter = (globalT: number, chapterStart: number, chapterEnd: number): boolean =>
    globalT >= chapterStart && globalT <= chapterEnd;
