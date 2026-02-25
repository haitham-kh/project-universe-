"use client";

import * as THREE from "three";
import { useMemo, useRef, Suspense, useEffect } from "react";
import { Group } from "three";
import { useFrame, useThree, useLoader } from "@react-three/fiber";
import { Environment, useScroll } from "@react-three/drei";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { smoothstep } from "../lib/motionMath";
import { log } from "../lib/logger";
import { useLoreStore } from "../lib/useLoreStore";
import { BASE_PATH } from "../lib/basePath";
import { getModelPath } from "../lib/modelPaths";
import { useCompressedGLTF, usePreloadCompressedGLTF } from "../hooks/useCompressedGLTF";


// ═══════════════════════════════════════════════════════════════════════════════
// HERO SHIP - Parker Solar Probe
// Clean implementation: normalize a DETACHED clone, not the mounted cached scene
// ═══════════════════════════════════════════════════════════════════════════════

const NORMALIZE_TARGET = 14.0;

// ⚠️ LOCKED SHIP VALUES - Final position at scroll = 0
// 👇 LINE 26: baseScale controls final ship size - adjust this value to tune
const SHIP_CONFIG = {
    x: -15.42,
    y: -1.12,
    z: -32.73,
    rotX: -6.283,
    rotY: 0.870,
    rotZ: -6.283,
    baseScale: 75.90,  // ← 👈 CHANGE THIS VALUE to tune ship size (range: 20-150)
};

const IDLE_ROTATION_SPEED = 0.015;

