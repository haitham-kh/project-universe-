"use client";

import React, { forwardRef, useEffect, useMemo } from "react";
import { Uniform } from "three";
import { Effect, BlendFunction } from "postprocessing";

// ═══════════════════════════════════════════════════════════════════════════════
// CAS-STYLE ADAPTIVE SHARPEN EFFECT
// 
// Contrast-adaptive sharpening to recover crispness when rendering below native DPR.
// Based on CAS principles, simplified for WebGL.
//
// Features:
// - 4-tap unsharp mask (cheap, only 4 texture reads)
// - Contrast/edge gating (sharpens edges, not flat areas/noise)
// - Halo clamping (prevents white halos around bright bloom edges)
// ═══════════════════════════════════════════════════════════════════════════════

const fragmentShader = /* glsl */ `
    uniform float sharpness;
    uniform float clampMax;
    uniform float edgeThreshold;
    uniform float motionDamp;

    // Luma helper (perceived brightness)
    float luma(vec3 c) {
        return dot(c, vec3(0.299, 0.587, 0.114));
    }

    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        if (sharpness <= 0.0001 || motionDamp <= 0.0001) {
            outputColor = inputColor;
            return;
        }

        vec3 c = inputColor.rgb;

        // 4-neighbor blur using built-in texelSize (provided by postprocessing)
        vec3 n = texture2D(inputBuffer, uv + vec2(0.0,  texelSize.y)).rgb;
        vec3 s = texture2D(inputBuffer, uv + vec2(0.0, -texelSize.y)).rgb;
        vec3 e = texture2D(inputBuffer, uv + vec2( texelSize.x, 0.0)).rgb;
        vec3 w = texture2D(inputBuffer, uv + vec2(-texelSize.x, 0.0)).rgb;

        vec3 blur = (n + s + e + w) * 0.25;
        vec3 detail = c - blur;
        vec3 localMin = min(c, min(min(n, s), min(e, w)));
        vec3 localMax = max(c, max(max(n, s), max(e, w)));

        // CAS-style adaptive gain:
        // - favors true edges
        // - reduces sharpening in flat/low-contrast regions
        // - suppresses during high motion
        float edge = abs(luma(c) - luma(blur));
        float edgeGate = smoothstep(edgeThreshold, edgeThreshold * 4.0, edge);
        vec3 contrastRGB = localMax - localMin;
        float contrast = max(contrastRGB.r, max(contrastRGB.g, contrastRGB.b));
        float contrastGate = smoothstep(0.03, 0.22, contrast);
        float adaptive = mix(0.25, 1.0, contrastGate) * edgeGate;

        // Halo control - clamp detail to prevent ringing artifacts
        detail = clamp(detail, vec3(-clampMax), vec3(clampMax));

        vec3 outRgb = c + detail * (sharpness * adaptive * motionDamp);
        outRgb = clamp(outRgb, localMin - vec3(0.015), localMax + vec3(0.015));
        outputColor = vec4(outRgb, inputColor.a);
    }
`;

class SharpenEffectImpl extends Effect {
    constructor(sharpness: number, clampMax: number, edgeThreshold: number, motionDamp: number) {
        super("SharpenEffect", fragmentShader, {
            blendFunction: BlendFunction.NORMAL,
            uniforms: new Map<string, Uniform>([
                ["sharpness", new Uniform(sharpness)],
                ["clampMax", new Uniform(clampMax)],
                ["edgeThreshold", new Uniform(edgeThreshold)],
                ["motionDamp", new Uniform(motionDamp)],
            ]),
        });
    }

    setSharpness(v: number) {
        this.uniforms.get("sharpness")!.value = v;
    }

    setClampMax(v: number) {
        this.uniforms.get("clampMax")!.value = v;
    }

    setEdgeThreshold(v: number) {
        this.uniforms.get("edgeThreshold")!.value = v;
    }

    setMotionDamp(v: number) {
        this.uniforms.get("motionDamp")!.value = v;
    }
}

interface SharpenEffectProps {
    sharpness?: number;
    clampMax?: number;
    edgeThreshold?: number;
    motionDamp?: number;
}

export const SharpenEffect = forwardRef<SharpenEffectImpl, SharpenEffectProps>(
    function SharpenEffect({
        sharpness = 0.3,
        clampMax = 0.08,
        edgeThreshold = 0.018,
        motionDamp = 1,
    }, ref) {
        const effect = useMemo(
            () => new SharpenEffectImpl(sharpness, clampMax, edgeThreshold, motionDamp),
            [] // Only create once
        );

        // Keep uniforms in sync with props
        useEffect(() => {
            effect.setSharpness(sharpness);
        }, [effect, sharpness]);

        useEffect(() => {
            effect.setClampMax(clampMax);
        }, [effect, clampMax]);

        useEffect(() => {
            effect.setEdgeThreshold(edgeThreshold);
        }, [effect, edgeThreshold]);

        useEffect(() => {
            effect.setMotionDamp(motionDamp);
        }, [effect, motionDamp]);

        return <primitive ref={ref} object={effect} dispose={null} />;
    }
);
