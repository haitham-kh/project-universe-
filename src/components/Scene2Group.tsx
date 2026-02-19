"use client";

import * as THREE from "three";
import { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useDirectorSceneOpacity, useDirector } from "../lib/useDirector";
import { Scene2Background, useEarthTerminator } from "./Scene2Background";
import { Scene2Planets, useScene2Debug } from "./Scene2Planets";
import { create } from "zustand";
import { Scene2Atmosphere } from "./Scene2Effects";
import { FrameBudget } from "../lib/AssetOrchestrator";
import { Environment } from "@react-three/drei";
import { BASE_PATH } from "../lib/basePath";

// ═══════════════════════════════════════════════════════════════════════════════
// CINEMATIC LIGHTING - Saturn requires 360° lighting to prevent black rings
// ═══════════════════════════════════════════════════════════════════════════════

interface CinematicLightingState {
    ambient: number;
    keyIntensity: number;
    keyAngle: number;
    keyElevation: number;
    fillIntensity: number;
    backFillIntensity: number;
    rimIntensity: number;
    rimColor: string;
    venusSpotIntensity: number;
    // Saturn ring lights - surround lighting
    ringLightIntensity: number;
}

export const useCinematicLighting = create<CinematicLightingState>(() => ({
    // ═══════════════════════════════════════════════════════════════════════════
    // SATURN LIGHTING - Dramatic, cinematic, photorealistic
    // ═══════════════════════════════════════════════════════════════════════════
    ambient: 0.12,           // Slightly darker for more contrast
    keyIntensity: 1.5,       // REDUCED from 2.5 - was blowing out Saturn
    keyAngle: 55,            // Side angle for dramatic terminator line
    keyElevation: 25,        // Lower for longer shadows
    fillIntensity: 0.4,      // Reduced fill for more drama
    backFillIntensity: 2.5,  // REDUCED from 5.5 - was causing blown-out look
    rimIntensity: 2.0,       // REDUCED from 3.5
    rimColor: "#ffcc88",     // Warm golden rim
    venusSpotIntensity: 1.2,
    ringLightIntensity: 1.2, // REDUCED from 2.0
}));

// ═══════════════════════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function Slider({ label, value, onChange, min, max, step = 1 }: {
    label: string; value: number; onChange: (v: number) => void;
    min: number; max: number; step?: number;
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
            <span style={{ width: '55px', fontSize: '9px' }}>{label}:</span>
            <input type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))} style={{ flex: 1, height: '10px' }} />
            <span style={{ width: '30px', fontSize: '9px', textAlign: 'right' }}>{value.toFixed(step < 1 ? 2 : 0)}</span>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIER SELECTOR
// ═══════════════════════════════════════════════════════════════════════════════

const TIER_COLORS = ['#ef4444', '#eab308', '#22c55e', '#a855f7'];

