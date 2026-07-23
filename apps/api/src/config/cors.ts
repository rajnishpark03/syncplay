/**
 * Resolves the CORS `origin` option from the CORS_ORIGIN env var, shared by
 * the HTTP server (main.ts), the Socket.IO gateway, and the Redis adapter so
 * they never disagree.
 *
 * - unset            → localhost dev default
 * - "*"              → reflect any origin (returns `true`). Safe here because
 *                      auth is via Bearer tokens in headers, not cookies.
 * - "a.com,b.com"    → allow exactly those origins.
 */
export function resolveCorsOrigin(): true | string[] {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw || raw === '*') return raw === '*' ? true : ['http://localhost:3000', 'http://localhost:3001'];
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}
