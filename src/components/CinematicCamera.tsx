"use client";

import * as THREE from "three";
import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import { useDirector, CameraPose, SceneOpacity, FxState } from "../lib/useDirector";
import { CAMERA } from "../lib/sceneConfig";
import { damp } from "../lib/motionMath";
import { useScene2Debug } from "./Scene2Planets";
import { useScene3Debug } from "./Scene3Group";

// ═══════════════════════════════════════════════════════════════════════════════
// CINEMATIC CAMERA - Director-Driven
// 
// Reads timeline & mouse from Director store
// Applies camera pose with smoothing
// Owns all camera mutations (FOV, position, lookAt, roll)
// ═══════════════════════════════════════════════════════════════════════════════

// Scroll deadzone: first 2% of scroll stays at t=0 to protect initial camera position
const SCROLL_DEADZONE = 0.02;

type Props = {
    tier: 0 | 1 | 2 | 3;
};

export function CinematicCamera({ tier }: Props) {
    const scroll = useScroll();
    const { camera } = useThree();

    // Get Director actions
    const updateTimeline = useDirector(state => state.updateTimeline);
    const updateMouse = useDirector(state => state.updateMouse);

    // Local smoothing refs (camera-specific, not in Director)
    const fovSmooth = useRef(CAMERA.fov.hero);
    const rollSmooth = useRef(0);
    const prevScene3ActiveRef = useRef(false);
    const camPos = useMemo(() => CAMERA.position.hero.clone(), []);
    const lookTarget = useMemo(() => CAMERA.lookAt.hero.clone(), []);

    // Reuse temp vectors to reduce GC pressure (important for smooth scrolling)
    const tempTargetPos = useMemo(() => new THREE.Vector3(), []);
    const tempTargetLookAt = useMemo(() => new THREE.Vector3(), []);

    // ═══════════════════════════════════════════════════════════════════════════
    // SUBSCRIPTION PATTERN - Write to refs, read in useFrame (no React rerenders)
    // ═══════════════════════════════════════════════════════════════════════════
    const cameraPoseRef = useRef<CameraPose | null>(null);
    const mouseSmoothRef = useRef(new THREE.Vector2(0, 0));
    const fxRef = useRef<FxState | null>(null);
    const sceneOpacityRef = useRef<SceneOpacity | null>(null);

    useEffect(() => {
        // Subscribe to director state changes - writes to refs (no React re-render)
        const unsub = useDirector.subscribe((state) => {
            cameraPoseRef.current = state.cameraPose;
            mouseSmoothRef.current.copy(state.mouseSmooth);
            fxRef.current = state.fx;
            sceneOpacityRef.current = state.sceneOpacity;
        });
        // Initialize with current state
        const state = useDirector.getState();
        cameraPoseRef.current = state.cameraPose;
        mouseSmoothRef.current.copy(state.mouseSmooth);
        fxRef.current = state.fx;
        sceneOpacityRef.current = state.sceneOpacity;
        return unsub;
    }, []);

    useFrame((state, delta) => {
        const dt = Math.min(delta, 0.033); // Clamp for stability

        // Apply scroll deadzone to protect initial camera position
        const tRaw = scroll.offset;
        const t = tRaw <= SCROLL_DEADZONE ? 0 : (tRaw - SCROLL_DEADZONE) / (1 - SCROLL_DEADZONE);

        // ═══════════════════════════════════════════════════════════════════
        // 1. UPDATE DIRECTOR (single source of truth)
        // ═══════════════════════════════════════════════════════════════════
        updateTimeline(t, dt);
        updateMouse(state.pointer.x, state.pointer.y, dt);

        // ═══════════════════════════════════════════════════════════════════
        // 2. READ COMPUTED STATE FROM REFS (subscribed, no getState call)
        // ═══════════════════════════════════════════════════════════════════
        const cameraPose = cameraPoseRef.current;
        const mouseSmooth = mouseSmoothRef.current;
        const fx = fxRef.current;
        const sceneOpacity = sceneOpacityRef.current;

        if (!cameraPose || !fx || !sceneOpacity) return;

        const parallaxX = mouseSmooth.x * CAMERA.parallax.x;
        const parallaxY = mouseSmooth.y * CAMERA.parallax.y;

        // ═══════════════════════════════════════════════════════════════════
        // 3. MICRO HANDHELD SHAKE (tier-dependent)
        // ═══════════════════════════════════════════════════════════════════
        const shakeIntensity = (tier === 0 ? 0.008 : tier === 1 ? 0.012 : 0.018) * fx.warpCue;
        const shakeX = Math.sin(state.clock.elapsedTime * 0.8) * shakeIntensity * 4;
        const shakeY = Math.cos(state.clock.elapsedTime * 1.2) * shakeIntensity * 4;

        // ═══════════════════════════════════════════════════════════════════
        // 4. APPLY FOV (chapter-driven, with Scene 2/3 debug override)
        // ═══════════════════════════════════════════════════════════════════
        // Check if Scene 2 is active and has a debug FOV override
        let targetFov = cameraPose.fov;

        // When Scene 2 is active (opacity > 0.5), allow debug menu to override FOV
        if (sceneOpacity.scene2Opacity > 0.5) {
            const debugFov = useScene2Debug.getState().camera.fov;
            if (debugFov && debugFov !== 110) { // 110 is the default, so only override if changed
                targetFov = debugFov;
            }
        }

        // When Scene 3 is active (opacity > 0.1), allow debug menu to override FOV
        if (sceneOpacity.scene3Opacity > 0.1) {
            const debugFov = useScene3Debug.getState().camera.fov;
            if (debugFov && debugFov !== 118) { // 118 is the default, so only override if changed
                targetFov = debugFov;
            }
        }

        // Scene 3: Smooth scroll tracking + always-on ABS drift
        // damp() gives buttery-smooth FOV following scroll
        // Constant drift ensures FOV never stops — scene stays alive
        const scene3Active = sceneOpacity.scene3Opacity > 0.1;
        if (scene3Active) {
            // Smooth tracking toward scroll target (factor 8 = fast but not snappy)
            const smoothed = damp(fovSmooth.current, targetFov, 8, dt);

            // Always-on upward drift (~1.5 deg/sec) — the "ABS" heartbeat
            const drift = fovSmooth.current + 1.5 * dt;

            // Whichever is higher wins: scroll drives it, drift keeps it alive
            fovSmooth.current = Math.min(Math.max(smoothed, drift), 220);
        } else {
            fovSmooth.current = damp(fovSmooth.current, targetFov, CAMERA.smoothing.fov, dt);
        }
        prevScene3ActiveRef.current = scene3Active;

        const cam = camera as THREE.PerspectiveCamera;
        if (Math.abs(cam.fov - fovSmooth.current) > 0.01) {
            cam.fov = fovSmooth.current;
            cam.updateProjectionMatrix();
        }

        // ═══════════════════════════════════════════════════════════════════
        // 5. APPLY ROLL (smoothed)
        // ═══════════════════════════════════════════════════════════════════
        rollSmooth.current = damp(rollSmooth.current, cameraPose.roll, 4, dt);

        // ═══════════════════════════════════════════════════════════════════
        // 5b. CAMERA FREEZE OVERRIDE (Scene 2 debug: manual camera control)
        // When frozen, bypass timeline and use slider values directly
        // ═══════════════════════════════════════════════════════════════════
        if (sceneOpacity.scene2Opacity > 0.5) {
            const debugState = useScene2Debug.getState();
            if (debugState.cameraFrozen) {
                const fc = debugState.frozenCam;
                // Direct set (no smoothing) so sliders feel immediate
                camera.position.set(fc.camX, fc.camY, fc.camZ);
                camera.lookAt(fc.lookX, fc.lookY, fc.lookZ);
                // Update internal tracking vectors so unfreezing is smooth
                camPos.set(fc.camX, fc.camY, fc.camZ);
                lookTarget.set(fc.lookX, fc.lookY, fc.lookZ);
                camera.rotation.z = rollSmooth.current;
                return; // Skip normal camera application
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // 6. APPLY CAMERA POSITION (with parallax + shake) - REUSING VECTOR
        // ═══════════════════════════════════════════════════════════════════
        tempTargetPos.set(
            cameraPose.position.x + parallaxX + shakeX,
            cameraPose.position.y + parallaxY + shakeY,
            cameraPose.position.z
        );

        camPos.lerp(tempTargetPos, 1 - Math.exp(-dt * CAMERA.smoothing.position));
        camera.position.copy(camPos);

        // ═══════════════════════════════════════════════════════════════════
        // 7. APPLY LOOK AT (with parallax) - REUSING VECTOR
        // ═══════════════════════════════════════════════════════════════════
        tempTargetLookAt.set(
            cameraPose.lookAt.x + parallaxX * 0.2,
            cameraPose.lookAt.y + parallaxY * 0.3,
            cameraPose.lookAt.z
        );

        lookTarget.lerp(tempTargetLookAt, 1 - Math.exp(-dt * CAMERA.smoothing.lookAt));
        camera.lookAt(lookTarget);

        // ═══════════════════════════════════════════════════════════════════
        // 8. APPLY ROLL (after lookAt to preserve direction)
        // ═══════════════════════════════════════════════════════════════════
        camera.rotation.z = rollSmooth.current;
    });

    return null;
}
