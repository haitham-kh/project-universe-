"use client";

import { BASE_PATH } from "./basePath";

export type PerformanceTier = 0 | 1 | 2 | 3;

type ModelVariant = {
  desktop: string;
  mobile: string;
};

const optimizedRoot = `${BASE_PATH}/models/optimized`;

export const MODEL_VARIANTS = {
  scene1Background: {
    desktop: `${optimizedRoot}/latestv5.ktx2.glb`,
    mobile: `${optimizedRoot}/latestv5.ktx2.glb`,
  },
  scene1HeroShip: {
    desktop: `${optimizedRoot}/ship.ktx2.glb`,
    mobile: `${optimizedRoot}/ship.mobile.ktx2.glb`,
  },
  scene2Starback: {
    desktop: `${optimizedRoot}/starback.ktx2.glb`,
    mobile: `${optimizedRoot}/starback.ktx2.glb`,
  },
  scene2Saturn: {
    desktop: `${optimizedRoot}/saturn2.ktx2.glb`,
    mobile: `${optimizedRoot}/saturn2.mobile.ktx2.glb`,
  },
  scene3Neptune: {
    desktop: `${optimizedRoot}/neptune-v3.ktx2.glb`,
    mobile: `${optimizedRoot}/neptune-v3.mobile.ktx2.glb`,
  },
  scene3NeptuneLimb: {
    desktop: `${optimizedRoot}/neptuenlimp.ktx2.glb`,
    mobile: `${optimizedRoot}/neptuenlimp.mobile.ktx2.glb`,
  },
} as const satisfies Record<string, ModelVariant>;

export type ModelKey = keyof typeof MODEL_VARIANTS;

export function getModelPath(key: ModelKey, tier: PerformanceTier): string {
  const variant = MODEL_VARIANTS[key];
  return tier <= 1 ? variant.mobile : variant.desktop;
}

export function toModelAssetKey(pathOrUrl: string): string {
  const withoutBase =
    BASE_PATH && pathOrUrl.startsWith(BASE_PATH)
      ? pathOrUrl.slice(BASE_PATH.length)
      : pathOrUrl;
  return withoutBase.replace(/^\//, "").replace(/\//g, "_");
}