// ═══════════════════════════════════════════════════════════════════════════════
// NORMALIZE FUNCTION - Computes bounds on DETACHED object (no parent influence)
// ═══════════════════════════════════════════════════════════════════════════════
function makeNormalizedClone(rawScene: THREE.Object3D): THREE.Object3D {
    const clone = rawScene.clone(true);

    // Ensure local identity BEFORE measuring
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.scale.set(1, 1, 1);
    clone.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    const s = NORMALIZE_TARGET / maxDim;

    // Center it at origin in normalized space
    clone.position.copy(center).multiplyScalar(-s);
    clone.scale.setScalar(s);
    clone.updateWorldMatrix(true, true);

    log("[HeroShip] Normalized clone. NORMALIZE_TARGET =", NORMALIZE_TARGET, "maxDim =", maxDim.toFixed(2), "scale =", s.toFixed(4));

    return clone;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHIP WITH GLB - Main component
// ═══════════════════════════════════════════════════════════════════════════════
type Props = {
    tier: 0 | 1 | 2 | 3;
};

function ShipWithGLB({ tier }: Props) {
    const rig = useRef<Group>(null!);
    const model = useRef<Group>(null!);
    const { gl } = useThree();
    const scroll = useScroll();

    const { scene: raw } = useCompressedGLTF(getModelPath("scene1HeroShip", tier)) as any;

    // ✅ Normalized clone is computed BEFORE parenting (in useMemo, not useEffect)
    const scene = useMemo(() => makeNormalizedClone(raw), [raw]);

    const tmp = useMemo(() => new THREE.Vector3(), []);

    // HDR environment: Each tier should look BETTER with richer reflections
    // Tier 2/3 get boosted envMap to make metallics shine more
    const envIntensity = tier === 3 ? 0.35 : tier === 2 ? 0.28 : tier === 1 ? 0.20 : 0.12;

    // Material configuration
    useEffect(() => {
        const maxAniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
        const bboxSize = new THREE.Vector3();

        scene.traverse((child: any) => {
            // Hide Line helpers
            if (child.type === "Line" || child.type === "LineSegments" || child.type === "LineLoop") {
                child.visible = false;
                return;
            }

            if (!child.isMesh) return;

            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;

            let isThinGeometry = false;
            if (child.geometry) {
                if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
                if (child.geometry.boundingBox) {
                    bboxSize
                        .copy(child.geometry.boundingBox.max)
                        .sub(child.geometry.boundingBox.min);
                    const dims = [Math.abs(bboxSize.x), Math.abs(bboxSize.y), Math.abs(bboxSize.z)].sort((a, b) => a - b);
                    const minDim = dims[0];
                    const maxDim = dims[2];
                    const safeMinDim = Math.max(minDim, 1e-5);
                    const thinRatio = maxDim / safeMinDim;
                    // Keep this narrow: only true rod/cable-like geometry should get special handling.
                    isThinGeometry = thinRatio > 90 || (minDim < 0.004 && maxDim > 0.6);
                }
            }

            if (!child.material) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];

            mats.forEach((m: any) => {
                m.wireframe = false;
                m.toneMapped = true;

                const matName = m.name || "";

                // ═══════════════════════════════════════════════════════════════
                // MATERIAL-SPECIFIC OVERRIDES - Based on GLB material analysis
                // ═══════════════════════════════════════════════════════════════

                // FOIL MATERIALS - Highly reflective metallic wrapping
                if (matName === "foil_silver") {
                    m.metalness = 0.98;
                    m.roughness = 0.13;  // Very smooth for mirror-like reflections
                    m.envMapIntensity = 2.35;
                    m.color = new THREE.Color("#e8e8f0");  // Slight cool tint
                }
                // BASE METAL - Structural aluminum/titanium
                else if (matName === "base_metal") {
                    m.metalness = 0.9;
                    m.roughness = 0.3;  // Slightly rougher industrial metal
                    m.envMapIntensity = 1.75;
                    m.color = new THREE.Color("#c8c8d0");  // Neutral metal
                }
                // ANTENNA FOIL - High-gain antenna reflective surface
                else if (matName === "foil_antenna") {
                    // Keep realistic reflectance but avoid extreme sparkle.
                    m.metalness = 0.9;
                    m.roughness = 0.2;
                    m.envMapIntensity = 2.1;
                    m.color = new THREE.Color("#ffffff");
                }
                // BLACK MATTE - Heat-absorbing surfaces
                else if (matName === "black_matte") {
                    m.metalness = 0.02;
                    m.roughness = 0.92;  // Very matte
                    m.color = new THREE.Color("#080810");  // Deep black with slight blue
                    m.envMapIntensity = 0.15;
                }
                // BLACK KRINKLE - Textured thermal coating
                else if (matName === "black_krinkle") {
                    m.metalness = 0.08;
                    m.roughness = 0.85;  // Textured surface
                    m.color = new THREE.Color("#0a0a14");  // Dark with texture
                    m.envMapIntensity = 0.25;
                }
                // PSP - Hot solar panel with thermal properties
                else if (matName === "PSP") {
                    m.metalness = 0.15;
                    m.roughness = 0.45;
                    m.envMapIntensity = 0.8;
                }
                // SHINY PANEL - Solar cell surface
                else if (matName === "shiny_panel") {
                    m.metalness = 0.75;
                    m.roughness = 0.18;  // Glossy solar panel surface
                    m.envMapIntensity = 1.8;
                    m.color = new THREE.Color("#1a1a2a");  // Dark blue-ish solar cell
                }
                // DEFAULT - Catch any unhandled materials
                else {
                    if (m.metalness !== undefined) {
                        m.metalness = Math.max(0.1, Math.min(0.85, m.metalness));
                    }
                    if (m.roughness !== undefined) {
                        m.roughness = Math.max(0.22, Math.min(0.7, m.roughness));
                    }
                    m.envMapIntensity = 1.0;
                }

                if (isThinGeometry) {
                    // Mild anti-shimmer constraints only for true sub-pixel parts.
                    m.roughness = Math.max(m.roughness ?? 0.35, 0.32);
                    m.metalness = Math.min(m.metalness ?? 0.75, 0.88);
                    m.envMapIntensity = Math.min(m.envMapIntensity ?? 1.0, 1.8);
                    if ("dithering" in m) m.dithering = true;
                    if (m.normalScale && typeof m.normalScale.setScalar === "function") {
                        m.normalScale.setScalar(0.2);
                    }
                }

                // Texture settings
                ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap"].forEach(k => {
                    const tex = m[k];
                    if (tex) {
                        tex.anisotropy = maxAniso;
                        if (k === "map") tex.colorSpace = THREE.SRGBColorSpace;
                        tex.needsUpdate = true;
                    }
                });

                // Proper depth rendering
                m.depthTest = true;
                m.depthWrite = true;
                m.transparent = false;
                m.needsUpdate = true;
            });

            child.renderOrder = 1;
        });
    }, [scene, gl]);



    // ═══════════════════════════════════════════════════════════════════════════
    // ANIMATION LOOP - Single source of truth for ship placement
    // ═══════════════════════════════════════════════════════════════════════════
    useFrame((state, delta) => {
        if (!rig.current || !model.current) return;

        const dt = Math.min(delta, 0.033);
        const elapsed = state.clock.elapsedTime;

        // ✅ Use useScroll() - stable and deterministic, not DOM-hacky
        const t = scroll.offset;
        const present = smoothstep(0.35, 0.65, t);

        // Subtle breathing motion
        const breathe = Math.sin(elapsed * 0.35) * 0.02;
        // Very slow idle yaw rotation
        const idleYaw = Math.sin(elapsed * IDLE_ROTATION_SPEED) * 0.08;

        // Use locked ship config values
        const src = SHIP_CONFIG;

        // Position with scroll-based interpolation
        const x = src.x;
        const y = THREE.MathUtils.lerp(src.y, src.y - 0.18, present) + breathe;
        const z = THREE.MathUtils.lerp(src.z, src.z + 4.5, present);

        tmp.set(x, y, z);

        rig.current.position.lerp(tmp, 1 - Math.exp(-dt * 4));

        // Rotation with idle yaw
        rig.current.rotation.x = src.rotX;
        rig.current.rotation.y = src.rotY + idleYaw;
        rig.current.rotation.z = src.rotZ;

        // Scale: normalized scene has max dimension = NORMALIZE_TARGET
        const scaleRatio = src.baseScale / NORMALIZE_TARGET;
        model.current.scale.setScalar(scaleRatio);
    });

    return (
        <group
            ref={rig}
            onClick={(e) => {
                e.stopPropagation();
                const domEvent = e.nativeEvent;
                const cx = (domEvent as MouseEvent).clientX ?? window.innerWidth / 2;
                const cy = (domEvent as MouseEvent).clientY ?? window.innerHeight / 2;
                console.log('[LoreClick] Parker Probe clicked at', cx, cy);
                useLoreStore.getState().openLore('parker', { x: cx, y: cy });
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'default'; }}
        >
            <group ref={model}>
                <Environment files={`${BASE_PATH}/hdr/moon_lab_1k.hdr`} environmentIntensity={envIntensity} />
                <primitive object={scene} />
            </group>
        </group>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT - With Suspense fallback
// ═══════════════════════════════════════════════════════════════════════════════
export function HeroShip({ tier }: Props) {
    usePreloadCompressedGLTF(getModelPath("scene1HeroShip", tier));

    return (
        <Suspense fallback={null}>
            <ShipWithGLB tier={tier} />
        </Suspense>
    );
}
useLoader.preload(RGBELoader, `${BASE_PATH}/hdr/moon_lab_1k.hdr`);
