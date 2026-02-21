"use client";

import * as THREE from "three";
import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { create } from "zustand";
import { useDirectorSceneOpacity } from "../lib/useDirector";
import { useLoreStore } from "../lib/useLoreStore";
import { Slider, ObjectSliders, DebugPanel, PlanetPosition, CameraSettings } from "./DebugSliders";
import { BASE_PATH } from "../lib/basePath";
import { Scene3AuroraVeil, Scene3Atmosphere } from "./Scene3Effects";

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE 3 DEBUG STORE - USER TUNED VALUES
// Uses shared DebugSliders components for consistency
// ═══════════════════════════════════════════════════════════════════════════════

interface Scene3DebugState {
    neptune: PlanetPosition;
    neptuneLimb: PlanetPosition;
    camera: CameraSettings;
    backgroundFov: number; // Separate FOV for background elements
    lighting: {
        ambient: number;
        sunIntensity: number;
        sunX: number;
        sunY: number;
        sunZ: number;
    };
    showDebug: boolean;
    setNeptune: (val: Partial<PlanetPosition>) => void;
    setNeptuneLimb: (val: Partial<PlanetPosition>) => void;
    setCamera: (val: Partial<CameraSettings>) => void;
    setBackgroundFov: (val: number) => void;
    setLighting: (val: Partial<Scene3DebugState['lighting']>) => void;
    toggleDebug: () => void;
}

