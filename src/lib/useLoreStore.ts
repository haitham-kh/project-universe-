"use client";

import { create } from "zustand";

// ═══════════════════════════════════════════════════════════════════════════════
// LORE STORE — State management for the click-to-open lore dossier
//
// Modes: idle → focusing → open → closing → idle
// While lore is open, scroll input should be frozen.
// ═══════════════════════════════════════════════════════════════════════════════

export type LoreTarget = 'neptune' | 'parker' | 'saturn' | null;
export type LoreMode = 'idle' | 'focusing' | 'open' | 'closing';

// Scene-aware theming
export interface LoreTheme {
    accentColor: string;
    accentRgb: string;       // for rgba usage
    gradientStart: string;
    gradientEnd: string;
    glowColor: string;
}

export const LORE_THEMES: Record<Exclude<LoreTarget, null>, LoreTheme> = {
    neptune: {
        accentColor: '#64B5F6',
        accentRgb: '100, 181, 246',
        gradientStart: 'rgba(10, 30, 80, 0.95)',
        gradientEnd: 'rgba(5, 15, 40, 0.98)',
        glowColor: 'rgba(100, 181, 246, 0.3)',
    },
    saturn: {
        accentColor: '#FFB74D',
        accentRgb: '255, 183, 77',
        gradientStart: 'rgba(60, 40, 10, 0.95)',
        gradientEnd: 'rgba(30, 20, 5, 0.98)',
        glowColor: 'rgba(255, 183, 77, 0.3)',
    },
    parker: {
        accentColor: '#A8C8E8',
        accentRgb: '168, 200, 232',
        gradientStart: 'rgba(12, 22, 40, 0.95)',
        gradientEnd: 'rgba(6, 12, 22, 0.98)',
        glowColor: 'rgba(168, 200, 232, 0.3)',
    },
};

// Lore content per object
// Lore content per object
export interface LoreContent {
    title: string;
    subtitle: string;
    body: string[];
    facts?: { label: string; value: string }[];
    credit?: {
        text: string;
        url: string;
    };
}

export const LORE_DATA: Record<Exclude<LoreTarget, null>, LoreContent> = {
    neptune: {
        title: 'NEPTUNE',
        subtitle: 'ICE GIANT — SOL VIII',
        body: [
            'The eighth planet from the Sun, Neptune is a frozen world of supersonic winds and diamond rain. Its deep blue atmosphere is laced with methane clouds moving at speeds exceeding 2,000 km/h.',
            'Voyager 2 remains the only spacecraft to have visited Neptune, revealing a dynamic world far more turbulent than expected. The Great Dark Spot, a storm the size of Earth, was captured in its flyby.',
            'Within the Frost Protocol, Neptune serves as the final waypoint — a sentinel at the edge of the solar system, marking the boundary between known space and the interstellar void.',
        ],
        facts: [
            { label: 'DISTANCE', value: '4.5B km' },
            { label: 'DIAMETER', value: '49,528 km' },
            { label: 'ORBITAL PERIOD', value: '165 years' },
            { label: 'WIND SPEED', value: '2,100 km/h' },
        ],
    },
    saturn: {
        title: 'SATURN',
        subtitle: 'RING SYSTEM — SOL VI',
        body: [
            'Saturn\'s iconic ring system spans 282,000 km — wider than the distance from Earth to the Moon. Composed of billions of ice and rock particles, each ring orbits at its own speed.',
            'The Cassini mission revealed geysers on Enceladus, hexagonal storms at the poles, and a ring structure far more complex than anticipated. Saturn\'s gravitational ballet choreographs moons and moonlets in intricate orbital resonances.',
            'The Frost Protocol utilizes Saturn\'s gravitational well as a slingshot maneuver, threading through the ring plane to acquire the velocity needed for the outer system approach.',
        ],
        facts: [
            { label: 'RING SPAN', value: '282,000 km' },
            { label: 'MOONS', value: '146 known' },
            { label: 'DENSITY', value: '< Water' },
            { label: 'WIND SPEED', value: '1,800 km/h' },
        ],
    },
    parker: {
        title: 'PARKER PROBE',
        subtitle: 'SOLAR SENTINEL — FROST-1',
        body: [
            'The Parker Solar Probe is humanity\'s closest approach to a star, diving through the Sun\'s corona at speeds exceeding 690,000 km/h. Its carbon-composite heat shield withstands temperatures of 1,370°C.',
            'Named after astrophysicist Eugene Parker, the probe studies solar wind acceleration and coronal heating — mysteries that have persisted since the 1950s. Each perihelion brings new data about the magnetic topology of our star.',
            'Within the Frost Protocol, the Parker probe serves as the departure vessel — launched from Earth orbit, it carries the trajectory algorithms that map the slingshot path through the inner system.',
        ],
        facts: [
            { label: 'MAX SPEED', value: '690,000 km/h' },
            { label: 'PERIHELION', value: '6.1M km' },
            { label: 'SHIELD TEMP', value: '1,370°C' },
            { label: 'LAUNCH', value: '2018' },
        ],
        credit: {
            text: 'NASA Visualization Technology Applications And Development (VTAD)',
            url: 'https://science.nasa.gov/resource/parker-solar-probe-3d-model/',
        },
    },
};

export interface LoreState {
    mode: LoreMode;
    target: LoreTarget;
    clickPos: { x: number; y: number };

    // Actions
    openLore: (target: Exclude<LoreTarget, null>, clickPos: { x: number; y: number }) => void;
    closeLore: () => void;
    setMode: (mode: LoreMode) => void;
}

export const useLoreStore = create<LoreState>((set) => ({
    mode: 'idle',
    target: null,
    clickPos: { x: 0.5, y: 0.5 },

    openLore: (target, clickPos) => {
        set({
            mode: 'focusing',
            target,
            clickPos: {
                x: clickPos.x / window.innerWidth,
                y: clickPos.y / window.innerHeight,
            },
        });

        // After a short focus cinematic delay, switch to open
        setTimeout(() => {
            set({ mode: 'open' });
        }, 600);
    },

    closeLore: () => {
        set({ mode: 'closing' });

        // After close animation, reset to idle
        setTimeout(() => {
            set({ mode: 'idle', target: null });
        }, 500);
    },

    setMode: (mode) => set({ mode }),
}));

// Selector hooks
export const useLoreMode = () => useLoreStore((s) => s.mode);
export const useLoreTarget = () => useLoreStore((s) => s.target);
export const useLoreActive = () => useLoreStore((s) => s.mode !== 'idle');
