"use client";

import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useDirectorSceneOpacity } from "../lib/useDirector";

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE 2 ATMOSPHERIC EFFECTS
//
// Cinematic dust particles, subtle vignette glow, lens effects
// ═══════════════════════════════════════════════════════════════════════════════

const PARTICLE_COUNT = 800;

// Dust particle shader
const dustVertexShader = `
uniform float uTime;
uniform float uOpacity;
attribute float aSize;
attribute float aSpeed;
varying float vAlpha;

void main() {
    vec3 pos = position;
    
    // Slow drift motion
    pos.x += sin(uTime * aSpeed * 0.1 + position.z) * 2.0;
    pos.y += cos(uTime * aSpeed * 0.08 + position.x) * 1.5;
    pos.z += sin(uTime * aSpeed * 0.05) * 1.0;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    // Size attenuation
    gl_PointSize = aSize * (200.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 8.0);
    
    // Fade based on depth
    float depth = clamp(-mvPosition.z / 400.0, 0.0, 1.0);
    vAlpha = (1.0 - depth) * uOpacity * 0.6;
    
    gl_Position = projectionMatrix * mvPosition;
}
`;

const dustFragmentShader = `
varying float vAlpha;

void main() {
    // Soft circle
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    
    float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
    
    // Warm dust color
    vec3 color = vec3(1.0, 0.95, 0.85);
    
    gl_FragColor = vec4(color, alpha);
}
`;

export function Scene2Atmosphere({ opacity = 1 }: { opacity?: number }) {
    const sceneOpacity = useDirectorSceneOpacity();
    const pointsRef = useRef<THREE.Points>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    const { positions, sizes, speeds } = useMemo(() => {
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const sizes = new Float32Array(PARTICLE_COUNT);
        const speeds = new Float32Array(PARTICLE_COUNT);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Spread across a large area
            positions[i * 3] = (Math.random() - 0.5) * 600;     // X
            positions[i * 3 + 1] = (Math.random() - 0.5) * 400; // Y
            positions[i * 3 + 2] = (Math.random() - 0.8) * 500; // Z (more in front)

            sizes[i] = Math.random() * 3 + 0.5;
            speeds[i] = Math.random() * 2 + 0.5;
        }

        return { positions, sizes, speeds };
    }, []);

    const shaderMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader: dustVertexShader,
            fragmentShader: dustFragmentShader,
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
            materialRef.current.uniforms.uOpacity.value = sceneOpacity.scene2Opacity * opacity;
        }
    });

    const finalOpacity = sceneOpacity.scene2Opacity * opacity;
    if (finalOpacity < 0.01) return null;

    return (
        <points ref={pointsRef} frustumCulled={false}>
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
            </bufferGeometry>
            <primitive object={shaderMaterial} ref={materialRef} attach="material" />
        </points>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIGNETTE OVERLAY - Subtle darkening at edges for cinematic focus
// ═══════════════════════════════════════════════════════════════════════════════

export function Scene2Vignette() {
    const sceneOpacity = useDirectorSceneOpacity();
    const opacity = sceneOpacity.scene2Opacity;

    if (opacity < 0.05) return null;

    return (
        <div
            className="fixed inset-0 pointer-events-none"
            style={{
                opacity: opacity * 0.7,
                background: `radial-gradient(ellipse 80% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0.6) 100%)`,
            }}
        />
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LENS FLARE - Subtle glow from rim light direction
// ═══════════════════════════════════════════════════════════════════════════════

export function Scene2LensFlare() {
    const sceneOpacity = useDirectorSceneOpacity();
    const opacity = sceneOpacity.scene2Opacity;

    if (opacity < 0.05) return null;

    return (
        <div
            className="fixed pointer-events-none"
            style={{
                top: '15%',
                left: '25%',
                width: '150px',
                height: '150px',
                opacity: opacity * 0.25,
                background: `radial-gradient(circle, rgba(255,150,50,0.4) 0%, rgba(255,100,0,0.1) 40%, transparent 70%)`,
                filter: 'blur(20px)',
            }}
        />
    );
}
