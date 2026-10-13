import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker multi-stage builds
  // Produces .next/standalone directory with minimal Node.js server
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined,

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
  ],
  // Turbopack config (top-level key in Next.js 15.3+ / 16)
  // In a monorepo, root points to monorepo root where hoisted node_modules live
  turbopack: {
    root: process.env.DOCKER_BUILD === 'true' ? path.resolve(__dirname) : path.resolve(__dirname, '../../'),
    resolveAlias: {
      '@chroma-core/default-embed': './lib/chroma-embed-stub',
    },
  },
  // Vercel Serverless Hosting: Reverse proxy API requests to backend Go API Gateway
  async rewrites() {
    const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL;
    if (!backendUrl) {
      return [];
    }
    // Clean trailing slash if present
    const cleanBase = backendUrl.replace(/\/+$/, '');
    return [
      {
        source: '/v1/:path*',
        destination: `${cleanBase}/v1/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${cleanBase}/api/:path*`,
      },
      {
        source: '/speech/:path*',
        destination: `${cleanBase}/speech/:path*`,
      },
    ];
  },
};

export default nextConfig;
