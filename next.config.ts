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
  // Externalize chromadb and ALL its sub-packages so Turbopack never bundles them.
  // These are server-only packages and must NEVER be included in the client bundle.
  serverExternalPackages: [
    'chromadb',
    '@chroma-core/default-embed',
    'onnxruntime-node',
  ],
  // Turbopack-specific: tell the bundler to treat these as externals
  // so it never traces into their broken CJS/ESM hybrid internals.
  experimental: {
    turbo: {
      resolveAlias: {
        // Prevents Turbopack from statically analyzing @chroma-core/default-embed
        '@chroma-core/default-embed': { browser: false },
      },
    },
  },
};

export default nextConfig;
