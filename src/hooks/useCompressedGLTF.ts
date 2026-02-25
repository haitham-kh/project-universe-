"use client";

import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useMemo } from "react";
import { createGLTFLoaderExtension } from "../lib/gltfLoaderConfig";

type MaybeMany<T> = T | T[];

// ═══════════════════════════════════════════════════════════════════════════════
// GPU WARM-UP — Force KTX2 texture transcoding before first render
// Without this, KTX2 textures are "lazy" and only transcode on first draw call,
// which causes a visible stall (black frame) when a scene first appears.
// ═══════════════════════════════════════════════════════════════════════════════

const TEXTURE_KEYS = [
  "map", "normalMap", "roughnessMap", "metalnessMap",
  "aoMap", "emissiveMap", "alphaMap", "bumpMap",
] as const;

export function warmUpGLTFTextures(
  scene: THREE.Object3D,
  renderer: THREE.WebGLRenderer,
): void {
  const seen = new Set<number>();
  scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const key of TEXTURE_KEYS) {
        const tex = (mat as any)[key] as THREE.Texture | undefined;
        if (tex && !seen.has(tex.id)) {
          seen.add(tex.id);
          try {
            renderer.initTexture(tex);
          } catch {
            // Texture may not be ready yet — skip silently
          }
        }
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════

export function useCompressedGLTF<T = any>(path: string): T {
  const { gl } = useThree();
  const extendLoader = useMemo(
    () => createGLTFLoaderExtension(gl as THREE.WebGLRenderer),
    [gl],
  );

  return useGLTF(path, true, undefined, extendLoader as any) as T;
}

export function usePreloadCompressedGLTF(paths: MaybeMany<string>): void {
  const { gl } = useThree();
  const extendLoader = useMemo(
    () => createGLTFLoaderExtension(gl as THREE.WebGLRenderer),
    [gl],
  );
  const key = Array.isArray(paths) ? paths.join("|") : paths;
  const list = useMemo(() => (Array.isArray(paths) ? paths : [paths]), [key]);

  useEffect(() => {
    for (const path of list) {
      useGLTF.preload(path, true, undefined, extendLoader as any);
    }

    // Schedule GPU warm-up after preloads have had time to complete.
    // This forces KTX2 texture transcoding to happen eagerly instead of
    // lazily on first draw call, preventing black-frame stalls.
    const warmUpTimer = setTimeout(() => {
      for (const path of list) {
        try {
          // Access drei's internal GLTF cache to get the loaded scene
          const cached = (useGLTF as any).cache?.get?.(path);
          if (cached?.scene) {
            warmUpGLTFTextures(cached.scene, gl as THREE.WebGLRenderer);
          }
        } catch {
          // Cache may not be accessible — skip silently
        }
      }
    }, 800);

    return () => clearTimeout(warmUpTimer);
  }, [list, extendLoader, gl]);
}
