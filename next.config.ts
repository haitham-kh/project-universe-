import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default (phase: string, { defaultConfig }: { defaultConfig: NextConfig }): NextConfig => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

  // Strictly enforce NO basePath and NO static export during local dev
  if (isDev) {
    return {
      images: { unoptimized: true },
    };
  }

  // Production build config (for gh-pages deployment)
  const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/project-universe-";
  const normalizedBasePath = configuredBasePath === "/" ? "" : configuredBasePath.replace(/\/+$/, "");
  const configuredDistDir = process.env.NEXT_DIST_DIR || ".next";

  return {
    distDir: configuredDistDir,
    output: "export",
    basePath: normalizedBasePath || undefined,
    images: { unoptimized: true },
  };
};
