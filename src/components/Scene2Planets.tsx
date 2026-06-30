"use client";

import * as THREE from "three";
import { useRef, useMemo, Suspense, useEffect, useState, memo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { create } from "zustand";
import { useDirectorSceneOpacity } from "../lib/useDirector";
import { useLoreStore } from "../lib/useLoreStore";
import { getModelPath } from "../lib/modelPaths";
import { useCompressedGLTF } from "../hooks/useCompressedGLTF";

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE 2 DEBUG STORE - Extended with Saturn Body/Ring Control
// ═══════════════════════════════════════════════════════════════════════════════
interface PlanetPosition {
    x: number;
    y: number;
    z: number;
    scale: number;
    spinSpeed: number;
    rotX: number; // Initial rotation
    rotY: number;
    rotZ: number;
}

// Extended Saturn with separate body/ring controls
interface SaturnSettings extends PlanetPosition {
    // Body spin (how fast Saturn body rotates on its axis)
    bodySpinSpeed: number;
    // Ring controls - static angle, NO spinning around Saturn
    ringTiltX: number;  // Ring plane tilt (pitch)
    ringTiltZ: number;  // Ring plane roll
    ringOffsetY: number; // Vertical offset for ring (if needed)
    ringSpinSpeed: number; // Independent ring spin
}

interface CameraSettings {
    x: number;
    y: number;
    z: number;
    fov: number;
}

interface SkyboxSettings {
    scale: number;
    rotationSpeed: number;
    fovScale: number;
    rotX: number;
    rotY: number;
    rotZ: number;
}

interface Scene2DebugState {
    earth: PlanetPosition;
    saturn: SaturnSettings;
    venus: PlanetPosition;
    skybox: SkyboxSettings;
    camera: CameraSettings;
    showDebug: boolean;
    // Camera freeze/override for finding the perfect skateEnd angle
    cameraFrozen: boolean;
    frozenCam: { camX: number; camY: number; camZ: number; lookX: number; lookY: number; lookZ: number };
    setEarth: (pos: Partial<PlanetPosition>) => void;
    setSaturn: (pos: Partial<SaturnSettings>) => void;
    setVenus: (pos: Partial<PlanetPosition>) => void;
    setSkybox: (val: Partial<SkyboxSettings>) => void;
    setCamera: (val: Partial<CameraSettings>) => void;
    toggleDebug: () => void;
    toggleCameraFrozen: () => void;
    setFrozenCam: (val: Partial<Scene2DebugState['frozenCam']>) => void;
    captureCam: (camX: number, camY: number, camZ: number, lookX: number, lookY: number, lookZ: number) => void;
}

const defaultPlanet = (x: number, y: number, z: number, scale: number, spin: number): PlanetPosition => ({
    x, y, z, scale, spinSpeed: spin, rotX: 0, rotY: 0, rotZ: 0
});

export const useScene2Debug = create<Scene2DebugState>((set) => ({
    // ═══════════════════════════════════════════════════════════════════════════════
    // LOCKED VALUES - User tuned 2026-01-11
    // ═══════════════════════════════════════════════════════════════════════════════
    earth: { x: -101, y: 26, z: -68, scale: 3.5, spinSpeed: 0.08, rotX: -9, rotY: -12, rotZ: 2 },
    saturn: {
        // Position & Scale
        x: -15, y: -32, z: -79, scale: 46,
        // Legacy (for compatibility) - NOT USED for spin anymore
        spinSpeed: 0, rotX: -163, rotY: -161, rotZ: -116,
        // NEW: Saturn BODY spin (slow rotation on axis)
        bodySpinSpeed: 0.07,
        // NEW: Saturn RING tilt (static angle, controllable via menu)
        ringTiltX: -39,   // Default ring tilt
        ringTiltZ: -83,    // Ring roll
        ringOffsetY: 0.1,  // Vertical offset
        ringSpinSpeed: 0.5, // Slow spin
    },
    venus: { x: 300, y: -100, z: -132, scale: 44.5, spinSpeed: 0.05, rotX: 0, rotY: 0, rotZ: 0 },
    skybox: { scale: 1250, rotationSpeed: 0, fovScale: 0.1, rotX: 115, rotY: 120, rotZ: 50 },
    camera: { x: -3, y: 0, z: 0, fov: 123 },
    showDebug: false,
    // Camera freeze defaults (will be overwritten when user clicks Freeze)
    cameraFrozen: false,
    frozenCam: { camX: -110, camY: -35, camZ: -60, lookX: -15, lookY: -32, lookZ: -79 },
    setEarth: (pos) => set((s) => ({ earth: { ...s.earth, ...pos } })),
    setSaturn: (pos) => set((s) => ({ saturn: { ...s.saturn, ...pos } })),
    setVenus: (pos) => set((s) => ({ venus: { ...s.venus, ...pos } })),
    setSkybox: (val) => set((s) => ({ skybox: { ...s.skybox, ...val } })),
    setCamera: (val) => set((s) => ({ camera: { ...s.camera, ...val } })),
    toggleDebug: () => set((s) => ({ showDebug: !s.showDebug })),
    toggleCameraFrozen: () => set((s) => ({ cameraFrozen: !s.cameraFrozen })),
    setFrozenCam: (val) => set((s) => ({ frozenCam: { ...s.frozenCam, ...val } })),
    captureCam: (camX, camY, camZ, lookX, lookY, lookZ) => set({ cameraFrozen: true, frozenCam: { camX, camY, camZ, lookX, lookY, lookZ } }),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// DEBUG MENU
// ═══════════════════════════════════════════════════════════════════════════════

function Slider({ label, value, onChange, min, max, step = 1 }: {
    label: string; value: number; onChange: (v: number) => void;
    min: number; max: number; step?: number;
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
            <span style={{ width: '28px', fontSize: '10px' }}>{label}:</span>
            <input type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))} style={{ flex: 1, height: '12px' }} />
            <input type="number" value={value.toFixed(step < 1 ? 2 : 0)}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                style={{ width: '45px', background: '#222', color: '#fff', border: '1px solid #444', fontSize: '9px', padding: '1px' }} />
        </div>
    );
}

function ObjectSliders({ name, emoji, pos, onChange }: {
    name: string; emoji: string; pos: PlanetPosition; onChange: (p: Partial<PlanetPosition>) => void;
}) {
    return (
        <div style={{ marginBottom: '8px', padding: '6px', background: '#1a1a1a', borderRadius: '4px' }}>
            <div style={{ color: '#8af', fontSize: '11px', marginBottom: '4px' }}>{emoji} {name}</div>
            <Slider label="X" value={pos.x} onChange={(v) => onChange({ x: v })} min={-300} max={300} />
            <Slider label="Y" value={pos.y} onChange={(v) => onChange({ y: v })} min={-300} max={300} />
            <Slider label="Z" value={pos.z} onChange={(v) => onChange({ z: v })} min={-500} max={100} />
            <Slider label="Size" value={pos.scale} onChange={(v) => onChange({ scale: v })} min={0.5} max={100} step={0.5} />
            <Slider label="Spin" value={pos.spinSpeed} onChange={(v) => onChange({ spinSpeed: v })} min={0} max={0.5} step={0.01} />
            <div style={{ color: '#fa8', fontSize: '9px', marginTop: '4px' }}>Rotation</div>
            <Slider label="rX" value={pos.rotX} onChange={(v) => onChange({ rotX: v })} min={-180} max={180} step={1} />
            <Slider label="rY" value={pos.rotY} onChange={(v) => onChange({ rotY: v })} min={-180} max={180} step={1} />
            <Slider label="rZ" value={pos.rotZ} onChange={(v) => onChange({ rotZ: v })} min={-180} max={180} step={1} />
        </div>
    );
}

export function Scene2DebugMenu() {
    const d = useScene2Debug();
    const [copied, setCopied] = useState(false);

    // Import scene opacity to make menu scene-aware
    const sceneOpacity = useDirectorSceneOpacity();

    // Only show in Scene 2
    if (sceneOpacity.scene2Opacity < 0.1) return null;

    const copyValues = () => {
        const values = {
            earth: d.earth,
            saturn: d.saturn,
            venus: d.venus,
            skybox: d.skybox,
            camera: d.camera,
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
            }}>Show Scene2 Debug</button>
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
                <strong style={{ fontSize: '12px' }}>Scene 2 Debug</strong>
                <button onClick={d.toggleDebug} style={{ background: '#444', border: 'none', color: '#fff', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}>Hide</button>
            </div>

            {/* Camera Controls */}
            <div style={{ marginBottom: '8px', padding: '6px', background: '#1a1a1a', borderRadius: '4px' }}>
                <div style={{ color: '#ff8', fontSize: '11px', marginBottom: '4px' }}>📷 Camera Offset</div>
                <Slider label="X" value={d.camera.x} onChange={(v) => d.setCamera({ x: v })} min={-50} max={50} step={1} />
                <Slider label="Y" value={d.camera.y} onChange={(v) => d.setCamera({ y: v })} min={-50} max={50} step={1} />
                <Slider label="Z" value={d.camera.z} onChange={(v) => d.setCamera({ z: v })} min={-100} max={100} step={1} />
                <Slider label="FOV" value={d.camera.fov} onChange={(v) => d.setCamera({ fov: v })} min={20} max={90} step={1} />
            </div>

            {/* Skybox/Starback Controls - Wide ranges */}
            <div style={{ marginBottom: '8px', padding: '6px', background: '#1a1a1a', borderRadius: '4px' }}>
                <div style={{ color: '#fa8', fontSize: '11px', marginBottom: '4px' }}>⭐ Starback</div>
                <Slider label="Size" value={d.skybox.scale} onChange={(v) => d.setSkybox({ scale: v })} min={100} max={2000} step={50} />
                <Slider label="Spin" value={d.skybox.rotationSpeed} onChange={(v) => d.setSkybox({ rotationSpeed: v })} min={0} max={0.2} step={0.005} />
                <Slider label="Zoom" value={d.skybox.fovScale} onChange={(v) => d.setSkybox({ fovScale: v })} min={0.1} max={5} step={0.1} />
                <div style={{ color: '#8af', fontSize: '9px', marginTop: '3px' }}>Rotation</div>
                <Slider label="rX" value={d.skybox.rotX} onChange={(v) => d.setSkybox({ rotX: v })} min={-180} max={180} step={5} />
                <Slider label="rY" value={d.skybox.rotY} onChange={(v) => d.setSkybox({ rotY: v })} min={-180} max={180} step={5} />
                <Slider label="rZ" value={d.skybox.rotZ} onChange={(v) => d.setSkybox({ rotZ: v })} min={-180} max={180} step={5} />
            </div>

            <ObjectSliders name="Earth" emoji="🌍" pos={d.earth} onChange={d.setEarth} />

            {/* Saturn Position Controls */}
            <div style={{ marginBottom: '8px', padding: '6px', background: '#1a1a1a', borderRadius: '4px' }}>
                <div style={{ color: '#8af', fontSize: '11px', marginBottom: '4px' }}>🪐 Saturn Position</div>
                <Slider label="X" value={d.saturn.x} onChange={(v) => d.setSaturn({ x: v })} min={-300} max={300} />
                <Slider label="Y" value={d.saturn.y} onChange={(v) => d.setSaturn({ y: v })} min={-300} max={300} />
                <Slider label="Z" value={d.saturn.z} onChange={(v) => d.setSaturn({ z: v })} min={-500} max={100} />
                <Slider label="Size" value={d.saturn.scale} onChange={(v) => d.setSaturn({ scale: v })} min={0.5} max={100} step={0.5} />

                {/* Saturn Body Rotation */}
                <div style={{ color: '#fa8', fontSize: '10px', marginTop: '6px', marginBottom: '3px', borderTop: '1px solid #333', paddingTop: '4px' }}>🌀 Body Rotation</div>
                <Slider label="Spin" value={d.saturn.bodySpinSpeed} onChange={(v) => d.setSaturn({ bodySpinSpeed: v })} min={0} max={0.5} step={0.01} />
                <Slider label="rX" value={d.saturn.rotX} onChange={(v) => d.setSaturn({ rotX: v })} min={-180} max={180} step={1} />
                <Slider label="rY" value={d.saturn.rotY} onChange={(v) => d.setSaturn({ rotY: v })} min={-180} max={180} step={1} />
                <Slider label="rZ" value={d.saturn.rotZ} onChange={(v) => d.setSaturn({ rotZ: v })} min={-180} max={180} step={1} />

                {/* Saturn Ring Controls */}
                <div style={{ color: '#ff8', fontSize: '10px', marginTop: '6px', marginBottom: '3px', borderTop: '1px solid #333', paddingTop: '4px' }}>💍 Ring Controls</div>
                <Slider label="Spin" value={d.saturn.ringSpinSpeed} onChange={(v) => d.setSaturn({ ringSpinSpeed: v })} min={-0.5} max={0.5} step={0.005} />
                <Slider label="Tilt X" value={d.saturn.ringTiltX} onChange={(v) => d.setSaturn({ ringTiltX: v })} min={-90} max={90} step={1} />
                <Slider label="Tilt Z" value={d.saturn.ringTiltZ} onChange={(v) => d.setSaturn({ ringTiltZ: v })} min={-90} max={90} step={1} />
                <Slider label="Offset Y" value={d.saturn.ringOffsetY} onChange={(v) => d.setSaturn({ ringOffsetY: v })} min={-5} max={5} step={0.1} />
            </div>

            <ObjectSliders name="Venus" emoji="🌕" pos={d.venus} onChange={d.setVenus} />

            {/* CAMERA FREEZE */}
            <div style={{ marginBottom: '8px', padding: '6px', background: '#1a0a0a', borderRadius: '4px', border: d.cameraFrozen ? '2px solid #f44' : '1px solid #333' }}>
                <div style={{ color: '#f88', fontSize: '11px', marginBottom: '4px' }}>📸 Camera Freeze (skateEnd finder)</div>
                <button
                    onClick={d.toggleCameraFrozen}
                    style={{
                        width: '100%', padding: '6px', marginBottom: '6px',
                        background: d.cameraFrozen ? '#f44' : '#444',
                        color: '#fff', border: 'none', borderRadius: '3px',
                        cursor: 'pointer', fontSize: '10px', fontWeight: 'bold',
                    }}
                >
                    {d.cameraFrozen ? '🔴 FROZEN — Camera under manual control' : '❄️ Freeze Camera at Current Position'}
                </button>
                {d.cameraFrozen && (
                    <>
                        <div style={{ color: '#fa8', fontSize: '9px', marginTop: '3px' }}>Position</div>
                        <Slider label="X" value={d.frozenCam.camX} onChange={(v) => d.setFrozenCam({ camX: v })} min={-300} max={300} step={1} />
                        <Slider label="Y" value={d.frozenCam.camY} onChange={(v) => d.setFrozenCam({ camY: v })} min={-300} max={300} step={1} />
                        <Slider label="Z" value={d.frozenCam.camZ} onChange={(v) => d.setFrozenCam({ camZ: v })} min={-300} max={300} step={1} />
                        <div style={{ color: '#8af', fontSize: '9px', marginTop: '3px' }}>LookAt Target</div>
                        <Slider label="lX" value={d.frozenCam.lookX} onChange={(v) => d.setFrozenCam({ lookX: v })} min={-300} max={300} step={1} />
                        <Slider label="lY" value={d.frozenCam.lookY} onChange={(v) => d.setFrozenCam({ lookY: v })} min={-300} max={300} step={1} />
                        <Slider label="lZ" value={d.frozenCam.lookZ} onChange={(v) => d.setFrozenCam({ lookZ: v })} min={-300} max={300} step={1} />
                        <button
                            onClick={() => {
                                const c = d.frozenCam;
                                const code = `skateEnd: new THREE.Vector3(${c.camX}, ${c.camY}, ${c.camZ}),\nlookAt.skateEnd: new THREE.Vector3(${c.lookX}, ${c.lookY}, ${c.lookZ}),`;
                                navigator.clipboard.writeText(code);
                            }}
                            style={{
                                marginTop: '6px', width: '100%', padding: '5px',
                                background: '#2a5', color: '#fff', border: 'none',
                                borderRadius: '3px', cursor: 'pointer', fontSize: '10px',
                            }}
                        >
                            📋 Copy skateEnd Code
                        </button>
                    </>
                )}
            </div>

            {/* Copy Values Button */}
            <button
                onClick={copyValues}
                style={{
                    marginTop: '10px',
                    width: '100%',
                    padding: '8px',
                    background: copied ? '#2a5' : '#444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 'bold',
                }}
            >
                {copied ? '✓ Copied!' : '📋 Copy All Values'}
            </button>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAR SKYBOX - MATCHES SCENE 1 LOGIC EXACTLY
// ═══════════════════════════════════════════════════════════════════════════════

const SKYBOX_SCALE = 500; 
const SKYBOX_OFFSET = { x: 0, y: 0, z: 0 };
const SKYBOX_RENDER_ORDER = -99998;

const StarSkyboxContent = memo(function StarSkyboxContent({ tier = 2 }: { tier?: 0 | 1 | 2 | 3 }) {
    const groupRef = useRef<THREE.Group>(null);
    const { scene: glbScene } = useCompressedGLTF(getModelPath("scene2Starback", tier));
    const { camera } = useThree();
    const skybox = useScene2Debug((s) => s.skybox);

    const clonedScene = useMemo(() => {
        const clone = glbScene.clone(true);
        clone.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.renderOrder = SKYBOX_RENDER_ORDER;
                mesh.frustumCulled = false;

                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                const newMaterials = materials.map((mat) => {
                    if (!mat) return mat;
                    const clonedMat = mat.clone();
                    clonedMat.side = THREE.BackSide;
                    clonedMat.depthWrite = false;
                    clonedMat.depthTest = false;
                    (clonedMat as any).fog = false;
                    (clonedMat as any).toneMapped = false;
                    clonedMat.needsUpdate = true;
                    return clonedMat;
                });
                mesh.material = Array.isArray(mesh.material) ? newMaterials : newMaterials[0];
            }
        });
        return clone;
    }, [glbScene]);

    const spinAccumulator = useRef(0);
    const rotXRad = useMemo(() => THREE.MathUtils.degToRad(skybox.rotX), [skybox.rotX]);
    const rotYRad = useMemo(() => THREE.MathUtils.degToRad(skybox.rotY), [skybox.rotY]);
    const rotZRad = useMemo(() => THREE.MathUtils.degToRad(skybox.rotZ), [skybox.rotZ]);

    useFrame((_, delta) => {
        if (!groupRef.current) return;
        groupRef.current.position.copy(camera.position);

        if (skybox.rotationSpeed > 0) {
            spinAccumulator.current += skybox.rotationSpeed * delta;
        }

        groupRef.current.rotation.set(
            rotXRad,
            rotYRad + spinAccumulator.current,
            rotZRad
        );
    });

    const fovMultiplier = Math.max(0.1, Math.min(skybox.fovScale, 10));
    const baseScale = Math.min(Math.max(skybox.scale, 100), 2000);
    const finalScale = baseScale * fovMultiplier;

    return (
        <group
            ref={groupRef}
            scale={[finalScale, finalScale, finalScale]}
            frustumCulled={false}
            renderOrder={SKYBOX_RENDER_ORDER}
        >
            <primitive object={clonedScene} />
        </group>
    );
});

