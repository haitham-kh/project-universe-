"use client";

import React, { forwardRef, useEffect, useMemo } from "react";
import { Uniform } from "three";
import { Effect, BlendFunction } from "postprocessing";

// ═══════════════════════════════════════════════════════════════════════════════
// CINEMATIC GRAIN EFFECT - Shadow-Weighted "Breathing" Film Grain
//
// Unlike static noise, this grain:
// 1. "Breathes" with scene luminance - visible in shadows, clean in highlights
// 2. Uses time-based animation for organic movement
// 3. Respects the exposure - grain disappears in bright sun-lit areas
//
// Formula: grain * (1.0 - luminance) * intensity
// ═══════════════════════════════════════════════════════════════════════════════

const fragmentShader = /* glsl */ `
    uniform float intensity;
    uniform float time;
    uniform float shadowWeight;

    // Simple hash for noise (more stable)
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    // Luminance calculation
    float luminance(vec3 color) {
        return dot(color, vec3(0.299, 0.587, 0.114));
    }

    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 color = inputColor.rgb;
        
        // Get scene luminance (clamped to avoid issues)
        float lum = clamp(luminance(color), 0.0, 1.0);
        
        // Generate simple animated grain
        float noise = hash(uv * 1000.0 + vec2(time, time * 0.7));
        
        // Center noise around 0 (-0.5 to 0.5 range)
        noise = noise - 0.5;
        
        // Shadow weighting - grain visible in shadows, clean in highlights
        // Use safe math to avoid artifacts
        float shadowMask = clamp(1.0 - lum, 0.0, 1.0);
        shadowMask = pow(shadowMask, shadowWeight);
        
        // Apply grain with shadow weighting (very subtle)
        float grainAmount = noise * intensity * shadowMask;
        
        // Add grain while preserving color
        vec3 grainedColor = color + vec3(grainAmount);
        
        // Clamp to valid range
        grainedColor = clamp(grainedColor, 0.0, 1.0);
        
        outputColor = vec4(grainedColor, inputColor.a);
    }
`;

class CinematicGrainEffectImpl extends Effect {
    constructor(intensity: number, shadowWeight: number) {
        super("CinematicGrainEffect", fragmentShader, {
            blendFunction: BlendFunction.NORMAL,
            uniforms: new Map<string, Uniform>([
                ["intensity", new Uniform(intensity)],
                ["time", new Uniform(0)],
                ["shadowWeight", new Uniform(shadowWeight)],
            ]),
        });
    }

    update(_renderer: any, _inputBuffer: any, deltaTime: number) {
        const time = this.uniforms.get("time")!;
        time.value += deltaTime * 10; // Speed up for visible animation
    }

    setIntensity(v: number) {
        this.uniforms.get("intensity")!.value = v;
    }

    setShadowWeight(v: number) {
        this.uniforms.get("shadowWeight")!.value = v;
    }
}

interface CinematicGrainEffectProps {
    intensity?: number;
    shadowWeight?: number;
}

export const CinematicGrainEffect = forwardRef<CinematicGrainEffectImpl, CinematicGrainEffectProps>(
    function CinematicGrainEffect({ intensity = 0.08, shadowWeight = 1.5 }, ref) {
        const effect = useMemo(
            () => new CinematicGrainEffectImpl(intensity, shadowWeight),
            [] // Only create once
        );

        // Keep uniforms in sync with props
        useEffect(() => {
            effect.setIntensity(intensity);
        }, [effect, intensity]);

        useEffect(() => {
            effect.setShadowWeight(shadowWeight);
        }, [effect, shadowWeight]);

        return <primitive ref={ref} object={effect} dispose={null} />;
    }
);
