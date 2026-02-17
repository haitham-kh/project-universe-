"use client";

import * as THREE from "three";

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE CONFIGURATION
// Single source of truth for all scene constants
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Chapter Definitions - Cosmic Narrative
// ─────────────────────────────────────────────────────────────────────────────
export interface ChapterDef {
    id: 'hero' | 'approach' | 'warp' | 'transition' | 'scene2' | 'trans2' | 'scene3';
    name: string;          // Display name
    subtitle: string;      // Subtitle for UI
    range: [number, number]; // [start, end] as globalT 0..1
    ui: {
        heroOpacity: number;     // Title opacity
        scrollCueOpacity: number; // Scroll indicator opacity
        contactOpacity: number;   // CTA opacity
    };
}

export const CHAPTERS: ChapterDef[] = [
    {
        id: 'hero',
        name: 'Earth Orbit',
        subtitle: 'Establish Position',
        range: [0.00, 0.10],
        ui: { heroOpacity: 1, scrollCueOpacity: 1, contactOpacity: 0 },
    },
    {
        id: 'approach',
        name: 'Lunar Drift',
        subtitle: 'Approach Vector',
        range: [0.10, 0.23],
        ui: { heroOpacity: 0, scrollCueOpacity: 0.3, contactOpacity: 0 },
    },
    {
        id: 'warp',
        name: 'Jovian Storm',
        subtitle: 'Warp Sequence',
        range: [0.23, 0.31],
        ui: { heroOpacity: 0, scrollCueOpacity: 0, contactOpacity: 0 },
    },
    {
        id: 'transition',
        name: 'Descent',
        subtitle: 'Entering Atmosphere',
        range: [0.31, 0.36],
        ui: { heroOpacity: 0, scrollCueOpacity: 0, contactOpacity: 0 },
    },
    {
        id: 'scene2',
        name: 'New World',
        subtitle: 'Surface Exploration',
        range: [0.36, 0.60],
        ui: { heroOpacity: 0, scrollCueOpacity: 0.5, contactOpacity: 0 },
    },
    {
        id: 'trans2',
        name: 'Ring Transit',
        subtitle: 'Deep Space Jump',
        range: [0.60, 0.70],
        ui: { heroOpacity: 0, scrollCueOpacity: 0, contactOpacity: 0 },
    },
    {
        id: 'scene3',
        name: 'Neptune Outpost',
        subtitle: 'Final Approach',
        range: [0.70, 1.00],
        ui: { heroOpacity: 0, scrollCueOpacity: 0.5, contactOpacity: 1 },
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Camera Configuration
// ─────────────────────────────────────────────────────────────────────────────
export const CAMERA = {
    // FOV per chapter
    fov: {
        hero: 87,
        approach: 65,
        warp: 95,
        scene2: 75,
        scene3: 60,
    },
    // Base positions (modified by timeline)
    position: {
        hero: new THREE.Vector3(0, 0.3, 15.5),
        // Approach: Move to side and ZOOM OUT to show scale
        approach: new THREE.Vector3(4.0, 0.5, 24.0),
        warp: new THREE.Vector3(2.0, 0.5, 10),
    },
    // LookAt targets
    lookAt: {
        hero: new THREE.Vector3(-2.0, 0, -18), // Look slightly right of ship (ship is at -5.5)
        approach: new THREE.Vector3(-2.0, 0, -15), // Interpolated between hero and warp targets
        warp: new THREE.Vector3(-2.0, 0, -12),
    },
    // Motion parameters
    parallax: { x: 0.75, y: 0.45 },
    smoothing: { position: 3.5, lookAt: 2.5, fov: 2.5 }, // Lower = "Heavier"/Smoother feel
    shake: { base: 0.012, warpMultiplier: 1.5 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Earth/Background Configuration
// ─────────────────────────────────────────────────────────────────────────────
export const EARTH = {
    scale: 110,
    rotation: new THREE.Euler(
        THREE.MathUtils.degToRad(-8),
        THREE.MathUtils.degToRad(155),
        THREE.MathUtils.degToRad(2)
    ),
    offset: new THREE.Vector3(48, -60, -180),
    atmosphere: {
        innerScale: 1.02,
        outerScale: 1.08,
        innerPower: 5.0,
        outerPower: 2.5,
        innerIntensity: 1.2,
        outerIntensity: 0.45,
        colorInner: "#5ac8ff",
        colorOuter: "#3a9aff",
        sunDir: new THREE.Vector3(0.45, 0.6, 0.65).normalize(),
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Ship Configuration
// ─────────────────────────────────────────────────────────────────────────────
export const SHIP = {
    baseScale: 76.40,
    position: {
        base: new THREE.Vector3(-54.55, -0.08, -15.78),
        warpOffset: new THREE.Vector3(0, 0, 5),
    },
    rotation: new THREE.Euler(-6.122, 0.828, 6.283),
    material: {
        envMapIntensity: 1.8,
        metalness: 0.85,
        roughness: 0.22,
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Effects Configuration
// ─────────────────────────────────────────────────────────────────────────────
export const EFFECTS = {
    bloom: {
        highlight: { threshold: 0.92, intensity: 0.18, radius: 0.25 },
        atmosphere: { threshold: 0.70, intensity: 0.10, radius: 0.85 },
    },
    dof: {
        focusDistance: 0.015,
        focalLength: 0.018,
        bokehScale: 1.5,
    },
    fog: {
        color: "#0a0a12",
        density: 0.0012,
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Performance Tiers — re-exported from single source of truth
// ─────────────────────────────────────────────────────────────────────────────
export { ENGINE_TIERS as TIERS } from "./performanceTiers";

// ─────────────────────────────────────────────────────────────────────────────
// Lighting Configuration
// ─────────────────────────────────────────────────────────────────────────────
export const LIGHTING = {
    ambient: { color: "#1a1a2e", intensity: 0.15 },
    key: { color: "#ffffff", intensity: 1.2, position: new THREE.Vector3(5, 3, 8) },
    fill: { color: "#2a3a5a", intensity: 0.4, position: new THREE.Vector3(-5, 0, 4) },
    rim: { color: "#4080ff", intensity: 0.6, position: new THREE.Vector3(0, 2, -8) },
    earthBounce: { color: "#64c8ff", intensityTier2: 0.25, intensityTier1: 0.16 },
};

// Scene 2 specific lighting (ground scene)
export const SCENE2_LIGHTING = {
    ambient: { color: "#3a3a4e", intensity: 0.35 },
    sun: { color: "#ffcc88", intensity: 1.5, position: new THREE.Vector3(20, 30, -50) },
    fill: { color: "#6080aa", intensity: 0.3, position: new THREE.Vector3(-10, 5, 10) },
    ground: { color: "#8a7a6a", intensity: 0.2 },
};

// Scene 3 specific lighting (moon scene)
export const SCENE3_LIGHTING = {
    ambient: { color: "#0a0a10", intensity: 0.1 },
    sun: { color: "#ffffff", intensity: 2.0, position: new THREE.Vector3(10, 20, 10) },
    fill: { color: "#1a1a2a", intensity: 0.2, position: new THREE.Vector3(-10, 5, 10) },
};

// Scene 2 camera config
export const SCENE2_CAMERA = {
    position: {
        start: new THREE.Vector3(0, 15, 10),
        // Compacted Arc for Slower Perceived Speed
        skateStart: new THREE.Vector3(90, -10, -25),
        skateRight: new THREE.Vector3(50, -12, 10),
        skateMid: new THREE.Vector3(-15, -15, 35),
        skateLeft: new THREE.Vector3(-80, -25, 0),
        skateEnd: new THREE.Vector3(-72, 12, -23),
    },
    lookAt: {
        start: new THREE.Vector3(0, 0, -30),
        skateStart: new THREE.Vector3(-15, -32, -79),
        skateMid: new THREE.Vector3(-15, -32, -79),
        skateEnd: new THREE.Vector3(-162, -117, -187),
    },
    fov: { start: 75, end: 55 },
};

// Scene 3 camera config - Neptune orbit path (orbits around Neptune at -123, -4, -15)
export const SCENE3_CAMERA = {
    position: {
        // Start close to Neptune so FOV ramp is dramatic
        start: new THREE.Vector3(-100, 5, 5),         // Close, centered on Neptune
        end: new THREE.Vector3(-103, 3, 0),            // Barely drifts
    },
    lookAt: {
        start: new THREE.Vector3(-123, -4, -15),
        end: new THREE.Vector3(-123, -4, -15),
    },
    fov: { start: 123, end: 220 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Scroll Configuration
// ─────────────────────────────────────────────────────────────────────────────
export const SCROLL = {
    pages: 25, // Reduced: Scene 1=9pg, Scene 2=7.5pg, Scene 3=8.5pg
    damping: 0.22, // Maximum butter
    velocitySmoothing: 8, // Ultra-smooth inertia
    velocityClamp: 1.5,
};