// USER LOCKED VALUES - Tuned 2026-02-06
export const useScene3Debug = create<Scene3DebugState>((set) => ({
    neptune: { x: -886, y: -614, z: -841, scale: 744.6, rotX: -17, rotY: 176, rotZ: -7, spinSpeed: 0.02 },
    neptuneLimb: { x: 477, y: 238, z: -111, scale: 395.7, rotX: 7, rotY: 101, rotZ: 171, spinSpeed: 0 },
    camera: { x: 0, y: 0, z: 0, fov: 118 },
    backgroundFov: 10,
    lighting: {
        ambient: 1.65,
        sunIntensity: 5.7,
        sunX: 138,
        sunY: 74,
        sunZ: -8,
    },
    showDebug: false,
    setNeptune: (val) => set((s) => ({ neptune: { ...s.neptune, ...val } })),
    setNeptuneLimb: (val) => set((s) => ({ neptuneLimb: { ...s.neptuneLimb, ...val } })),
    setCamera: (val) => set((s) => ({ camera: { ...s.camera, ...val } })),
    setBackgroundFov: (val) => set({ backgroundFov: val }),
    setLighting: (val) => set((s) => ({ lighting: { ...s.lighting, ...val } })),
    toggleDebug: () => set((s) => ({ showDebug: !s.showDebug })),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// DEBUG UI - Using shared DebugSliders components
// ═══════════════════════════════════════════════════════════════════════════════

export function Scene3DebugMenu() {
    const d = useScene3Debug();
    const sceneOpacity = useDirectorSceneOpacity();
    const [copied, setCopied] = useState(false);

    if (sceneOpacity.scene3Opacity < 0.1) return null;

    const copyValues = () => {
        const values = {
            neptune: d.neptune,
            neptuneLimb: d.neptuneLimb,
            camera: d.camera,
            backgroundFov: d.backgroundFov,
            lighting: d.lighting,
        };
        navigator.clipboard.writeText(JSON.stringify(values, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!d.showDebug) {
        return (
            <button onClick={d.toggleDebug} style={{
                position: 'fixed', bottom: '10px', right: '10px', zIndex: 9999,
                padding: '6px 12px', background: '#333', color: '#fff', border: 'none',
                borderRadius: '4px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '11px'
            }}>Show Scene3 Debug</button>
        );
    }

    return (
        <div style={{
            position: 'fixed', bottom: '10px', right: '10px', zIndex: 9999,
            background: 'rgba(0,0,0,0.95)', color: '#fff', padding: '10px',
            borderRadius: '8px', fontFamily: 'monospace', fontSize: '10px',
            width: '300px', maxHeight: '85vh', overflowY: 'auto'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ fontSize: '12px' }}>Scene 3 Debug</strong>
                <button onClick={d.toggleDebug} style={{ background: '#444', border: 'none', color: '#fff', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}>Hide</button>
            </div>

            {/* Camera Controls - Matching Scene 2 */}
            <div style={{ marginBottom: '8px', padding: '6px', background: '#1a1a1a', borderRadius: '4px' }}>
                <div style={{ color: '#ff8', fontSize: '11px', marginBottom: '4px' }}>📷 Camera Offset</div>
                <Slider label="X" value={d.camera.x} onChange={(v) => d.setCamera({ x: v })} min={-200} max={200} step={1} />
                <Slider label="Y" value={d.camera.y} onChange={(v) => d.setCamera({ y: v })} min={-200} max={200} step={1} />
                <Slider label="Z" value={d.camera.z} onChange={(v) => d.setCamera({ z: v })} min={-500} max={500} step={1} />
                <Slider label="FOV" value={d.camera.fov} onChange={(v) => d.setCamera({ fov: v })} min={10} max={180} step={1} />
            </div>

            {/* Background FOV - Separate from scene camera */}
            <div style={{ marginBottom: '8px', padding: '6px', background: '#1a1a1a', borderRadius: '4px' }}>
                <div style={{ color: '#8f8', fontSize: '11px', marginBottom: '4px' }}>🌌 Background FOV</div>
                <Slider label="FOV" value={d.backgroundFov} onChange={d.setBackgroundFov} min={10} max={180} step={1} />
            </div>

            <ObjectSliders name="Neptune Planet" emoji="🔵" pos={d.neptune} onChange={d.setNeptune} posRange={{ min: -4000, max: 4000 }} zRange={{ min: -4000, max: 4000 }} scaleRange={{ min: 0.1, max: 2000 }} />
            <ObjectSliders name="Neptune Limb" emoji="🌌" pos={d.neptuneLimb} onChange={d.setNeptuneLimb} posRange={{ min: -4000, max: 4000 }} zRange={{ min: -4000, max: 4000 }} scaleRange={{ min: 0.1, max: 2000 }} />

            {/* Lighting Controls */}
            <div style={{ marginBottom: '8px', padding: '6px', background: '#1a1a1a', borderRadius: '4px' }}>
                <div style={{ color: '#ff8', fontSize: '11px', marginBottom: '4px' }}>💡 Lighting</div>
                <Slider label="Ambt" value={d.lighting.ambient} onChange={(v) => d.setLighting({ ambient: v })} min={0} max={10} step={0.05} />
                <Slider label="Sun" value={d.lighting.sunIntensity} onChange={(v) => d.setLighting({ sunIntensity: v })} min={0} max={50} step={0.1} />
                <Slider label="Sun X" value={d.lighting.sunX} onChange={(v) => d.setLighting({ sunX: v })} min={-2000} max={2000} step={1} />
                <Slider label="Sun Y" value={d.lighting.sunY} onChange={(v) => d.setLighting({ sunY: v })} min={-2000} max={2000} step={1} />
                <Slider label="Sun Z" value={d.lighting.sunZ} onChange={(v) => d.setLighting({ sunZ: v })} min={-2000} max={2000} step={1} />
            </div>

            <button onClick={copyValues} style={{
                marginTop: '10px', width: '100%', padding: '8px',
                background: copied ? '#2a5' : '#444', color: '#fff',
                border: 'none', borderRadius: '4px', cursor: 'pointer',
                fontSize: '11px', fontWeight: 'bold'
            }}>{copied ? '✓ Copied!' : '📋 Copy All Values'}</button>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEPTUNE PLANET (Baked Model)
// ═══════════════════════════════════════════════════════════════════════════════
function NeptunePlanet({ position }: { position: PlanetPosition }) {
    const groupRef = useRef<THREE.Group>(null);
    const spinRef = useRef(0);
    const { scene: glbScene, animations } = useGLTF(`${BASE_PATH}/models/neptune-v3-draco.glb`);
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);

    const clonedScene = useMemo(() => {
        const clone = glbScene.clone(true);
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.frustumCulled = false;
                mesh.renderOrder = 1;
            }
        });
        return clone;
    }, [glbScene]);

    useEffect(() => {
        if (animations?.length) {
            const mixer = new THREE.AnimationMixer(clonedScene);
            mixerRef.current = mixer;
            animations.forEach((clip) => mixer.clipAction(clip).play());
            return () => { mixer.stopAllAction(); };
        }
    }, [animations, clonedScene]);

    useFrame((_, delta) => {
        if (mixerRef.current) mixerRef.current.update(delta);
        spinRef.current += position.spinSpeed * delta;

        if (groupRef.current) {
            groupRef.current.rotation.x = THREE.MathUtils.degToRad(position.rotX);
            groupRef.current.rotation.y = THREE.MathUtils.degToRad(position.rotY) + spinRef.current;
            groupRef.current.rotation.z = THREE.MathUtils.degToRad(position.rotZ);
        }
    });

    return (
        <group ref={groupRef} position={[position.x, position.y, position.z]}
            scale={[position.scale, position.scale, position.scale]}
            onClick={(e) => {
                e.stopPropagation();
                // R3F ThreeEvent: nativeEvent is the DOM PointerEvent on the canvas
                const domEvent = e.nativeEvent;
                const cx = (domEvent as MouseEvent).clientX ?? window.innerWidth / 2;
                const cy = (domEvent as MouseEvent).clientY ?? window.innerHeight / 2;
                console.log('[LoreClick] Neptune clicked at', cx, cy);
                useLoreStore.getState().openLore('neptune', { x: cx, y: cy });
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'default'; }}
        >
            <primitive object={clonedScene} />
        </group>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE PLANET (for background elements)
// ═══════════════════════════════════════════════════════════════════════════════
function Planet({ path, position }: { path: string; position: PlanetPosition }) {
    const groupRef = useRef<THREE.Group>(null);
    const spinRef = useRef(0);
    const { scene: glbScene, animations } = useGLTF(path);
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);

    const clonedScene = useMemo(() => {
        const clone = glbScene.clone(true);
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.frustumCulled = false;
                mesh.renderOrder = 0;
            }
        });
        return clone;
    }, [glbScene]);

    useEffect(() => {
        if (animations?.length) {
            const mixer = new THREE.AnimationMixer(clonedScene);
            mixerRef.current = mixer;
            animations.forEach((clip) => mixer.clipAction(clip).play());
            return () => { mixer.stopAllAction(); };
        }
    }, [animations, clonedScene]);

    useFrame((_, delta) => {
        if (mixerRef.current) mixerRef.current.update(delta);
        spinRef.current += position.spinSpeed * delta;

        if (groupRef.current) {
            groupRef.current.rotation.x = THREE.MathUtils.degToRad(position.rotX);
            groupRef.current.rotation.y = THREE.MathUtils.degToRad(position.rotY) + spinRef.current;
            groupRef.current.rotation.z = THREE.MathUtils.degToRad(position.rotZ);
        }
    });

    return (
        <group ref={groupRef} position={[position.x, position.y, position.z]}
            scale={[position.scale, position.scale, position.scale]}>
            <primitive object={clonedScene} />
        </group>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEPTUNE ATMOSPHERE GLOW — Fresnel-based rim glow shader
// ═══════════════════════════════════════════════════════════════════════════════
function NeptuneAtmosphereGlow({ position, scale }: { position: [number, number, number]; scale: number }) {
    const meshRef = useRef<THREE.Mesh>(null);

    const material = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uColor1: { value: new THREE.Color("#4488ff") },
            uColor2: { value: new THREE.Color("#88ccff") },
            uColor3: { value: new THREE.Color("#aaeeff") },
            uOpacity: { value: 0.65 },
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewDir;
            varying vec2 vUv;

            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewDir = normalize(-mvPosition.xyz);
                vUv = uv;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec3 uColor1, uColor2, uColor3;
            uniform float uOpacity;
            varying vec3 vNormal;
            varying vec3 vViewDir;
            varying vec2 vUv;

            void main() {
                // Fresnel — bright at edges, transparent at center
                float fresnel = 1.0 - abs(dot(vNormal, vViewDir));
                fresnel = pow(fresnel, 2.5);

                // Animated shimmer
                float shimmer = sin(uTime * 0.4 + vUv.y * 8.0) * 0.08 + 1.0;
                float shimmer2 = sin(uTime * 0.25 + vUv.x * 12.0) * 0.05 + 1.0;
                fresnel *= shimmer * shimmer2;

                // Layered color: deep edge → mid → bright core edge
                vec3 color = mix(uColor1, uColor2, fresnel);
                color = mix(color, uColor3, pow(fresnel, 3.0));

                // Slight intensity variation around the sphere
                float topGlow = smoothstep(-0.2, 0.5, vNormal.y) * 0.3 + 0.7;

                // Limit intensity to prevent Bloom NaNs/blowouts
                color = clamp(color, 0.0, 1.2);

                float alpha = fresnel * uOpacity * topGlow;
                alpha = clamp(alpha, 0.0, 0.8);

                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    }), []);

    useFrame(({ clock }) => {
        if (meshRef.current) {
            (material.uniforms.uTime as any).value = clock.getElapsedTime();
        }
    });

    // Slightly larger than the planet for atmospheric halo
    const glowScale = scale * 1.06;

    return (
        <mesh ref={meshRef} position={position} scale={[glowScale, glowScale, glowScale]} frustumCulled={false}>
            <sphereGeometry args={[1, 48, 48]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOD RAYS - Enhanced cinematic implementation with 3 layers
// ═══════════════════════════════════════════════════════════════════════════════
function NeptuneGodRays({ neptunePosition, tier = 2 }: { neptunePosition: [number, number, number]; tier?: 0 | 1 | 2 | 3 }) {
    const rayRef = useRef<THREE.Mesh>(null);
    const ray2Ref = useRef<THREE.Mesh>(null);
    const ray3Ref = useRef<THREE.Mesh>(null);
    const frameCountRef = useRef(0);

    // Tier-based plane sizes
    const planeSize1 = tier >= 2 ? 500 : 300;
    const planeSize2 = tier >= 2 ? 600 : 360;
    const planeSize3 = tier >= 2 ? 450 : 270;

    const godRayVertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const godRayFragmentShader = `
        uniform vec3 color1, color2;
        uniform float opacity, time;
        varying vec2 vUv;
        void main() {
            vec2 center = vUv - 0.5;
            float dist = length(center);
            float alpha = smoothstep(0.5, 0.0, dist) * opacity;
            float horizontal = smoothstep(0.5, 0.0, abs(center.y) * 2.0);
            alpha *= horizontal;
            float shimmer = sin(time * 0.5 + dist * 10.0) * 0.1 + 1.0;
            alpha *= shimmer;
            // Subtle streaks
            float streaks = sin(center.x * 20.0 + time * 0.3) * 0.05 + 1.0;
            alpha *= streaks;
            vec3 finalColor = mix(color1, color2, dist * 2.0);
            gl_FragColor = vec4(finalColor, alpha);
        }
    `;

    const rayMaterial = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            color1: { value: new THREE.Color("#aaddff") },
            color2: { value: new THREE.Color("#4488ff") },
            opacity: { value: 0.18 },
            time: { value: 0 },
        },
        vertexShader: godRayVertexShader,
        fragmentShader: godRayFragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    }), []);

    const ray2Material = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            color1: { value: new THREE.Color("#88bbff") },
            color2: { value: new THREE.Color("#2266dd") },
            opacity: { value: 0.10 },
            time: { value: 0 },
        },
        vertexShader: godRayVertexShader,
        fragmentShader: godRayFragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    }), []);

    // Third ray layer — slightly warm tint for color contrast
    const ray3Material = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            color1: { value: new THREE.Color("#99bbee") },
            color2: { value: new THREE.Color("#6688bb") },
            opacity: { value: 0.07 },
            time: { value: 0 },
        },
        vertexShader: godRayVertexShader,
        fragmentShader: godRayFragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    }), []);

    useFrame((state) => {
        frameCountRef.current++;
        // Throttle uniform updates to every 2 frames
        if (frameCountRef.current % 2 === 0) {
            const time = state.clock.elapsedTime;
            (rayMaterial.uniforms.time as any).value = time;
            (ray2Material.uniforms.time as any).value = time;
            (ray3Material.uniforms.time as any).value = time;

            if (rayRef.current) {
                const scale = 1.0 + Math.sin(time * 0.15) * 0.025;
                rayRef.current.scale.set(scale, scale * 0.3, 1);
            }
            if (ray2Ref.current) {
                const scale2 = 1.0 + Math.sin(time * 0.1 + 1) * 0.02;
                ray2Ref.current.scale.set(scale2, scale2 * 0.25, 1);
            }
            if (ray3Ref.current) {
                const scale3 = 1.0 + Math.sin(time * 0.12 + 2) * 0.018;
                ray3Ref.current.scale.set(scale3, scale3 * 0.2, 1);
            }
        }
    });

    return (
        <group position={[neptunePosition[0] + 100, neptunePosition[1], neptunePosition[2] - 150]}>
            <mesh ref={rayRef} rotation={[0, 0, 0.1]}>
                <planeGeometry args={[planeSize1, planeSize1]} />
                <primitive object={rayMaterial} attach="material" />
            </mesh>
            <mesh ref={ray2Ref} position={[50, 20, -20]} rotation={[0, 0, -0.05]}>
                <planeGeometry args={[planeSize2, planeSize2]} />
                <primitive object={ray2Material} attach="material" />
            </mesh>
            {/* Third angled ray layer — only on tier 2+ */}
            {tier >= 2 && (
                <mesh ref={ray3Ref} position={[-40, -30, 10]} rotation={[0, 0, 0.45]}>
                    <planeGeometry args={[planeSize3, planeSize3]} />
                    <primitive object={ray3Material} attach="material" />
                </mesh>
            )}
        </group>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCENE GROUP - Matching Scene 2's progressive loading pattern
// ═══════════════════════════════════════════════════════════════════════════════

export function Scene3Group({ tier }: { tier: 0 | 1 | 2 | 3 }) {
    const sceneOpacity = useDirectorSceneOpacity();
    const d = useScene3Debug();
    const opacity = sceneOpacity.scene3Opacity;

    // ═══════════════════════════════════════════════════════════════════════════
    // PROGRESSIVE LOADING - Phase in elements to spread GPU load
    // Matching Scene 2's 4-phase pattern exactly
    // ═══════════════════════════════════════════════════════════════════════════
    const [loadPhase, setLoadPhase] = useState(0);

    useEffect(() => {
        if (opacity < 0.01) {
            setLoadPhase(0);
            return;
        }

        // Phase 1: Immediately - Lighting + basic setup
        setLoadPhase(1);

        // Phase 2: 100ms - Background planet (unified with Scene 2 timing)
        const t1 = setTimeout(() => setLoadPhase(2), 100);

        // Phase 3: 300ms - Main planet + god rays
        const t2 = setTimeout(() => setLoadPhase(3), 300);

        // Phase 4: 500ms - Full scene
        const t3 = setTimeout(() => setLoadPhase(4), 500);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [opacity > 0.01]);

    // Optimization: Skip rendering when opacity is near zero
    if (opacity < 0.01) return null;

    return (
        <group>
            {/* ═══════════════════════════════════════════════════════════════════
                Phase 1+: Enhanced Lighting Setup
            ═══════════════════════════════════════════════════════════════════ */}
            {loadPhase >= 1 && (
                <>
                    <ambientLight intensity={d.lighting.ambient * opacity} color="#5566aa" />

                    {/* Hemisphere light — sky/ground ambient for depth */}
                    <hemisphereLight
                        color="#1a3a6a"
                        groundColor="#0a0a20"
                        intensity={0.8 * opacity}
                    />

                    {/* Main sun light - Essential for all tiers */}
                    <directionalLight
                        position={[d.lighting.sunX, d.lighting.sunY, d.lighting.sunZ]}
                        intensity={d.lighting.sunIntensity * opacity}
                        color="#ffffff"
                    />

                    {/* Warm key light from sun direction for 3-point separation */}
                    <directionalLight
                        position={[d.lighting.sunX * 0.8, d.lighting.sunY * 1.2, d.lighting.sunZ + 50]}
                        intensity={1.8 * opacity}
                        color="#e8e0ff"
                    />

                    {/* DRAMATIC LIGHTING - Only for High Tiers (Tier 2+) */}
                    {tier >= 2 && (
                        <>
                            {/* BACKLIGHT - dramatic bright rim on dark side */}
                            <pointLight
                                position={[d.neptune.x - 200, d.neptune.y + 20, d.neptune.z - 150]}
                                intensity={2.0 * opacity}
                                color="#3377cc"
                                distance={600}
                            />
                            {/* Side rim light — bright cyan edge */}
                            <pointLight
                                position={[d.neptune.x + 120, d.neptune.y + 60, d.neptune.z + 80]}
                                intensity={1.2 * opacity}
                                color="#88ccff"
                                distance={500}
                            />
                            {/* Fill from below — deep ocean blue */}
                            <pointLight
                                position={[d.neptune.x, d.neptune.y - 80, d.neptune.z + 100]}
                                intensity={0.7 * opacity}
                                color="#5588cc"
                                distance={400}
                            />
                            {/* Top-down accent — subtle white */}
                            <pointLight
                                position={[d.neptune.x + 50, d.neptune.y + 200, d.neptune.z - 50]}
                                intensity={0.5 * opacity}
                                color="#aabbdd"
                                distance={350}
                            />
                        </>
                    )}

                    {/* Tier 1 basic rim */}
                    {tier === 1 && (
                        <pointLight
                            position={[d.neptune.x - 150, d.neptune.y, d.neptune.z - 100]}
                            intensity={1.0 * opacity}
                            color="#4488cc"
                            distance={400}
                        />
                    )}
                </>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                Phase 2+: Background Planet (Neptune Limb) + Aurora Veil
            ═══════════════════════════════════════════════════════════════════ */}
            {loadPhase >= 2 && (
                <>
                    <Planet path={`${BASE_PATH}/models/neptuenlimp-draco.glb`} position={d.neptuneLimb} />
                    {tier >= 2 && <Scene3AuroraVeil />}
                </>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                Phase 3+: God Rays + Main Planet + Atmosphere Glow
            ═══════════════════════════════════════════════════════════════════ */}
            {loadPhase >= 3 && tier >= 1 && (
                <NeptuneGodRays neptunePosition={[d.neptune.x, d.neptune.y, d.neptune.z]} tier={tier} />
            )}

            {loadPhase >= 3 && (
                <>
                    <NeptunePlanet position={d.neptune} />
                    {/* Atmosphere Glow — Fresnel rim around Neptune */}
                    {tier >= 1 && (
                        <NeptuneAtmosphereGlow
                            position={[d.neptune.x, d.neptune.y, d.neptune.z]}
                            scale={d.neptune.scale}
                        />
                    )}
                </>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                Phase 4+: Full scene (fog, etc)
            ═══════════════════════════════════════════════════════════════════ */}
            {loadPhase >= 4 && (
                <>
                    <fog attach="fog" args={['#040812', 250, 900]} />
                    {/* Ice crystal particles — only tier 1+ */}
                    {tier >= 1 && <Scene3Atmosphere opacity={opacity} />}
                </>
            )}
        </group>
    );
}

// Preloads removed — Scene 3 assets are idle-preloaded via SceneClient after entry
