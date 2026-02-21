"use client";

import * as THREE from "three";
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useDirector } from "../lib/useDirector";

// ═══════════════════════════════════════════════════════════════════════════════
// STAR STREAKS — Instanced line-like quads during scene transitions
//
// ~800 thin quads with additive blending, stretched along velocity direction.
// Intensity driven by Director transitionFx / transition2Fx.
// Returns null when both transitions are inactive.
// ═══════════════════════════════════════════════════════════════════════════════

const STREAK_COUNT = 800;
const STREAK_SPREAD = 300; // How wide the streak field is
const STREAK_DEPTH = 600;  // How deep the streak field extends

const seededUnit = (seed: number): number => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
};

// Simple vertex shader: stretches quads along Z based on intensity
const streakVertexShader = `
uniform float uIntensity;
uniform float uTime;
uniform vec3 uColor;
attribute float aOffset;
attribute float aSpeed;
attribute float aSize;
varying float vAlpha;
varying vec3 vColor;

void main() {
    vec3 pos = position;
    
    // Each streak has a unique offset and speed
    float streakZ = mod(pos.z + uTime * aSpeed * 80.0 + aOffset * STREAK_DEPTH, STREAK_DEPTH) - STREAK_DEPTH * 0.5;
    pos.z = streakZ;
    
    // Stretch along Z based on intensity (creates streak length)
    float stretch = 1.0 + uIntensity * aSpeed * 15.0;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos.x, pos.y, pos.z, 1.0);
    
    // Point size: thinner streaks, larger when more intense
    gl_PointSize = aSize * (1.0 + uIntensity * 3.0) * (150.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 6.0);
    
    // Fade based on depth and intensity
    float depth = clamp(-mvPosition.z / 500.0, 0.0, 1.0);
    vAlpha = (1.0 - depth * 0.7) * uIntensity * (0.3 + aSpeed * 0.7);
    vColor = uColor;
    
    gl_Position = projectionMatrix * mvPosition;
}
`.replace(/STREAK_DEPTH/g, STREAK_DEPTH.toFixed(1));

const streakFragmentShader = `
varying float vAlpha;
varying vec3 vColor;

void main() {
    // Soft elongated shape
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;
    
    float alpha = smoothstep(0.5, 0.1, dist) * vAlpha;
    gl_FragColor = vec4(vColor, alpha);
}
`;

export function StarStreaks() {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const pointsRef = useRef<THREE.Points>(null);
    const t1Ref = useRef({ streakIntensity: 0 });
    const t2Ref = useRef({ streakIntensity: 0 });

    // Subscribe once and update refs without triggering React renders.
    useEffect(() => {
        const unsubscribe = useDirector.subscribe((state) => {
            t1Ref.current.streakIntensity = state.transitionFx.streakIntensity;
            t2Ref.current.streakIntensity = state.transition2Fx.streakIntensity;
        });

        const state = useDirector.getState();
        t1Ref.current.streakIntensity = state.transitionFx.streakIntensity;
        t2Ref.current.streakIntensity = state.transition2Fx.streakIntensity;

        return unsubscribe;
    }, []);

    // Generate particle positions and attributes
    const { positions, offsets, speeds, sizes } = useMemo(() => {
        const positions = new Float32Array(STREAK_COUNT * 3);
        const offsets = new Float32Array(STREAK_COUNT);
        const speeds = new Float32Array(STREAK_COUNT);
        const sizes = new Float32Array(STREAK_COUNT);

        for (let i = 0; i < STREAK_COUNT; i++) {
            const r1 = seededUnit(i * 1.1 + 0.13);
            const r2 = seededUnit(i * 1.7 + 0.29);
            const r3 = seededUnit(i * 2.3 + 0.47);
            const r4 = seededUnit(i * 2.9 + 0.61);
            const r5 = seededUnit(i * 3.7 + 0.83);
            const r6 = seededUnit(i * 4.1 + 1.03);

            // Spread across a cylinder around the camera
            const angle = r1 * Math.PI * 2;
            const radius = r2 * STREAK_SPREAD;

            positions[i * 3] = Math.cos(angle) * radius;     // X
            positions[i * 3 + 1] = Math.sin(angle) * radius; // Y
            positions[i * 3 + 2] = (r3 - 0.5) * STREAK_DEPTH; // Z

            offsets[i] = r4;
            speeds[i] = r5 * 1.5 + 0.5;
            sizes[i] = r6 * 2 + 0.5;
        }

        return { positions, offsets, speeds, sizes };
    }, []);

    const shaderMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader: streakVertexShader,
            fragmentShader: streakFragmentShader,
            uniforms: {
                uIntensity: { value: 0 },
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(0.8, 0.9, 1.0) },
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false,
        });
    }, []);

    useFrame(({ clock, camera }) => {
        if (!materialRef.current) return;

        const t1Intensity = t1Ref.current.streakIntensity;
        const t2Intensity = t2Ref.current.streakIntensity;
        const activeIntensity = Math.max(t1Intensity, t2Intensity);

        if (pointsRef.current) {
            pointsRef.current.visible = activeIntensity > 0.005;
            // Follow camera position so streaks always surround the viewer
            pointsRef.current.position.copy(camera.position);
        }

        if (activeIntensity <= 0.005) return;

        materialRef.current.uniforms.uIntensity.value = activeIntensity;
        materialRef.current.uniforms.uTime.value = clock.getElapsedTime();

        // Color shifts based on which transition is active
        if (t1Intensity > t2Intensity) {
            // Earth→Saturn: cyan → warm white
            const c = materialRef.current.uniforms.uColor.value as THREE.Color;
            c.setRGB(
                THREE.MathUtils.lerp(0.7, 1.0, t1Intensity),
                THREE.MathUtils.lerp(0.9, 0.85, t1Intensity),
                1.0
            );
        } else if (t2Intensity > 0.01) {
            // Saturn→Neptune: warm → ice blue
            const c = materialRef.current.uniforms.uColor.value as THREE.Color;
            c.setRGB(
                THREE.MathUtils.lerp(1.0, 0.5, t2Intensity),
                THREE.MathUtils.lerp(0.9, 0.7, t2Intensity),
                1.0
            );
        }

    });

    return (
        <points ref={pointsRef} frustumCulled={false} renderOrder={999}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                />
                <bufferAttribute
                    attach="attributes-aOffset"
                    args={[offsets, 1]}
                />
                <bufferAttribute
                    attach="attributes-aSpeed"
                    args={[speeds, 1]}
                />
                <bufferAttribute
                    attach="attributes-aSize"
                    args={[sizes, 1]}
                />
            </bufferGeometry>
            <primitive object={shaderMaterial} ref={materialRef} attach="material" />
        </points>
    );
}
