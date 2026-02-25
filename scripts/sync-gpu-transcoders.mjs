#!/usr/bin/env node

import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();

const copies = [
  {
    src: "node_modules/three/examples/jsm/libs/basis/basis_transcoder.js",
    dst: "public/basis/basis_transcoder.js",
  },
  {
    src: "node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm",
    dst: "public/basis/basis_transcoder.wasm",
  },
  {
    src: "node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.js",
    dst: "public/draco/gltf/draco_decoder.js",
  },
  {
    src: "node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm",
    dst: "public/draco/gltf/draco_decoder.wasm",
  },
  {
    src: "node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js",
    dst: "public/draco/gltf/draco_wasm_wrapper.js",
  },
];

for (const entry of copies) {
  const src = resolve(root, entry.src);
  const dst = resolve(root, entry.dst);
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  console.log(`[sync-gpu-transcoders] ${entry.src} -> ${entry.dst}`);
}
