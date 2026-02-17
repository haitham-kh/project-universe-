"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDirector } from "../lib/useDirector";

// ═══════════════════════════════════════════════════════════════════════════════
// ASH PARTICLES - Director-driven scroll velocity
// Custom shader for per-point sizes with soft circle rendering
// ═══════════════════════════════════════════════════════════════════════════════

interface AshParticlesProps {
    count?: number;
}

// Custom shader material for per-point sizes
const vertexShader = `
    attribute float size;
    varying float vAlpha;
    
    void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        
        // Size attenuation based on distance
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_PointSize = clamp(gl_PointSize, 1.0, 32.0);
        
        // Fade based on distance for depth
        vAlpha = smoothstep(100.0, 20.0, -mvPosition.z);
        
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fragmentShader = `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying float vAlpha;
    
    void main() {
        // Soft circle with smooth edge falloff
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
        
        if (alpha < 0.01) discard;
        
        gl_FragColor = vec4(uColor, alpha * uOpacity * vAlpha);
    }
`;

export function AshParticles({ count = 300 }: AshParticlesProps) {
    const pointsRef = useRef<THREE.Points>(null);
    const velocitiesRef = useRef<Float32Array | null>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    // OPTIMIZATION: PARTICLE BUFFER POOLING
    // React's useMemo acts as an implicit object pool here.
    // The buffers are created ONCE and reused as long as 'count' doesn't change,
    // protecting against Garbage Collection spikes during re-renders.
    const { geometry, baseVelocities } = useMemo(() => {
        const positions = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const velocities = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            // Spread particles in a cylinder around the scene
            const angle = Math.random() * Math.PI * 2;
            const radius = 4 + Math.random() * 14;
            const height = -10 + Math.random() * 24;

            positions[i * 3] = Math.cos(angle) * radius;
            positions[i * 3 + 1] = height;
            positions[i * 3 + 2] = Math.sin(angle) * radius - 5;

            // Per-point size variation (used by shader)
            sizes[i] = 0.8 + Math.random() * 2.0;

            // Slower base velocities for atmospheric feel
            velocities[i] = 0.15 + Math.random() * 0.35;
        }

        velocitiesRef.current = velocities;

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        return { geometry: geo, baseVelocities: velocities };
    }, [count]);

    // ═══════════════════════════════════════════════════════════════════════════════
    // SUBSCRIPTION PATTERN - Write to ref, read in useFrame (no getState calls)
    // ═══════════════════════════════════════════════════════════════════════════════
    const scrollVelocityRef = useRef(0);

    useEffect(() => {
        const unsub = useDirector.subscribe((state) => {
            scrollVelocityRef.current = state.scrollVelocitySmooth;
        });
        scrollVelocityRef.current = useDirector.getState().scrollVelocitySmooth;
        return unsub;
    }, []);

    useFrame((state, delta) => {
        if (!pointsRef.current || !velocitiesRef.current) return;

        const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
        const time = state.clock.elapsedTime;

        // Read scroll velocity from ref (subscribed, no getState call)
        const scrollVelocity = Math.abs(scrollVelocityRef.current);
        const scrollBoost = 1 + Math.min(scrollVelocity * 0.5, 3); // Clamped boost

        // Update particle positions
        for (let i = 0; i < count; i++) {
            const baseSpeed = baseVelocities[i];

            // Move upward slowly with scroll boost
            positions[i * 3 + 1] += baseSpeed * delta * scrollBoost;

            // Very gentle horizontal drift
            positions[i * 3] += Math.sin(time * 0.3 + i * 0.1) * delta * 0.08;
            positions[i * 3 + 2] += Math.cos(time * 0.2 + i * 0.15) * delta * 0.06;

            // Reset particle if it goes too high
            if (positions[i * 3 + 1] > 14) {
                const angle = Math.random() * Math.PI * 2;
                const radius = 4 + Math.random() * 14;
                positions[i * 3] = Math.cos(angle) * radius;
                positions[i * 3 + 1] = -10;
                positions[i * 3 + 2] = Math.sin(angle) * radius - 5;
            }
        }

        pointsRef.current.geometry.attributes.position.needsUpdate = true;

        // Very subtle rotation
        pointsRef.current.rotation.y = time * 0.01;
    });

    return (
        <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
            <shaderMaterial
                ref={materialRef}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={{
                    uColor: { value: new THREE.Color("#8899bb") },
                    uOpacity: { value: 0.4 },
                }}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
}
