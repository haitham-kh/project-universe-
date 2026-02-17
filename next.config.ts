import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/project-universe-",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
