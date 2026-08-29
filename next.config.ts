import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  turbopack: {
    root: __dirname,
    resolveAlias: {
      canvas: "./src/lib/empty-module.js",
    },
  },
  serverExternalPackages: ["pdfkit"],
  /* config options here */
};

export default nextConfig;
