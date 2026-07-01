import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export so the same build ships as the PWA (phase 10) and inside the
  // Capacitor native shell (phase 13). No API routes / Server Actions in the app.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactCompiler: true,
};

export default nextConfig;
