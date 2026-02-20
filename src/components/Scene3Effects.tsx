"use client";

import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useDirectorSceneOpacity } from "../lib/useDirector";

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE 3 ATMOSPHERIC EFFECTS
//
// Cinematic ice crystal particles, aurora/nebula backdrop, lens flare
// Mirrors Scene 2's Scene2Effects.tsx pattern
// ═══════════════════════════════════════════════════════════════════════════════

const ICE_PARTICLE_COUNT = 600;

// ═══════════════════════════════════════════════════════════════════════════════
// ICE CRYSTAL PARTICLES — Drifting cold-blue motes
// ═══════════════════════════════════════════════════════════════════════════════

const iceVertexShader = `
uniform float uTime;
uniform float uOpacity;
attribute float aSize;
attribute float aSpeed;
attribute float aPhase;
varying float vAlpha;
varying float vSparkle;

void main() {
    vec3 pos = position;

    // Slow drifting motion — glacial, icy feel
    pos.x += sin(uTime * aSpeed * 0.06 + position.z * 0.5 + aPhase) * 3.0;
    pos.y += cos(uTime * aSpeed * 0.04 + position.x * 0.3 + aPhase * 1.3) * 2.5;
    pos.z += sin(uTime * aSpeed * 0.03 + aPhase * 0.7) * 1.5;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Size attenuation with some sparkle variation
    float sparkle = sin(uTime * 2.0 + aPhase * 6.28) * 0.3 + 0.7;
    gl_PointSize = aSize * sparkle * (220.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.3, 6.0);

    // Fade based on depth
    float depth = clamp(-mvPosition.z / 500.0, 0.0, 1.0);
    vAlpha = (1.0 - depth * 0.8) * uOpacity * 0.55;
    vSparkle = sparkle;

    gl_Position = projectionMatrix * mvPosition;
}
`;

const iceFragmentShader = `
varying float vAlpha;
varying float vSparkle;

void main() {
    // Soft glowing circle with bright core
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float alpha = smoothstep(0.5, 0.05, dist) * vAlpha;

    // Bright core flash
    float core = smoothstep(0.15, 0.0, dist) * 0.4 * vSparkle;
    alpha += core;

    // Ice blue → cyan color
    vec3 color = mix(
        vec3(0.55, 0.75, 1.0),   // Ice blue
        vec3(0.75, 0.92, 1.0),   // Bright cyan-white
        smoothstep(0.3, 0.0, dist)
    );

    gl_FragColor = vec4(color, alpha);
}
`;

