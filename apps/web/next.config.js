/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@syncplay/shared'],
  // 'standalone' produces the self-contained server bundle used by the Docker
  // image, but it makes `next start` error out — so it's opt-in via an env
  // flag. Plain `next build` + `next start` (Render, Vercel) leave it off.
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

module.exports = nextConfig;
