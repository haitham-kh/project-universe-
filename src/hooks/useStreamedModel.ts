"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { AssetOrchestrator, AssetStatus, StreamResult, AssetPool } from "../lib/AssetOrchestrator";
import { log } from "../lib/logger";

// ═══════════════════════════════════════════════════════════════════════════════
// USE STREAMED MODEL v2.0 - Elite Non-Blocking Asset Loading
// 
// UPGRADES:
// - Tier-based LOD path selection (mobile vs desktop assets)
// - Pool-aware status handling (instant "reload" from pool)
// - Improved status state machine
// - Better cleanup handling
// ═══════════════════════════════════════════════════════════════════════════════

export interface UseStreamedModelOptions {
    /** Geometry to show while loading (optional - will create box if not provided) */
    proxyGeometry?: THREE.BufferGeometry;
    /** Color for proxy material */
    proxyColor?: string;
    /** Called when high-res model is loaded */
    onLoaded?: (scene: THREE.Object3D) => void;
    /** Chapter this asset belongs to */
    chapterId?: string;
    /** Estimated size in bytes for VRAM budget */
    estimatedSize?: number;
    /** Whether this asset is on the critical path */
    critical?: boolean;
    /**
     * Tier-based LOD paths for source-swapping LOD.
     * If provided, the path is selected based on current tier:
     * - Tier 0-1 (Mobile/Low): Uses 'mobile' path (smaller, Draco compressed)
     * - Tier 2-3 (Desktop): Uses 'desktop' path (full quality)
     * 
     * If not provided, the main `path` argument is used for all tiers.
     * 
     * Example:
     * lodPaths: {
     *   mobile: '/models/ship_mobile.glb',   // ~2MB, Draco, 1k textures
     *   desktop: '/models/ship_desktop.glb', // ~15MB, 4k textures
     * }
     */
    lodPaths?: {
        mobile: string;   // Tier 0-1
        desktop: string;  // Tier 2-3
    };
    /** Current performance tier for LOD selection (default: 2) */
    tier?: 0 | 1 | 2 | 3;
}

export interface UseStreamedModelResult {
    /** The scene to render - either proxy or real */
    scene: THREE.Object3D;
    /** Whether currently showing proxy */
    isProxy: boolean;
    /** Loading progress 0-100 */
    progress: number;
    /** Current status */
    status: AssetStatus;
    /** The raw proxy mesh (for cleanup) */
    proxyMesh: THREE.Mesh | null;
    /** The actual path being used (after LOD resolution) */
    resolvedPath: string;
}

/**
 * Resolve the actual path based on tier and lodPaths.
 */
function resolvePath(
    basePath: string,
    tier: 0 | 1 | 2 | 3,
    lodPaths?: { mobile: string; desktop: string }
): string {
    if (!lodPaths) return basePath;

    // Tier 0-1 = Mobile/Low, Tier 2-3 = Desktop
    return tier <= 1 ? lodPaths.mobile : lodPaths.desktop;
}

/**
 * Custom hook for streaming 3D models with proxy fallback.
 * 
 * Unlike useGLTF which uses Suspense and blocks rendering, this hook:
 * 1. Returns immediately with a proxy geometry
 * 2. Streams the real model via AssetOrchestrator
 * 3. Cross-fades from proxy to real when loaded
 * 4. Supports tier-based LOD path selection
 * 
 * @param path - Default path to the GLB/GLTF file (used if lodPaths not provided)
 * @param options - Configuration options
 */
