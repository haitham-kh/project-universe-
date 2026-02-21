import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';
const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? (isProd ? "/project-universe-" : "");
const normalizedBasePath = configuredBasePath === "/"
  ? ""
  : configuredBasePath.replace(/\/+$/, "");
const configuredDistDir = process.env.NEXT_DIST_DIR || ".next";

const nextConfig: any = {
  distDir: configuredDistDir,
  output: "export",
  basePath: normalizedBasePath || undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
