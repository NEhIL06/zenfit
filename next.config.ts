import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize for Vercel deployment
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Externalize chromadb and its sub-packages so Turbopack never bundles them.
  // These are server-only packages and must NEVER be included in the client bundle.
  serverExternalPackages: [
    'chromadb',
    '@chroma-core/default-embed',
    'onnxruntime-node',
  ],
  // Turbopack config (top-level key in Next.js 15.3+ / 16)
  // Alias @chroma-core/default-embed to our local stub so Turbopack never
  // touches the broken CJS/ESM package in node_modules.
  turbopack: {
    resolveAlias: {
      '@chroma-core/default-embed': './lib/chroma-embed-stub',
    },
  },
};

export default nextConfig;