export const StarSkybox = memo(function StarSkybox({ tier = 2 }: { tier?: 0 | 1 | 2 | 3 }) {
    return (
        <Suspense fallback={null}>
            <StarSkyboxContent tier={tier} />
        </Suspense>
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// PLANET COMPONENT - Generic planet with rotation + procedural spin
// ═══════════════════════════════════════════════════════════════════════════════

const Planet = memo(function Planet({ path, position }: { path: string; position: PlanetPosition }) {
    const groupRef = useRef<THREE.Group>(null);
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const spinRef = useRef(0);
    const { scene: glbScene, animations } = useCompressedGLTF(path);

    const clonedScene = useMemo(() => {
        const clone = glbScene.clone(true);
        clone.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.frustumCulled = false;
                mesh.renderOrder = 1;

                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                materials.forEach((mat) => {
                    if (mat) {
                        mat.depthWrite = true;
                        mat.depthTest = true;
                        if ((mat as any).transparent) {
                            (mat as any).alphaTest = 0.01;
                        }
                        mat.needsUpdate = true;
                    }
                });
            }
        });
        return clone;
    }, [glbScene]);

    const rotXRad = useMemo(() => THREE.MathUtils.degToRad(position.rotX), [position.rotX]);
    const rotYRad = useMemo(() => THREE.MathUtils.degToRad(position.rotY), [position.rotY]);
    const rotZRad = useMemo(() => THREE.MathUtils.degToRad(position.rotZ), [position.rotZ]);

    useEffect(() => {
        if (animations?.length) {
            const mixer = new THREE.AnimationMixer(clonedScene);
            mixerRef.current = mixer;
            animations.forEach((clip: THREE.AnimationClip) => mixer.clipAction(clip).play());
            return () => { mixer.stopAllAction(); };
        }
    }, [animations, clonedScene]);

    useFrame((_, delta) => {
        if (mixerRef.current) mixerRef.current.update(delta);
        spinRef.current += position.spinSpeed * delta;

        if (groupRef.current) {
            groupRef.current.rotation.set(
                rotXRad,
                rotYRad + spinRef.current,
                rotZRad
            );
        }
    });

    return (
        <group ref={groupRef} position={[position.x, position.y, position.z]}
            scale={[position.scale, position.scale, position.scale]}>
            <primitive object={clonedScene} />
        </group>
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// SATURN - Custom Component with Split Rotation and Original Materials Restored
// ═══════════════════════════════════════════════════════════════════════════════

const Saturn = memo(function Saturn({ settings, tier = 2 }: { settings: SaturnSettings; tier?: 0 | 1 | 2 | 3 }) {
    const mainGroupRef = useRef<THREE.Group>(null);
    const bodyGroupRef = useRef<THREE.Group>(null);
    const ringGroupRef = useRef<THREE.Group>(null);
    const ringSpinGroupRef = useRef<THREE.Group>(null);
    const atmosphereRef = useRef<THREE.Mesh>(null);
    const bodySpinRef = useRef(0);
    const ringSpinRef = useRef(0);
    const frameCountRef = useRef(0);
    const { scene: glbScene } = useCompressedGLTF(getModelPath("scene2Saturn", tier));

    const atmosphereMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                glowColor: { value: new THREE.Color("#ffeedd") },
                glowColor2: { value: new THREE.Color("#ff9944") },
                terminatorColor: { value: new THREE.Color("#ff6633") },
                sunDirection: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() },
                intensity: { value: 0.6 },
                power: { value: 3.5 },
                opacity: { value: 0.2 },
                terminatorWidth: { value: 0.15 },
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                varying vec3 vWorldNormal;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 glowColor;
                uniform vec3 glowColor2;
                uniform vec3 terminatorColor;
                uniform vec3 sunDirection;
                uniform float intensity;
                uniform float power;
                uniform float opacity;
                uniform float terminatorWidth;
                
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                varying vec3 vWorldNormal;
                
                void main() {
                    vec3 normal = normalize(vNormal);
                    vec3 worldNormal = normalize(vWorldNormal);
                    vec3 viewDir = normalize(vViewPosition);
                    
                    float fresnel = 1.0 - abs(dot(normal, viewDir));
                    fresnel = pow(fresnel, power) * intensity;
                    
                    float sunDot = dot(worldNormal, sunDirection);
                    float terminator = 1.0 - smoothstep(0.0, terminatorWidth, abs(sunDot));
                    float darkSide = smoothstep(0.0, 0.1, -sunDot);
                    float terminatorGlow = terminator * fresnel * darkSide * 2.0;
                    
                    vec3 baseColor = mix(glowColor, glowColor2, fresnel * 0.5);
                    vec3 finalColor = mix(baseColor, terminatorColor, terminatorGlow);
                    
                    float alpha = fresnel * opacity + terminatorGlow * 0.3;
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
    }, []);

    const radSettings = useMemo(() => {
        return {
            rotX: THREE.MathUtils.degToRad(settings.rotX),
            rotY: THREE.MathUtils.degToRad(settings.rotY),
            rotZ: THREE.MathUtils.degToRad(settings.rotZ),
            ringTiltX: THREE.MathUtils.degToRad(settings.rotX + settings.ringTiltX),
            ringTiltZ: THREE.MathUtils.degToRad(settings.rotZ + settings.ringTiltZ),
        };
    }, [settings.rotX, settings.rotY, settings.rotZ, settings.ringTiltX, settings.ringTiltZ]);

    const { bodyScene, ringScene } = useMemo(() => {
        const bodyClone = glbScene.clone(true);
        const ringClone = new THREE.Group();
        ringClone.name = "SaturnRings";

        const ringMeshes: THREE.Mesh[] = [];

        bodyClone.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.frustumCulled = false;
                mesh.renderOrder = 1;

                // Restored original premium materials configurations
                const name = child.name.toLowerCase();
                const isRing = name.includes('ring') || name.includes('disc') || name.includes('band');

                if (isRing) {
                    ringMeshes.push(mesh);
                } else {
                    // Gas Giant Planet Body
                    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                    materials.forEach((m) => {
                        const mat = m as any;
                        if (mat) {
                            mat.depthWrite = true;
                            mat.depthTest = true;

                            // Original physical settings
                            mat.roughness = 0.85;          // More rough for less specular
                            mat.metalness = 0.02;          // Almost non-metallic (gas)
                            mat.envMapIntensity = 0.3;     // Reduced from 0.8 to prevent blow-out

                            if (mat.sheen !== undefined) mat.sheen = 0;
                            if (mat.clearcoat !== undefined) mat.clearcoat = 0;

                            if (mat.map) {
                                mat.map.colorSpace = THREE.SRGBColorSpace;
                                mat.map.anisotropy = 16;
                            }
                            mat.needsUpdate = true;
                        }
                    });
                }
            }
        });

        // Re-construct and configure cloned ring meshes with original reflective materials
        ringMeshes.forEach((ringMesh) => {
            const ringCloneMesh = ringMesh.clone(true);
            
            const materials = Array.isArray(ringCloneMesh.material) ? ringCloneMesh.material : [ringCloneMesh.material];
            materials.forEach((m) => {
                const mat = m as any;
                if (mat) {
                    mat.depthWrite = true;
                    mat.depthTest = true;
                    mat.transparent = true;
                    mat.alphaTest = 0.01;

                    // Original icy reflective rings settings
                    mat.envMapIntensity = 4.0;
                    mat.roughness = 0.1;
                    mat.metalness = 0.85;
                    if (mat.map) mat.map.anisotropy = 16;
                    mat.needsUpdate = true;
                }
            });

            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            const worldScale = new THREE.Vector3();

            ringMesh.updateWorldMatrix(true, false);
            ringMesh.matrixWorld.decompose(worldPos, worldQuat, worldScale);

            ringCloneMesh.position.copy(worldPos);
            ringCloneMesh.quaternion.copy(worldQuat);
            ringCloneMesh.scale.copy(worldScale);

            ringClone.add(ringCloneMesh);

            if (ringMesh.parent) {
                ringMesh.parent.remove(ringMesh);
            }
        });

        return { bodyScene: bodyClone, ringScene: ringClone };
    }, [glbScene]);

    useFrame((state, delta) => {
        if (!bodyGroupRef.current || !ringGroupRef.current) return;

        bodySpinRef.current += settings.bodySpinSpeed * delta;

        bodyGroupRef.current.rotation.set(
            radSettings.rotX,
            radSettings.rotY + bodySpinRef.current,
            radSettings.rotZ
        );

        ringGroupRef.current.rotation.set(
            radSettings.ringTiltX,
            radSettings.rotY,
            radSettings.ringTiltZ
        );

        if (ringSpinGroupRef.current) {
            ringSpinRef.current += settings.ringSpinSpeed * delta;
            ringSpinGroupRef.current.rotation.y = ringSpinRef.current;
        }

        if (atmosphereRef.current) {
            atmosphereRef.current.rotation.copy(bodyGroupRef.current.rotation);

            frameCountRef.current++;
            if (frameCountRef.current % 4 === 0) {
                const pulse = Math.sin(state.clock.elapsedTime * 0.3) * 0.1 + 1.0;
                (atmosphereMaterial.uniforms.intensity as any).value = 1.2 * pulse;
            }
        }
    });

    return (
        <group ref={mainGroupRef} position={[settings.x, settings.y, settings.z]} scale={[settings.scale, settings.scale, settings.scale]}>
            <group ref={bodyGroupRef}>
                <primitive object={bodyScene} />
            </group>
            
            <mesh ref={atmosphereRef} scale={[1.03, 1.03, 1.03]}>
                <sphereGeometry args={[1, 32, 32]} />
                <primitive object={atmosphereMaterial} attach="material" />
            </mesh>

            <group ref={ringGroupRef} position={[0, settings.ringOffsetY, 0]}>
                <group ref={ringSpinGroupRef}>
                    <primitive object={ringScene} />
                </group>
            </group>
        </group>
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// GOD RAYS - Fake volumetric light beams behind Saturn
// ═══════════════════════════════════════════════════════════════════════════════

const GodRays = memo(function GodRays({ x, y, z, tier = 2 }: { x: number; y: number; z: number; tier?: 0 | 1 | 2 | 3 }) {
    const rayRef = useRef<THREE.Mesh>(null);
    const ray2Ref = useRef<THREE.Mesh>(null);
    const frameCountRef = useRef(0);

    const planeSize1 = tier >= 2 ? 200 : 120;
    const planeSize2 = tier >= 2 ? 250 : 150;
    const geom1 = useMemo(() => new THREE.PlaneGeometry(planeSize1, planeSize1), [planeSize1]);
    const geom2 = useMemo(() => new THREE.PlaneGeometry(planeSize2, planeSize2), [planeSize2]);

    const rayMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                color1: { value: new THREE.Color("#fff8e0") },
                color2: { value: new THREE.Color("#ff9955") },
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
                uniform vec3 color1;
                uniform vec3 color2;
                uniform float opacity;
                uniform float time;
                
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
        });
    }, []);

    const ray2Material = useMemo(() => {
        const mat = rayMaterial.clone();
        (mat.uniforms.color1 as any).value = new THREE.Color("#ffeecc");
        (mat.uniforms.color2 as any).value = new THREE.Color("#ff7744");
        (mat.uniforms.opacity as any).value = 0.06;
        return mat;
    }, [rayMaterial]);

    useFrame((state) => {
        frameCountRef.current++;
        if (frameCountRef.current % 3 !== 0) return;

        const time = state.clock.elapsedTime;

        if (rayRef.current) {
            (rayMaterial.uniforms.time as any).value = time;
            const scale = 1.0 + Math.sin(time * 0.2) * 0.05;
            rayRef.current.scale.set(scale, scale * 0.4, 1);
        }

        if (ray2Ref.current) {
            (ray2Material.uniforms.time as any).value = time + 1;
            const scale = 1.0 + Math.sin(time * 0.15 + 0.5) * 0.03;
            ray2Ref.current.scale.set(scale * 1.2, scale * 0.3, 1);
        }
    });

    return (
        <group position={[x + 50, y, z - 100]}>
            <mesh ref={rayRef} rotation={[0, 0, Math.PI * 0.02]} geometry={geom1}>
                <primitive object={rayMaterial} attach="material" />
            </mesh>

            <mesh ref={ray2Ref} position={[10, 5, -10]} rotation={[0, 0, -Math.PI * 0.01]} geometry={geom2}>
                <primitive object={ray2Material} attach="material" />
            </mesh>
        </group>
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE 2 PLANETS GROUP
// ═══════════════════════════════════════════════════════════════════════════════

export function Scene2Planets({ opacity = 1, tier = 2 }: { opacity?: number; tier?: 0 | 1 | 2 | 3 }) {
    const d = useScene2Debug();
    if (opacity <= 0.01) return null;

    return (
        <group>
            <StarSkybox tier={tier} />
            <GodRays x={d.saturn.x} y={d.saturn.y} z={d.saturn.z} tier={tier} />
            <Saturn settings={d.saturn} tier={tier} />
        </group>
    );
}
