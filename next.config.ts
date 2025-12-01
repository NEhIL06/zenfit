import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Optimize for Vercel deployment
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Treat chromadb as external to avoid Turbopack processing internal files
  serverExternalPackages: ['chromadb', '@chroma-core/default-embed'],
};

export default nextConfig;