export function useStreamedModel(
    path: string,
    options: UseStreamedModelOptions = {}
): UseStreamedModelResult {
    const {
        proxyGeometry,
        proxyColor = "#2a2a3e",
        onLoaded,
        chapterId,
        estimatedSize = 5 * 1024 * 1024, // 5MB default estimate
        critical = false,
        lodPaths,
        tier = 2,
    } = options;

    // Resolve actual path based on tier
    const resolvedPath = useMemo(
        () => resolvePath(path, tier, lodPaths),
        [path, tier, lodPaths]
    );

    // State
    const [isProxy, setIsProxy] = useState(true);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<AssetStatus>("pending");
    const [loadedScene, setLoadedScene] = useState<THREE.Object3D | null>(null);

    // Refs
    const proxyMeshRef = useRef<THREE.Mesh | null>(null);
    const isMountedRef = useRef(true);

    // Generate asset key from resolved path
    const assetKey = useMemo(
        () => resolvedPath.replace(/^\//, "").replace(/\//g, "_"),
        [resolvedPath]
    );

    // Create proxy geometry
    const proxy = useMemo(() => {
        const geometry = proxyGeometry || new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshStandardMaterial({
            color: proxyColor,
            roughness: 0.8,
            metalness: 0.2,
            transparent: true,
            opacity: 0.8,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `proxy_${assetKey}`;
        proxyMeshRef.current = mesh;
        return mesh;
    }, [proxyGeometry, proxyColor, assetKey]);

    // Stream callback
    const handleStreamUpdate = useCallback((result: StreamResult<THREE.Object3D>) => {
        if (!isMountedRef.current) return;

        setStatus(result.status);
        setProgress(result.progress);

        if ((result.status === "ready" || result.status === "pooled") && result.data) {
            setLoadedScene(result.data);
            setIsProxy(false);
            onLoaded?.(result.data);
        }
    }, [onLoaded]);

    // Check cache/pool and initiate loading
    useEffect(() => {
        isMountedRef.current = true;

        // Check if already cached or pooled
        const cached = AssetOrchestrator.get<THREE.Object3D>(assetKey);
        if (cached) {
            setLoadedScene(cached);
            setIsProxy(false);
            setStatus("ready");
            setProgress(100);
            onLoaded?.(cached);
            return;
        }

        // Subscribe to stream updates
        const result = AssetOrchestrator.stream<THREE.Object3D>(assetKey, handleStreamUpdate);
        setStatus(result.status);
        setProgress(result.progress);

        // Handle pooled status (will be promoted on next tick)
        if (result.status === "pooled") {
            // Asset is in pool, will be retrieved shortly
            setProgress(100);
            return;
        }

        // If not yet queued, queue for preload
        if (result.status === "pending") {
            setStatus("loading");

            // Queue the load via orchestrator
            AssetOrchestrator.queuePreload({
                key: assetKey,
                priority: critical ? "critical" : "normal",
                estimatedSize,
                chapterId: chapterId || null,
                loader: async () => {
                    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
                    const { DRACOLoader } = await import("three/examples/jsm/loaders/DRACOLoader.js");
                    const loader = new GLTFLoader();
                    const dracoLoader = new DRACOLoader();
                    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
                    loader.setDRACOLoader(dracoLoader);

                    return new Promise<THREE.Object3D>((resolve, reject) => {
                        loader.load(
                            resolvedPath,
                            (gltf) => {
                                const scene = gltf.scene.clone(true);

                                // Cache in orchestrator
                                AssetOrchestrator.set(
                                    assetKey,
                                    scene,
                                    "glb",
                                    estimatedSize,
                                    () => {
                                        // Disposal function
                                        scene.traverse((child) => {
                                            if ((child as THREE.Mesh).isMesh) {
                                                const mesh = child as THREE.Mesh;
                                                mesh.geometry?.dispose();
                                                if (Array.isArray(mesh.material)) {
                                                    mesh.material.forEach(m => m.dispose());
                                                } else {
                                                    mesh.material?.dispose();
                                                }
                                            }
                                        });
                                    },
                                    chapterId || null
                                );

                                resolve(scene);
                            },
                            undefined,
                            reject
                        );
                    });
                },
            });
        }

        return () => {
            isMountedRef.current = false;
            AssetOrchestrator.unsubscribe(assetKey, handleStreamUpdate);
        };
    }, [assetKey, resolvedPath, critical, estimatedSize, chapterId, handleStreamUpdate, onLoaded]);

    // Cleanup proxy on unmount
    useEffect(() => {
        return () => {
            if (proxyMeshRef.current) {
                proxyMeshRef.current.geometry.dispose();
                (proxyMeshRef.current.material as THREE.Material).dispose();
            }
        };
    }, []);

    return {
        scene: loadedScene || proxy,
        isProxy,
        progress,
        status,
        proxyMesh: proxyMeshRef.current,
        resolvedPath,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRELOAD HELPER - Queue asset for background loading
// ═══════════════════════════════════════════════════════════════════════════════

export function preloadModel(
    path: string,
    options: {
        priority?: "critical" | "high" | "normal" | "idle";
        chapterId?: string;
        estimatedSize?: number;
        lodPaths?: { mobile: string; desktop: string };
        tier?: 0 | 1 | 2 | 3;
    } = {}
) {
    const { lodPaths, tier = 2 } = options;
    const resolvedPath = resolvePath(path, tier, lodPaths);
    const assetKey = resolvedPath.replace(/^\//, "").replace(/\//g, "_");

    if (AssetOrchestrator.has(assetKey)) return;

    const { priority = "normal", chapterId, estimatedSize = 5 * 1024 * 1024 } = options;

    AssetOrchestrator.queuePreload({
        key: assetKey,
        priority,
        estimatedSize,
        chapterId: chapterId || null,
        loader: async () => {
            const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
            const { DRACOLoader } = await import("three/examples/jsm/loaders/DRACOLoader.js");
            const loader = new GLTFLoader();
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
            loader.setDRACOLoader(dracoLoader);

            return new Promise((resolve, reject) => {
                loader.load(
                    resolvedPath,
                    (gltf) => {
                        const scene = gltf.scene.clone(true);

                        AssetOrchestrator.set(
                            assetKey,
                            scene,
                            "glb",
                            estimatedSize,
                            () => {
                                scene.traverse((child) => {
                                    if ((child as THREE.Mesh).isMesh) {
                                        const mesh = child as THREE.Mesh;
                                        mesh.geometry?.dispose();
                                        if (Array.isArray(mesh.material)) {
                                            mesh.material.forEach(m => m.dispose());
                                        } else {
                                            mesh.material?.dispose();
                                        }
                                    }
                                });
                            },
                            chapterId || null
                        );

                        resolve(scene);
                    },
                    undefined,
                    reject
                );
            });
        },
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Get recommended LOD tier based on device
// ═══════════════════════════════════════════════════════════════════════════════

export function getRecommendedTier(): 0 | 1 | 2 | 3 {
    // Check for mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );

    if (isMobile) return 1;

    // Check device memory (if available)
    const deviceMemory = (navigator as any).deviceMemory;
    if (deviceMemory) {
        if (deviceMemory <= 2) return 0;
        if (deviceMemory <= 4) return 1;
        if (deviceMemory <= 8) return 2;
        return 3;
    }

    // Check hardware concurrency as fallback
    const cores = navigator.hardwareConcurrency || 4;
    if (cores <= 2) return 0;
    if (cores <= 4) return 1;
    if (cores <= 8) return 2;
    return 3;
}

log('[useStreamedModel v2.0] Elite streaming with tier-based LOD initialized');
