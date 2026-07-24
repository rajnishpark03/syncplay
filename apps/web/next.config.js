/**
 * Build output is env-driven so one config serves every target:
 *   BUILD_EXPORT=true      → static export to ./out  (Cloudflare Pages, Capacitor, Tauri)
 *   BUILD_STANDALONE=true  → self-contained server bundle (Docker image)
 *   (neither)              → normal build for `next start` (Render)
 *
 * The whole app is client-rendered (no server components fetching data, no API
 * routes), so the static export is fully functional — it talks to the API over
 * the network exactly like the server-rendered build does.
 */
const isExport = process.env.BUILD_EXPORT === 'true';
const isStandalone = process.env.BUILD_STANDALONE === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@syncplay/shared'],
  output: isExport ? 'export' : isStandalone ? 'standalone' : undefined,
  images: isExport ? { unoptimized: true } : { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
};

module.exports = nextConfig;
