"use client";

import React, { forwardRef, useEffect, useMemo } from "react";
import { Uniform } from "three";
import { Effect, BlendFunction } from "postprocessing";

// ═══════════════════════════════════════════════════════════════════════════════
// FSR-STYLE SHARPEN EFFECT
// 
// Contrast-adaptive sharpening to recover crispness when rendering below native DPR.
// Based on AMD FidelityFX CAS principles but simplified for WebGL.
//
// Features:
// - 4-tap unsharp mask (cheap, only 4 texture reads)
// - Contrast/edge gating (sharpens edges, not flat areas/noise)
// - Halo clamping (prevents white halos around bright bloom edges)
// ═══════════════════════════════════════════════════════════════════════════════

const fragmentShader = /* glsl */ `
    uniform float sharpness;
    uniform float clampMax;

    // Luma helper (perceived brightness)
    float luma(vec3 c) {
        return dot(c, vec3(0.299, 0.587, 0.114));
    }

    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;

        // 4-neighbor blur using built-in texelSize (provided by postprocessing)
        vec3 n = texture2D(inputBuffer, uv + vec2(0.0,  texelSize.y)).rgb;
        vec3 s = texture2D(inputBuffer, uv + vec2(0.0, -texelSize.y)).rgb;
        vec3 e = texture2D(inputBuffer, uv + vec2( texelSize.x, 0.0)).rgb;
        vec3 w = texture2D(inputBuffer, uv + vec2(-texelSize.x, 0.0)).rgb;

        vec3 blur = (n + s + e + w) * 0.25;
        vec3 detail = c - blur;

        // Contrast-adaptive gating:
        // - sharpen edges more
        // - avoid sharpening flat gradients (prevents "crispy noise" + banding)
        float edge = abs(luma(c) - luma(blur));
        float gate = clamp(edge * 8.0, 0.0, 1.0);

        // Halo control - clamp detail to prevent ringing artifacts
        detail = clamp(detail, vec3(-clampMax), vec3(clampMax));

        vec3 outRgb = c + detail * (sharpness * gate);
        outputColor = vec4(outRgb, inputColor.a);
    }
`;

class SharpenEffectImpl extends Effect {
    constructor(sharpness: number, clampMax: number) {
        super("SharpenEffect", fragmentShader, {
            blendFunction: BlendFunction.NORMAL,
            uniforms: new Map<string, Uniform>([
                ["sharpness", new Uniform(sharpness)],
                ["clampMax", new Uniform(clampMax)],
            ]),
        });
    }

    setSharpness(v: number) {
        this.uniforms.get("sharpness")!.value = v;
    }

    setClampMax(v: number) {
        this.uniforms.get("clampMax")!.value = v;
    }
}

interface SharpenEffectProps {
    sharpness?: number;
    clampMax?: number;
}

export const SharpenEffect = forwardRef<SharpenEffectImpl, SharpenEffectProps>(
    function SharpenEffect({ sharpness = 0.3, clampMax = 0.08 }, ref) {
        const effect = useMemo(
            () => new SharpenEffectImpl(sharpness, clampMax),
            [] // Only create once
        );

        // Keep uniforms in sync with props
        useEffect(() => {
            effect.setSharpness(sharpness);
        }, [effect, sharpness]);

        useEffect(() => {
            effect.setClampMax(clampMax);
        }, [effect, clampMax]);

        return <primitive ref={ref} object={effect} dispose={null} />;
    }
);
