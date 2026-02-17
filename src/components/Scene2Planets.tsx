"use client";

import * as THREE from "three";
import { useRef, useMemo, Suspense, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { create } from "zustand";
import { useDirectorSceneOpacity } from "../lib/useDirector";
import { useLoreStore } from "../lib/useLoreStore";

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

            {/* ═══════════════════════════════════════════════════════════════════════════
                SATURN CONTROLS - Separate Body and Ring
            ═══════════════════════════════════════════════════════════════════════════ */}
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

            {/* ═══════════════════════════════════════════════════════════════════
                CAMERA FREEZE — Position camera manually to find ring angle
                Click Freeze to capture, use sliders to adjust, Copy to export
            ═══════════════════════════════════════════════════════════════════ */}
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

// Scene2CameraController REMOVED - was conflicting with CinematicCamera
// FOV is now controlled exclusively by CinematicCamera.tsx

// ═══════════════════════════════════════════════════════════════════════════════
// STAR SKYBOX - MATCHES SCENE 1 LOGIC EXACTLY
// ═══════════════════════════════════════════════════════════════════════════════
// Key insight from Scene 1: Fixed scale, follows camera, depthWrite=false, depthTest=false
// NO fovScale - that was broken. FOV is handled by CinematicCamera.

// CRITICAL: Scene 2's skybox must have HIGHER render order than Scene 1's (-99998 > -99999)
// This ensures it renders AFTER Scene 1's background and occludes it properly
const SKYBOX_SCALE = 500; // Fixed - was 10000 which exceeded camera far plane
const SKYBOX_OFFSET = { x: 0, y: 0, z: 0 };
const SKYBOX_RENDER_ORDER = -99998; // Higher than Scene 1's -99999 = renders after



function StarSkyboxContent() {
    const groupRef = useRef<THREE.Group>(null);
    const { scene: glbScene } = useGLTF("/models/starback.glb");
    const { camera } = useThree();
    // RE-ADDED: Debug store for slider controls
    const skybox = useScene2Debug((s) => s.skybox);

    // Clone and configure materials - EXACTLY like Scene 1's GlbBackground
    const clonedScene = useMemo(() => {
        const clone = glbScene.clone(true);
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                // Higher render order than Scene 1 = renders AFTER and occludes it
                mesh.renderOrder = SKYBOX_RENDER_ORDER;
                mesh.frustumCulled = false; // Never cull

                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                const newMaterials = materials.map((mat) => {
                    if (!mat) return mat;
                    const clonedMat = mat.clone();
                    // CRITICAL: These settings make it a proper skybox
                    clonedMat.side = THREE.BackSide; // Render inside of sphere
                    clonedMat.depthWrite = false; // Don't write to depth buffer
                    clonedMat.depthTest = false; // Don't test depth - always behind
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

    // Track accumulated spin separately from base rotY
    const spinAccumulator = useRef(0);

    // Position skybox at camera and apply rotation from debug
    useFrame((_, delta) => {
        if (!groupRef.current) return;
        // Follow camera
        groupRef.current.position.set(
            camera.position.x + SKYBOX_OFFSET.x,
            camera.position.y + SKYBOX_OFFSET.y,
            camera.position.z + SKYBOX_OFFSET.z
        );
        // Accumulate spin
        spinAccumulator.current += skybox.rotationSpeed * delta;
        // Apply rotation: base rotation from sliders + accumulated spin on Y
        groupRef.current.rotation.x = THREE.MathUtils.degToRad(skybox.rotX);
        groupRef.current.rotation.y = THREE.MathUtils.degToRad(skybox.rotY) + spinAccumulator.current;
        groupRef.current.rotation.z = THREE.MathUtils.degToRad(skybox.rotZ);
    });

    // FOV-based scale: Higher fovScale = skybox appears more distant (smaller)
    // This is a "fake FOV" that doesn't touch the actual camera
    // fovScale of 1 = normal, <1 = closer (zoomed in), >1 = farther (zoomed out)
    const fovMultiplier = Math.max(0.1, Math.min(skybox.fovScale, 10));
    // Base scale from Size slider, clamped to safe range
    const baseScale = Math.min(Math.max(skybox.scale, 100), 2000);
    // Final scale = base * fov multiplier
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
}





export function StarSkybox() {
    return (
        <Suspense fallback={null}>
            <StarSkyboxContent />
        </Suspense>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLANET COMPONENT - Generic planet with rotation + procedural spin
// ═══════════════════════════════════════════════════════════════════════════════

function Planet({ path, position }: { path: string; position: PlanetPosition }) {
    const groupRef = useRef<THREE.Group>(null);
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const spinRef = useRef(0); // Accumulated spin
    const { scene: glbScene, animations } = useGLTF(path);

    const clonedScene = useMemo(() => {
        const clone = glbScene.clone(true);
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.frustumCulled = false;
                // CRITICAL: Set renderOrder higher than skybox to render AFTER it
                mesh.renderOrder = 1;

                // Fix materials to prevent z-fighting with skybox
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                materials.forEach((mat) => {
                    if (mat) {
                        // Ensure proper depth testing for planets
                        mat.depthWrite = true;
                        mat.depthTest = true;
                        // Fix transparency sorting for rings
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

        // Accumulate spin
        spinRef.current += position.spinSpeed * delta;

        if (groupRef.current) {
            // Apply initial rotation + accumulated spin
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
// SATURN COMPONENT - Separate Body and Ring Rotation
// ═══════════════════════════════════════════════════════════════════════════════
// 
// KEY BEHAVIOR:
// - Saturn BODY spins slowly on its axis (bodySpinSpeed)
// - Saturn RINGS have a STATIC angle controlled via debug menu (ringTiltX, ringTiltZ)
// - Rings do NOT spin around Saturn - they are in a separate non-spinning container
//
// ARCHITECTURE:
// - Main group (position/scale) contains:
//   - Body group (spinning) - contains all non-ring meshes
//   - Ring group (static) - contains all ring meshes with only tilt angle
//
// ═══════════════════════════════════════════════════════════════════════════════


function Saturn({ settings, tier = 2 }: { settings: SaturnSettings; tier?: 0 | 1 | 2 | 3 }) {
    const mainGroupRef = useRef<THREE.Group>(null);
    const bodyGroupRef = useRef<THREE.Group>(null);
    const ringGroupRef = useRef<THREE.Group>(null);
    const ringSpinGroupRef = useRef<THREE.Group>(null);
    const atmosphereRef = useRef<THREE.Mesh>(null);
    const bodySpinRef = useRef(0); // Accumulated body spin
    const ringSpinRef = useRef(0); // Accumulated ring spin
    const frameCountRef = useRef(0); // PERF: Frame counter for throttled updates
    const { scene: glbScene } = useGLTF("/models/saturn2.glb");

    // ═══════════════════════════════════════════════════════════════════════════
    // ATMOSPHERIC FRESNEL SHADER - Creates limb glow + TERMINATOR SCATTERING
    // The terminator line (day/night boundary) gets a soft orange/red atmospheric glow
    // ═══════════════════════════════════════════════════════════════════════════
    const atmosphereMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                glowColor: { value: new THREE.Color("#ffeedd") },
                glowColor2: { value: new THREE.Color("#ff9944") },
                terminatorColor: { value: new THREE.Color("#ff6633") }, // Sunset red
                sunDirection: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() },
                intensity: { value: 0.6 },   // REDUCED from 1.2
                power: { value: 3.5 },
                opacity: { value: 0.2 },     // REDUCED from 0.4
                terminatorWidth: { value: 0.15 }, // Width of terminator glow band
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
                    
                    // Fresnel effect - stronger at edges
                    float fresnel = 1.0 - abs(dot(normal, viewDir));
                    fresnel = pow(fresnel, power) * intensity;
                    
                    // ═══════════════════════════════════════════════════════════════
                    // TERMINATOR SCATTERING - Sunset glow at day/night boundary
                    // ═══════════════════════════════════════════════════════════════
                    float sunDot = dot(worldNormal, sunDirection);
                    // The terminator is where sunDot ≈ 0 (perpendicular to sun)
                    float terminator = 1.0 - smoothstep(0.0, terminatorWidth, abs(sunDot));
                    // Only show terminator glow on the dark side edge
                    float darkSide = smoothstep(0.0, 0.1, -sunDot);
                    float terminatorGlow = terminator * fresnel * darkSide * 2.0;
                    
                    // Mix terminator color with base glow
                    vec3 baseColor = mix(glowColor, glowColor2, fresnel * 0.5);
                    vec3 finalColor = mix(baseColor, terminatorColor, terminatorGlow);
                    
                    // Boost alpha at terminator for visible effect
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

    // Clone scene and SEPARATE body meshes from ring meshes
    const { bodyScene, ringScene } = useMemo(() => {
        const bodyClone = glbScene.clone(true);
        const ringClone = new THREE.Group();
        const ringMeshesToRemove: THREE.Object3D[] = [];

        bodyClone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.frustumCulled = false;
                mesh.renderOrder = 1;

                // Fix materials - PREMIUM TUNING
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                materials.forEach((m) => {
                    const mat = m as any;
                    if (mat) {
                        mat.depthWrite = true;
                        mat.depthTest = true;

                        // High Quality Material Settings
                        mat.envMapIntensity = 2.5; // Strong reflections
                        mat.roughness = 0.4;       // Smooth but not mirror
                        mat.metalness = 0.6;       // Metallic sheen

                        if (mat.map) mat.map.anisotropy = 16;

                        if (mat.transparent) {
                            mat.alphaTest = 0.01;
                            // Rings need to be brighter/more reflective
                            mat.envMapIntensity = 3.0;
                            mat.roughness = 0.2;
                            mat.metalness = 0.8;
                        }
                        mat.needsUpdate = true;
                    }
                });

                const name = child.name.toLowerCase();
                const isRing = name.includes('ring') || name.includes('disc') || name.includes('band');

                if (isRing) {
                    // RINGS - High reflection, Icy
                    ringMeshesToRemove.push(child);

                    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                    materials.forEach((m) => {
                        const mat = m as any;
                        if (mat) {
                            // RINGS - High reflectivity for dramatic backlight catch
                            // Planet body has reduced settings, but rings can be shiny
                            mat.envMapIntensity = 4.0;  // High reflections for ring sparkle
                            mat.roughness = 0.1;        // Very smooth for specular
                            mat.metalness = 0.85;       // Highly metallic/icy
                            mat.transparent = true;
                            mat.alphaTest = 0.01;
                            mat.needsUpdate = true;
                        }
                    });

                } else {
                    // ═══════════════════════════════════════════════════════════════
                    // BODY - GAS GIANT MATERIAL
                    // Using MeshPhysicalMaterial properties for realistic atmosphere
                    // ═══════════════════════════════════════════════════════════════
                    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                    materials.forEach((m) => {
                        const mat = m as any;
                        if (mat) {
                            // Base material for gas giant - REDUCED reflections to prevent blow-out
                            mat.roughness = 0.85;          // More rough for less specular
                            mat.metalness = 0.02;          // Almost non-metallic (gas)
                            mat.envMapIntensity = 0.3;     // REDUCED from 0.8

                            // DISABLED sheen and clearcoat - they were adding extra brightness
                            if (mat.sheen !== undefined) {
                                mat.sheen = 0;             // DISABLED
                            }
                            if (mat.clearcoat !== undefined) {
                                mat.clearcoat = 0;         // DISABLED
                            }

                            // Ensure texture pops with correct color space
                            if (mat.map) {
                                mat.map.colorSpace = THREE.SRGBColorSpace;
                            }

                            mat.needsUpdate = true;
                        }
                    });
                }
            }
        });

        // Move ring meshes from body scene to ring scene
        ringMeshesToRemove.forEach((ringMesh) => {
            const ringCloneMesh = ringMesh.clone(true);
            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            const worldScale = new THREE.Vector3();
            ringMesh.getWorldPosition(worldPos);
            ringMesh.getWorldQuaternion(worldQuat);
            ringMesh.getWorldScale(worldScale);

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

        // ═══════════════════════════════════════════════════════════════════════
        // 1. BODY SPIN - Saturn body rotates slowly on its axis
        // ═══════════════════════════════════════════════════════════════════════
        bodySpinRef.current += settings.bodySpinSpeed * delta;

        // Apply body rotation including spin
        bodyGroupRef.current.rotation.x = THREE.MathUtils.degToRad(settings.rotX);
        bodyGroupRef.current.rotation.y = THREE.MathUtils.degToRad(settings.rotY) + bodySpinRef.current;
        bodyGroupRef.current.rotation.z = THREE.MathUtils.degToRad(settings.rotZ);

        // ═══════════════════════════════════════════════════════════════════════
        // 2. RING TILT - Static angle, NO spin (rings are in separate group)
        // ═══════════════════════════════════════════════════════════════════════
        ringGroupRef.current.rotation.x = THREE.MathUtils.degToRad(settings.rotX + settings.ringTiltX);
        ringGroupRef.current.rotation.y = THREE.MathUtils.degToRad(settings.rotY);
        ringGroupRef.current.rotation.z = THREE.MathUtils.degToRad(settings.rotZ + settings.ringTiltZ);

        // ═══════════════════════════════════════════════════════════════════════
        // 3. RING SPIN - Independent spin "in place"
        // ═══════════════════════════════════════════════════════════════════════
        if (ringSpinGroupRef.current) {
            ringSpinRef.current += settings.ringSpinSpeed * delta;
            ringSpinGroupRef.current.rotation.y = ringSpinRef.current;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 4. ATMOSPHERE - Match body rotation for seamless look
        // PERF: Throttle uniform updates to every 4 frames (pulse is slow anyway)
        // ═══════════════════════════════════════════════════════════════════════
        if (atmosphereRef.current) {
            atmosphereRef.current.rotation.copy(bodyGroupRef.current.rotation);

            // Only update uniform every 4 frames to avoid GPU pipeline flushes
            frameCountRef.current++;
            if (frameCountRef.current % 4 === 0) {
                const pulse = Math.sin(state.clock.elapsedTime * 0.3) * 0.1 + 1.0;
                (atmosphereMaterial.uniforms.intensity as any).value = 1.2 * pulse;
            }
        }
    });

    return (
        <group
            ref={mainGroupRef}
            position={[settings.x, settings.y, settings.z]}
            scale={[settings.scale, settings.scale, settings.scale]}
            onClick={(e) => {
                e.stopPropagation();
                const domEvent = e.nativeEvent;
                const cx = (domEvent as MouseEvent).clientX ?? window.innerWidth / 2;
                const cy = (domEvent as MouseEvent).clientY ?? window.innerHeight / 2;
                console.log('[LoreClick] Saturn clicked at', cx, cy);
                useLoreStore.getState().openLore('saturn', { x: cx, y: cy });
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'default'; }}
        >
            {/* Body group - SPINS */}
            <group ref={bodyGroupRef}>
                <primitive object={bodyScene} />
            </group>

            {/* ═══════════════════════════════════════════════════════════════════
                ATMOSPHERIC ENVELOPE - Fresnel glow for realistic limb effect
                PERF: Reduced from 64x64 to 32x32 segments (75% fewer triangles, identical visually)
            ═══════════════════════════════════════════════════════════════════ */}
            <mesh ref={atmosphereRef} scale={[1.03, 1.03, 1.03]}>
                <sphereGeometry args={[1, 32, 32]} />
                <primitive object={atmosphereMaterial} attach="material" />
            </mesh>

            {/* Ring group - STATIC TILT + INNER SPIN */}
            <group ref={ringGroupRef} position={[0, settings.ringOffsetY, 0]}>
                <group ref={ringSpinGroupRef}>
                    <primitive object={ringScene} />
                </group>
            </group>
        </group>
    );
}

// NOTE: RingGlints and RingShadow shaders were removed
// They were disabled due to black spots artifact (see Saturn component comments)
// If needed in future, restore from git history

// ═══════════════════════════════════════════════════════════════════════════════
// GOD RAYS - Fake volumetric light beams behind Saturn
// PERF: Tier-based plane sizing (120x120 on low tiers vs 200x200 on high)
// ═══════════════════════════════════════════════════════════════════════════════

function GodRays({ saturnPosition, tier = 2 }: { saturnPosition: [number, number, number]; tier?: 0 | 1 | 2 | 3 }) {
    const rayRef = useRef<THREE.Mesh>(null);
    const ray2Ref = useRef<THREE.Mesh>(null);
    const frameCountRef = useRef(0); // PERF: Frame counter for throttled updates

    // PERF: Tier-based plane sizes - lower tiers use smaller planes (64% fewer fragments)
    const planeSize1 = tier >= 2 ? 200 : 120;
    const planeSize2 = tier >= 2 ? 250 : 150;

    // Custom shader for radial god rays
    const rayMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                color1: { value: new THREE.Color("#fff8e0") },
                color2: { value: new THREE.Color("#ff9955") },
                opacity: { value: 0.12 },  // Restored for ring drama
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
                    // Radial gradient from center
                    vec2 center = vUv - 0.5;
                    float dist = length(center);
                    
                    // Soft radial falloff
                    float alpha = smoothstep(0.5, 0.0, dist) * opacity;
                    
                    // Anamorphic stretch - horizontal rays
                    float horizontal = smoothstep(0.5, 0.0, abs(center.y) * 2.0);
                    alpha *= horizontal;
                    
                    // Subtle shimmer
                    float shimmer = sin(time * 0.5 + dist * 10.0) * 0.1 + 1.0;
                    alpha *= shimmer;
                    
                    // Color gradient
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

    // Secondary ray material (slightly different color for depth)
    const ray2Material = useMemo(() => {
        const mat = rayMaterial.clone();
        (mat.uniforms.color1 as any).value = new THREE.Color("#ffeecc");
        (mat.uniforms.color2 as any).value = new THREE.Color("#ff7744");
        (mat.uniforms.opacity as any).value = 0.06;  // Restored for ring drama
        return mat;
    }, [rayMaterial]);

    useFrame((state) => {
        // PERF: Throttle updates to every 3 frames (breathing animation is slow anyway)
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
        <group position={[saturnPosition[0] + 50, saturnPosition[1], saturnPosition[2] - 100]}>
            {/* Primary god ray - tier-adaptive size */}
            <mesh ref={rayRef} rotation={[0, 0, Math.PI * 0.02]}>
                <planeGeometry args={[planeSize1, planeSize1]} />
                <primitive object={rayMaterial} attach="material" />
            </mesh>

            {/* Secondary god ray - tier-adaptive size */}
            <mesh ref={ray2Ref} position={[10, 5, -10]} rotation={[0, 0, -Math.PI * 0.01]}>
                <planeGeometry args={[planeSize2, planeSize2]} />
                <primitive object={ray2Material} attach="material" />
            </mesh>
        </group>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE 2 PLANETS GROUP
// ═══════════════════════════════════════════════════════════════════════════════

export function Scene2Planets({ opacity = 1, tier = 2 }: { opacity?: number; tier?: 0 | 1 | 2 | 3 }) {
    const d = useScene2Debug();
    if (opacity <= 0.01) return null;

    return (
        <group>
            <StarSkybox />
            {/* God rays behind Saturn for volumetric epic effect */}
            <GodRays saturnPosition={[d.saturn.x, d.saturn.y, d.saturn.z]} tier={tier} />
            {/* Saturn with separate body/ring rotation control */}
            <Saturn settings={d.saturn} tier={tier} />
        </group>
    );
}

// Preloads removed — Scene 2 assets are idle-preloaded via SceneClient after entry
