"use client";

import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { BASE_PATH } from "./basePath";

const dracoByRenderer = new WeakMap<THREE.WebGLRenderer, DRACOLoader>();
const ktx2ByRenderer = new WeakMap<THREE.WebGLRenderer, KTX2Loader>();

function getDracoLoader(gl: THREE.WebGLRenderer): DRACOLoader {
  const existing = dracoByRenderer.get(gl);
  if (existing) return existing;

  const draco = new DRACOLoader();
  draco.setDecoderPath(`${BASE_PATH}/draco/gltf/`);
  dracoByRenderer.set(gl, draco);
  return draco;
}

function getKTX2Loader(gl: THREE.WebGLRenderer): KTX2Loader {
  const existing = ktx2ByRenderer.get(gl);
  if (existing) return existing;

  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath(`${BASE_PATH}/basis/`);
  ktx2.detectSupport(gl);
  ktx2ByRenderer.set(gl, ktx2);
  return ktx2;
}

export function configureGLTFLoader(
  loader: GLTFLoader,
  gl: THREE.WebGLRenderer,
): void {
  loader.setDRACOLoader(getDracoLoader(gl));
  loader.setKTX2Loader(getKTX2Loader(gl));
}

export function createGLTFLoaderExtension(gl: THREE.WebGLRenderer) {
  return (loader: GLTFLoader) => configureGLTFLoader(loader, gl);
}

