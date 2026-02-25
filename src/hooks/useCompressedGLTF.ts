"use client";

import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useMemo } from "react";
import { createGLTFLoaderExtension } from "../lib/gltfLoaderConfig";

type MaybeMany<T> = T | T[];

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
  }, [list, extendLoader]);
}
