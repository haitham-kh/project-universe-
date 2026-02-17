"use client";

import * as THREE from "three";
import { useRef, useMemo, Suspense, createContext, useContext, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { BASE_PATH } from "../lib/basePath";

// ═══════════════════════════════════════════════════════════════════════════════
// GLB BACKGROUND - PRODUCTION VERSION
// ═══════════════════════════════════════════════════════════════════════════════
// ⚠️ FINAL VALUES - DO NOT MODIFY ⚠️
// These values are locked after extensive debugging.
// If it works, don't touch it.
// ═══════════════════════════════════════════════════════════════════════════════

interface GlbBackgroundProps {
    tier?: 0 | 1 | 2 | 3;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCKED CINEMATIC VALUES - FINAL - DO NOT CHANGE
// ═══════════════════════════════════════════════════════════════════════════════
const CAMERA_FOV = 87;
const CAMERA_OFFSET = { x: 60, y: 110, z: -850 };
const SPHERE_SCALE = 180;
const SPHERE_ROTATION = { x: -2.65, y: -2.57, z: -1.45 };
const SHIP_SCALE = 2.60;
const SHIP_POS = { x: -11.50, y: -0.50, z: 0.00 };

// ═══════════════════════════════════════════════════════════════════════════════
// DEBUG CONTEXT - Exports locked values for other components
// ═══════════════════════════════════════════════════════════════════════════════
interface DebugState {
    showShip: boolean;
    showRocks: boolean;
    shipScale: number;
    rockScale: number;
    shipPosX: number;
    shipPosY: number;
    shipPosZ: number;
}

const DebugContext = createContext<DebugState>({
    showShip: true,
    showRocks: false,
    shipScale: SHIP_SCALE,
    rockScale: 1,
    shipPosX: SHIP_POS.x,
    shipPosY: SHIP_POS.y,
    shipPosZ: SHIP_POS.z,
});

export const useDebugControls = () => useContext(DebugContext);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT - LOCKED VALUES, NO DEBUG MENU
// ═══════════════════════════════════════════════════════════════════════════════
function GlbBackgroundContent({ tier = 2 }: GlbBackgroundProps) {
    const groupRef = useRef<THREE.Group>(null);
    const { scene: glbScene } = useGLTF(`${BASE_PATH}/models/new backgeound/source/latestv5.glb`);
    const { camera, gl } = useThree();

    const maxAniso = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);

    // Clone and configure materials
    const clonedScene = useMemo(() => {
        const clone = glbScene.clone(true);
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.renderOrder = -99999;
                mesh.frustumCulled = false;
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                const newMaterials = materials.map((mat) => {
                    if (!mat) return mat;
                    const clonedMat = mat.clone();
                    (clonedMat as any).fog = false;
                    clonedMat.side = THREE.BackSide;
                    clonedMat.depthWrite = false;
                    clonedMat.depthTest = false;
                    clonedMat.toneMapped = false;
                    clonedMat.needsUpdate = true;
                    return clonedMat;
                });
                mesh.material = Array.isArray(mesh.material) ? newMaterials : newMaterials[0];
            }
        });
        return clone;
    }, [glbScene]);

    // Texture filtering
    useEffect(() => {
        clonedScene.traverse((obj: any) => {
            const mat = obj.material;
            if (!mat) return;
            ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'normalMap'].forEach((k) => {
                const tex = mat[k];
                if (tex && tex.isTexture) {
                    tex.anisotropy = maxAniso;
                    tex.generateMipmaps = true;
                    tex.minFilter = THREE.LinearMipmapLinearFilter;
                    tex.magFilter = THREE.LinearFilter;
                    tex.needsUpdate = true;
                }
            });
        });
    }, [clonedScene, maxAniso]);

    // Position background (read-only camera access - FOV is handled by CinematicCamera)
    useFrame(() => {
        if (!groupRef.current) return;

        // Position background sphere relative to camera
        groupRef.current.position.set(
            camera.position.x + CAMERA_OFFSET.x,
            camera.position.y + CAMERA_OFFSET.y,
            camera.position.z + CAMERA_OFFSET.z
        );
        // NOTE: FOV is controlled ONLY by CinematicCamera.tsx - do not modify camera here
    });

    // NOTE: Debug state is now handled by Director store in useDirector.ts
    // HeroShip reads from Director, not window global

    return (
        <DebugContext.Provider value={{
            showShip: true,
            showRocks: false,
            shipScale: SHIP_SCALE,
            rockScale: 1,
            shipPosX: SHIP_POS.x,
            shipPosY: SHIP_POS.y,
            shipPosZ: SHIP_POS.z,
        }}>
            <group
                ref={groupRef}
                rotation={[SPHERE_ROTATION.x, SPHERE_ROTATION.y, SPHERE_ROTATION.z]}
                scale={[SPHERE_SCALE, SPHERE_SCALE, SPHERE_SCALE]}
                frustumCulled={false}
                renderOrder={-99999}
            >
                <primitive object={clonedScene} />
            </group>
        </DebugContext.Provider>
    );
}

function Fallback() { return null; }

export function GlbBackground({ tier = 2 }: GlbBackgroundProps) {
    return (
        <Suspense fallback={<Fallback />}>
            <GlbBackgroundContent tier={tier} />
        </Suspense>
    );
}

useGLTF.preload(`${BASE_PATH}/models/new backgeound/source/latestv5.glb`);
