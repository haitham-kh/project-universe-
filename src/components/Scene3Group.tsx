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
// GOD RAYS - Matching Scene 2's GodRays implementation
// ═══════════════════════════════════════════════════════════════════════════════
function NeptuneGodRays({ neptunePosition, tier = 2 }: { neptunePosition: [number, number, number]; tier?: 0 | 1 | 2 | 3 }) {
    const rayRef = useRef<THREE.Mesh>(null);
    const ray2Ref = useRef<THREE.Mesh>(null);
    const frameCountRef = useRef(0);

    // Tier-based plane sizes - matching Scene 2
    const planeSize1 = tier >= 2 ? 400 : 240;
    const planeSize2 = tier >= 2 ? 500 : 300;

    const rayMaterial = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            color1: { value: new THREE.Color("#aaddff") },
            color2: { value: new THREE.Color("#4488ff") },
            opacity: { value: 0.12 },
            time: { value: 0 },
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
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
                vec3 finalColor = mix(color1, color2, dist * 2.0);
                gl_FragColor = vec4(finalColor, alpha);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    }), []);

    const ray2Material = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            color1: { value: new THREE.Color("#88bbff") },
            color2: { value: new THREE.Color("#2266dd") },
            opacity: { value: 0.06 },
            time: { value: 0 },
        },
        vertexShader: rayMaterial.vertexShader,
        fragmentShader: rayMaterial.fragmentShader,
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

            if (rayRef.current) {
                const scale = 1.0 + Math.sin(time * 0.15) * 0.02;
                rayRef.current.scale.set(scale, scale * 0.3, 1);
            }
            if (ray2Ref.current) {
                const scale2 = 1.0 + Math.sin(time * 0.1 + 1) * 0.015;
                ray2Ref.current.scale.set(scale2, scale2 * 0.25, 1);
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

        // Phase 2: 8ms - Background planet (unified with Scene 2 timing)
        const t1 = setTimeout(() => setLoadPhase(2), 8);

        // Phase 3: 50ms - Main planet + god rays
        const t2 = setTimeout(() => setLoadPhase(3), 50);

        // Phase 4: 150ms - Full scene
        const t3 = setTimeout(() => setLoadPhase(4), 150);

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
                Phase 1+: Lighting Setup
            ═══════════════════════════════════════════════════════════════════ */}
            {loadPhase >= 1 && (
                <>
                    <ambientLight intensity={d.lighting.ambient * opacity} color="#5566aa" />
                    {/* Main sun light */}
                    <directionalLight
                        position={[d.lighting.sunX, d.lighting.sunY, d.lighting.sunZ]}
                        intensity={d.lighting.sunIntensity * opacity}
                        color="#ffffff"
                    />
                    {/* BACKLIGHT - dramatic rim on dark side */}
                    <pointLight
                        position={[d.neptune.x - 150, d.neptune.y, d.neptune.z - 100]}
                        intensity={1.2 * opacity}
                        color="#4488cc"
                        distance={400}
                    />
                    {/* Side rim light */}
                    <pointLight
                        position={[d.neptune.x + 80, d.neptune.y + 40, d.neptune.z + 60]}
                        intensity={0.6 * opacity}
                        color="#aaccff"
                        distance={300}
                    />
                    {/* Subtle fill from below */}
                    <pointLight
                        position={[d.neptune.x, d.neptune.y - 50, d.neptune.z + 80]}
                        intensity={0.4 * opacity}
                        color="#88aadd"
                        distance={250}
                    />
                </>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                Phase 2+: Background Planet (Neptune Limb)
            ═══════════════════════════════════════════════════════════════════ */}
            {loadPhase >= 2 && (
                <Planet path={`${BASE_PATH}/models/neptuenlimp-draco.glb`} position={d.neptuneLimb} />
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                Phase 3+: God Rays + Main Planet
            ═══════════════════════════════════════════════════════════════════ */}
            {loadPhase >= 3 && tier >= 1 && (
                <NeptuneGodRays neptunePosition={[d.neptune.x, d.neptune.y, d.neptune.z]} tier={tier} />
            )}

            {loadPhase >= 3 && (
                <NeptunePlanet position={d.neptune} />
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                Phase 4+: Full scene (fog, etc)
            ═══════════════════════════════════════════════════════════════════ */}
            {loadPhase >= 4 && (
                <fog attach="fog" args={['#050810', 200, 800]} />
            )}
        </group>
    );
}

// Preloads removed — Scene 3 assets are idle-preloaded via SceneClient after entry
