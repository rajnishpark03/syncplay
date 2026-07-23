/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@syncplay/shared'],
  // Enables the self-contained server bundle used by apps/web/Dockerfile.
  // Vercel deployments ignore this and use their own build output instead.
  output: 'standalone',
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

module.exports = nextConfig;