export function Scene3Atmosphere({ opacity = 1 }: { opacity?: number }) {
    const sceneOpacity = useDirectorSceneOpacity();
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    const { positions, sizes, speeds, phases } = useMemo(() => {
        const positions = new Float32Array(ICE_PARTICLE_COUNT * 3);
        const sizes = new Float32Array(ICE_PARTICLE_COUNT);
        const speeds = new Float32Array(ICE_PARTICLE_COUNT);
        const phases = new Float32Array(ICE_PARTICLE_COUNT);

        for (let i = 0; i < ICE_PARTICLE_COUNT; i++) {
            // Spread across a large area — wide field around Neptune
            positions[i * 3] = (Math.random() - 0.5) * 800;       // X
            positions[i * 3 + 1] = (Math.random() - 0.5) * 500;   // Y
            positions[i * 3 + 2] = (Math.random() - 0.7) * 600;   // Z (biased forward)

            sizes[i] = Math.random() * 3.5 + 0.8;
            speeds[i] = Math.random() * 2.5 + 0.3;
            phases[i] = Math.random() * Math.PI * 2;
        }

        return { positions, sizes, speeds, phases };
    }, []);

    const shaderMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader: iceVertexShader,
            fragmentShader: iceFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uOpacity: { value: 1 },
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
    }, []);

    useFrame(({ clock }) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
            materialRef.current.uniforms.uOpacity.value = sceneOpacity.scene3Opacity * opacity;
        }
    });

    const finalOpacity = sceneOpacity.scene3Opacity * opacity;
    if (finalOpacity < 0.01) return null;

    return (
        <points frustumCulled={false}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                />
                <bufferAttribute
                    attach="attributes-aSize"
                    args={[sizes, 1]}
                />
                <bufferAttribute
                    attach="attributes-aSpeed"
                    args={[speeds, 1]}
                />
                <bufferAttribute
                    attach="attributes-aPhase"
                    args={[phases, 1]}
                />
            </bufferGeometry>
            <primitive object={shaderMaterial} ref={materialRef} attach="material" />
        </points>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AURORA / NEBULA VEIL — Procedural deep-space backdrop behind Neptune
// ═══════════════════════════════════════════════════════════════════════════════

const auroraVertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const auroraFragmentShader = `
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;

// Simple noise functions for procedural aurora
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p *= 2.1;
        amplitude *= 0.45;
    }
    return value;
}

void main() {
    vec2 uv = vUv;

    // Slow flowing motion
    float t = uTime * 0.04;

    // Layered noise for nebula/aurora effect
    float n1 = fbm(uv * 3.0 + vec2(t * 0.3, t * 0.1));
    float n2 = fbm(uv * 5.0 + vec2(-t * 0.2, t * 0.15) + 100.0);
    float n3 = fbm(uv * 2.0 + vec2(t * 0.1, -t * 0.08) + 200.0);

    // Aurora streaks — horizontal bias
    float aurora = smoothstep(0.3, 0.7, n1) * smoothstep(0.35, 0.65, n2);
    aurora *= smoothstep(0.0, 0.3, uv.y) * smoothstep(1.0, 0.6, uv.y);  // vertical fade

    // Color mix: deep blue → cyan → teal
    vec3 col1 = vec3(0.05, 0.12, 0.35);  // Deep space blue
    vec3 col2 = vec3(0.10, 0.35, 0.55);  // Nebula teal
    vec3 col3 = vec3(0.20, 0.50, 0.70);  // Bright cyan accent

    vec3 color = mix(col1, col2, n1);
    color = mix(color, col3, aurora * 0.5);

    // Subtle purple fringe
    color += vec3(0.08, 0.02, 0.15) * n3 * 0.4;

    // Distance fade from center
    float centerDist = length(uv - 0.5) * 2.0;
    float fade = smoothstep(1.2, 0.3, centerDist);

    float alpha = (aurora * 0.35 + n1 * 0.12) * fade * uOpacity;
    alpha = clamp(alpha, 0.0, 0.3);

    gl_FragColor = vec4(color, alpha);
}
`;

export function Scene3AuroraVeil() {
    const sceneOpacity = useDirectorSceneOpacity();
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    const material = useMemo(() => new THREE.ShaderMaterial({
        vertexShader: auroraVertexShader,
        fragmentShader: auroraFragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: 0 },
        },
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    }), []);

    useFrame(({ clock }) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
            materialRef.current.uniforms.uOpacity.value = sceneOpacity.scene3Opacity;
        }
    });

    if (sceneOpacity.scene3Opacity < 0.01) return null;

    return (
        <mesh position={[0, 0, -600]} frustumCulled={false}>
            <planeGeometry args={[1200, 800]} />
            <primitive object={material} ref={materialRef} attach="material" />
        </mesh>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LENS FLARE — Subtle blue/cyan glow from sun direction (CSS overlay)
// Mirrors Scene2LensFlare pattern
// ═══════════════════════════════════════════════════════════════════════════════

export function Scene3LensFlare() {
    const sceneOpacity = useDirectorSceneOpacity();
    const opacity = sceneOpacity.scene3Opacity;

    if (opacity < 0.05) return null;

    return (
        <>
            {/* Primary flare — cool blue */}
            <div
                className="fixed pointer-events-none"
                style={{
                    top: '10%',
                    right: '15%',
                    width: '200px',
                    height: '200px',
                    opacity: opacity * 0.2,
                    background: `radial-gradient(circle, rgba(80,160,255,0.35) 0%, rgba(40,100,200,0.12) 35%, transparent 70%)`,
                    filter: 'blur(25px)',
                }}
            />
            {/* Secondary flare — subtle cyan streak */}
            <div
                className="fixed pointer-events-none"
                style={{
                    top: '18%',
                    right: '20%',
                    width: '300px',
                    height: '40px',
                    opacity: opacity * 0.12,
                    background: `linear-gradient(90deg, transparent 0%, rgba(120,200,255,0.25) 30%, rgba(120,200,255,0.25) 70%, transparent 100%)`,
                    filter: 'blur(15px)',
                    transform: 'rotate(-15deg)',
                }}
            />
            {/* Tertiary — deep blue vignette glow from top-right */}
            <div
                className="fixed pointer-events-none"
                style={{
                    top: '0%',
                    right: '0%',
                    width: '50vw',
                    height: '40vh',
                    opacity: opacity * 0.15,
                    background: `radial-gradient(ellipse 60% 50% at 90% 10%, rgba(40,100,200,0.3) 0%, transparent 70%)`,
                }}
            />
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CINEMATIC VIGNETTE — Deep blue-tinted edge darkening for Scene 3
// ═══════════════════════════════════════════════════════════════════════════════

export function Scene3Vignette() {
    const sceneOpacity = useDirectorSceneOpacity();
    const opacity = sceneOpacity.scene3Opacity;

    if (opacity < 0.05) return null;

    return (
        <div
            className="fixed inset-0 pointer-events-none"
            style={{
                opacity: opacity * 0.8,
                background: `radial-gradient(ellipse 75% 65% at 50% 50%, transparent 25%, rgba(5,10,30,0.35) 65%, rgba(3,5,18,0.7) 100%)`,
            }}
        />
    );
}
