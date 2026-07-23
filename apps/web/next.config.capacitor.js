/**
 * Static-export variant of next.config.js used only for Capacitor
 * (iOS/Android) and Tauri (Desktop) builds — those shells load a bundled
 * static site rather than talking to a Next.js server. The Vercel/web
 * deployment uses next.config.js directly and does NOT need this file.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@syncplay/shared'],
  output: 'export',
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