export function Scene2TierSelector() {
    const sceneOpacity = useDirectorSceneOpacity();
    const tier = useDirector((s) => s.tier);
    const tierOverride = useDirector((s) => s.tierOverride);
    const setTierOverride = useDirector((s) => s.setTierOverride);
    const fsrEnabled = useDirector((s) => s.fsrEnabled);
    const setFsrEnabled = useDirector((s) => s.setFsrEnabled);

    if (sceneOpacity.scene2Opacity < 0.1) return null;
    const activeTier = tierOverride ?? tier;

    return (
        <div style={{
            position: 'fixed', top: '10px', left: '10px', zIndex: 9999,
            background: 'rgba(0,0,0,0.9)', padding: '8px', borderRadius: '8px',
            fontFamily: 'monospace', fontSize: '10px', color: '#fff',
            display: 'flex', alignItems: 'center', gap: '6px'
        }}>
            <span style={{ color: '#888' }}>Tier:</span>
            {[0, 1, 2, 3].map((t) => (
                <button key={t} onClick={() => setTierOverride(t as 0 | 1 | 2 | 3)} style={{
                    width: '22px', height: '22px', borderRadius: '4px', border: 'none',
                    background: activeTier === t ? TIER_COLORS[t] : '#333',
                    color: activeTier === t ? '#fff' : '#666',
                    cursor: 'pointer', fontWeight: 'bold', fontSize: '10px'
                }}>{t}</button>
            ))}
            <button onClick={() => setTierOverride(null)} style={{
                padding: '3px 6px', borderRadius: '4px', border: 'none',
                background: tierOverride === null ? '#22d3ee' : '#333',
                color: tierOverride === null ? '#000' : '#666', cursor: 'pointer', fontSize: '9px'
            }}>Auto</button>
            <button onClick={() => setFsrEnabled(!fsrEnabled)} style={{
                padding: '3px 6px', borderRadius: '4px', border: 'none',
                background: fsrEnabled ? '#a855f7' : '#333',
                color: fsrEnabled ? '#fff' : '#666', cursor: 'pointer', fontSize: '9px'
            }}>FSR</button>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EARTH SEAM MENU
// ═══════════════════════════════════════════════════════════════════════════════

export function EarthSeamMenu() {
    const sceneOpacity = useDirectorSceneOpacity();
    const [showMenu, setShowMenu] = useState(false);
    const [copied, setCopied] = useState(false);
    const { earth, setEarth } = useEarthTerminator();

    const copyValues = () => {
        navigator.clipboard.writeText(JSON.stringify(earth, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (sceneOpacity.scene2Opacity < 0.1) return null;

    if (!showMenu) {
        return (
            <button onClick={() => setShowMenu(true)} style={{
                position: 'fixed', bottom: '10px', left: '10px', zIndex: 9999,
                padding: '6px 12px', background: '#333', color: '#fff', border: 'none',
                borderRadius: '6px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '11px'
            }}>🌍 Earth</button>
        );
    }

    return (
        <div style={{
            position: 'fixed', bottom: '10px', left: '10px', zIndex: 9999,
            background: 'rgba(0,0,0,0.95)', color: '#fff', padding: '10px',
            borderRadius: '8px', fontFamily: 'monospace', fontSize: '9px', width: '200px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <strong style={{ fontSize: '11px' }}>🌍 Earth</strong>
                <button onClick={() => setShowMenu(false)} style={{ background: '#444', border: 'none', color: '#fff', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer' }}>×</button>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', cursor: 'pointer' }}>
                <input type="checkbox" checked={earth.enabled} onChange={(e) => setEarth({ enabled: e.target.checked })} />
                <span style={{ color: earth.enabled ? '#4f4' : '#888' }}>{earth.enabled ? 'ON' : 'OFF'}</span>
            </label>

            {earth.enabled && (
                <>
                    <Slider label="Angle" value={earth.seamAngle} onChange={(v) => setEarth({ seamAngle: v })} min={0} max={360} step={5} />
                    <Slider label="Width" value={earth.darkWidth} onChange={(v) => setEarth({ darkWidth: v })} min={0.1} max={0.9} step={0.05} />
                    <Slider label="Dark" value={earth.nightDarkness} onChange={(v) => setEarth({ nightDarkness: v })} min={0} max={0.3} step={0.01} />
                    <button onClick={copyValues} style={{
                        marginTop: '4px', width: '100%', padding: '4px',
                        background: copied ? '#2a5' : '#444', color: '#fff', border: 'none',
                        borderRadius: '4px', cursor: 'pointer', fontSize: '9px'
                    }}>{copied ? '✓' : '📋'}</button>
                </>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIGHTING MENU
// ═══════════════════════════════════════════════════════════════════════════════

export function Scene2LightingMenu() {
    const sceneOpacity = useDirectorSceneOpacity();
    const [showMenu, setShowMenu] = useState(false);
    const light = useCinematicLighting();

    if (sceneOpacity.scene2Opacity < 0.1) return null;

    if (!showMenu) {
        return (
            <button onClick={() => setShowMenu(true)} style={{
                position: 'fixed', top: '50px', left: '10px', zIndex: 9999,
                padding: '6px 12px', background: '#333', color: '#fff', border: 'none',
                borderRadius: '6px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '11px'
            }}>☀️ Light</button>
        );
    }

    return (
        <div style={{
            position: 'fixed', top: '50px', left: '10px', zIndex: 9999,
            background: 'rgba(0,0,0,0.95)', color: '#fff', padding: '10px',
            borderRadius: '8px', fontFamily: 'monospace', fontSize: '9px', width: '180px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <strong style={{ fontSize: '10px' }}>☀️ Cinematic</strong>
                <button onClick={() => setShowMenu(false)} style={{ background: '#444', border: 'none', color: '#fff', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer' }}>×</button>
            </div>

            <Slider label="Ambient" value={light.ambient} onChange={(v) => useCinematicLighting.setState({ ambient: v })} min={0} max={0.5} step={0.02} />
            <Slider label="Key" value={light.keyIntensity} onChange={(v) => useCinematicLighting.setState({ keyIntensity: v })} min={0} max={6} step={0.2} />
            <Slider label="Fill" value={light.fillIntensity} onChange={(v) => useCinematicLighting.setState({ fillIntensity: v })} min={0} max={4} step={0.1} />
            <Slider label="Back" value={light.backFillIntensity} onChange={(v) => useCinematicLighting.setState({ backFillIntensity: v })} min={0} max={3} step={0.1} />
            <Slider label="Rim" value={light.rimIntensity} onChange={(v) => useCinematicLighting.setState({ rimIntensity: v })} min={0} max={4} step={0.2} />
            <div style={{ color: '#fa8', fontSize: '8px', marginTop: '4px' }}>Saturn Rings</div>
            <Slider label="RingLight" value={light.ringLightIntensity} onChange={(v) => useCinematicLighting.setState({ ringLightIntensity: v })} min={0} max={5} step={0.2} />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE 2 GROUP - Multi-angle Saturn lighting to prevent black rings
// ═══════════════════════════════════════════════════════════════════════════════

interface Scene2GroupProps {
    tier: 0 | 1 | 2 | 3;
}

export function Scene2Group({ tier }: Scene2GroupProps) {
    const sceneOpacity = useDirectorSceneOpacity();
    const opacity = sceneOpacity.scene2Opacity;
    const light = useCinematicLighting();
    const saturn = useScene2Debug((s) => s.saturn);
    const venus = useScene2Debug((s) => s.venus);

    // ═══════════════════════════════════════════════════════════════════════════
    // PROGRESSIVE LOADING - Phase in elements to spread GPU load
    // ═══════════════════════════════════════════════════════════════════════════
    const [loadPhase, setLoadPhase] = useState(0);

    useEffect(() => {
        if (opacity < 0.01) {
            setLoadPhase(0);
            return;
        }

        // Phase 1: Immediately - Skybox + basic lighting
        setLoadPhase(1);

        // Phase 2: 100ms - Saturn (hero)
        const t1 = setTimeout(() => setLoadPhase(2), 100);

        // Phase 3: 250ms - Venus + particles
        const t2 = setTimeout(() => setLoadPhase(3), 250);

        // Phase 4: 400ms - Full ring lighting
        const t3 = setTimeout(() => setLoadPhase(4), 400);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [opacity > 0.01]);

    // IMPORTANT: All hooks MUST be called before any early return!
    // Ring light positions - TIER-BASED: fewer lights on lower tiers
    const ringRadius = 80;
    const ringAngles = tier >= 2
        ? [0, 60, 120, 180, 240, 300]  // 6 lights on Tier 2-3
        : [0, 120, 240];               // 3 lights on Tier 0-1

    const ringLights = useMemo(() => ringAngles.map((angle) => {
        const rad = THREE.MathUtils.degToRad(angle);
        return {
            x: saturn.x + Math.cos(rad) * ringRadius,
            y: saturn.y,
            z: saturn.z + Math.sin(rad) * ringRadius,
        };
    }), [saturn.x, saturn.y, saturn.z, tier]);

    // NEW: Target object for directional lights to ensure they always point AT Saturn
    // This fixes the "offset sun" issue where lights pointed at (0,0,0) missed the planet
    const targetObject = useMemo(() => {
        const obj = new THREE.Object3D();
        obj.position.set(saturn.x, saturn.y, saturn.z);
        return obj;
    }, [saturn.x, saturn.y, saturn.z]);

    // OPTIMIZATION: FRUSTUM/VISIBILITY CULLING
    // Skip rendering the entire group when opacity is near zero
    // This saves huge GPU resources when the scene is off-screen
    if (opacity <= 0.01) return null;

    // Key light position (not a hook, just computed values)
    const keyAngleRad = THREE.MathUtils.degToRad(light.keyAngle);
    const keyElevRad = THREE.MathUtils.degToRad(light.keyElevation);
    const keyDistance = 200;
    const keyX = Math.sin(keyAngleRad) * Math.cos(keyElevRad) * keyDistance;
    const keyY = Math.sin(keyElevRad) * keyDistance;
    const keyZ = Math.cos(keyAngleRad) * Math.cos(keyElevRad) * keyDistance;

    return (
        <group>
            {/* Phase 1+: Always load skybox first */}
            {loadPhase >= 1 && (
                <>
                    <Scene2Background tier={tier} opacity={opacity} />
                    {/* PREMIUM REFLECTIONS - REDUCED to prevent blow-out */}
                    <Environment files={`${BASE_PATH}/hdr/moon_lab_1k.hdr`} environmentIntensity={0.4 * opacity} />
                </>
            )}

            {/* Phase 2+: Saturn hero element */}
            {loadPhase >= 2 && <Scene2Planets opacity={opacity} tier={tier} />}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* HEMISPHERE LIGHT - Ethereal ambient gradient */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <hemisphereLight
                color="#ffeedd"         // Warm sky
                groundColor="#221810"   // Dark warm ground
                intensity={light.ambient * opacity * 2}
            />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* KEY LIGHT - Soft, diffuse sun */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <primitive object={targetObject} />
            <directionalLight
                position={[keyX, keyY, keyZ]}
                intensity={light.keyIntensity * opacity}
                color="#fff8e8"  // Soft warm light
                target={targetObject}
            />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* FILL LIGHT - Soft warm fill */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <directionalLight
                position={[-keyX * 0.5, keyY * 0.4, -keyZ * 0.5]}
                intensity={light.fillIntensity * opacity}
                color="#ffe8d0"  // Warm cream
                target={targetObject}
            />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ★★★ EPIC RING BACKLIGHT - THE KEY TO THE GLORIOUS LOOK ★★★ */}
            {/* Point lights positioned at GRAZING ANGLES to the ring plane */}
            {/* This creates the streak effect as light catches the ring edges */}
            {/* ═══════════════════════════════════════════════════════════════ */}

            {/* Main backlight - BEHIND and BELOW (grazes ring from underneath) */}
            <pointLight
                position={[saturn.x + 60, saturn.y - 40, saturn.z - 150]}
                intensity={light.backFillIntensity * opacity * 2}
                color="#ffeebb"  // Warm golden
                distance={500}
                decay={1.5}
            />

            {/* Secondary backlight - BEHIND and ABOVE (grazes ring from top) */}
            <pointLight
                position={[saturn.x - 50, saturn.y + 50, saturn.z - 130]}
                intensity={light.backFillIntensity * opacity * 1.5}
                color="#fff0cc"  // Softer gold
                distance={450}
                decay={1.5}
            />

            {/* Ring plane grazing light - at ring level for maximum specular */}
            <pointLight
                position={[saturn.x + 100, saturn.y, saturn.z - 80]}
                intensity={light.backFillIntensity * opacity * 1.2}
                color="#ffe8aa"
                distance={400}
                decay={1.5}
            />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* RING SURROUND LIGHTS - Gentle fill */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {ringLights.map((pos, i) => (
                <pointLight
                    key={`ring-${i}`}
                    position={[pos.x, pos.y, pos.z]}
                    intensity={light.ringLightIntensity * opacity * 0.3}
                    color="#fff0e0"
                    distance={160}
                    decay={1.8}
                />
            ))}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* RIM HIGHLIGHT - Soft golden edge */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <pointLight
                position={[saturn.x - 70, saturn.y + 20, saturn.z - 60]}
                intensity={light.rimIntensity * opacity}
                color={light.rimColor}
                distance={180}
                decay={2.0}
            />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* VENUS SPOTLIGHT */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <pointLight
                position={[venus.x - 30, venus.y + 15, venus.z + 30]}
                intensity={light.venusSpotIntensity * opacity}
                color="#ffeedd"
                distance={200}
                decay={1.5}
            />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* RING BOUNCE LIGHT - Light reflecting off rings to planet underside */}
            {/* Simulates the golden glow of ring particles illuminating Saturn */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <pointLight
                position={[saturn.x, saturn.y - 40, saturn.z + 15]}
                intensity={light.ringLightIntensity * opacity * 0.8}
                color="#ffe4b5"
                distance={100}
                decay={2.2}
            />
            <pointLight
                position={[saturn.x + 20, saturn.y - 35, saturn.z - 10]}
                intensity={light.ringLightIntensity * opacity * 0.5}
                color="#ffd699"
                distance={80}
                decay={2.0}
            />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ATMOSPHERIC DUST + DEPTH FOG */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {loadPhase >= 3 && <Scene2Atmosphere opacity={opacity} />}
            <fog attach="fog" args={['#0a0805', 150, 600]} />
        </group>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSITION FLASH
// ═══════════════════════════════════════════════════════════════════════════════

export function TransitionFlash() {
    const sceneOpacity = useDirectorSceneOpacity();
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame(({ camera }) => {
        if (!meshRef.current) return;
        meshRef.current.position.copy(camera.position);
        meshRef.current.quaternion.copy(camera.quaternion);
        meshRef.current.translateZ(-0.3); // Closer to camera for full coverage
        const mat = meshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = sceneOpacity.transitionFlash * 0.95;
    });

    if (sceneOpacity.transitionFlash <= 0.01) return null;

    return (
        <mesh ref={meshRef} renderOrder={9999}>
            <planeGeometry args={[200, 200]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={sceneOpacity.transitionFlash * 0.95} depthTest={false} depthWrite={false} />
        </mesh>
    );
}
