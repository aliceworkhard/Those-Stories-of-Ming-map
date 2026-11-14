import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable standalone output automatically during Docker image builds (deploy/Dockerfile sets DOCKER_STANDALONE=1)
  output: process.env.DOCKER_STANDALONE === '1' ? 'standalone' : undefined,
  reactStrictMode: true,
};

export default nextConfig;
