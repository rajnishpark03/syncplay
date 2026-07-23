/**
 * Helpers around YouTube's officially supported, keyless endpoints:
 *  - oEmbed (https://oembed.com / YouTube's implementation) for title/thumbnail lookup
 *  - IFrame Player API (loaded in youtube-iframe-api.ts) for playback control
 * No scraping, no private endpoints, no DRM bypass.
 */

export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname === 'youtu.be') return url.pathname.slice(1) || null;
    if (url.hostname.includes('youtube.com')) {
      if (url.pathname === '/watch') return url.searchParams.get('v');
      if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2] ?? null;
      if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export interface YouTubeOEmbed {
  title: string;
  authorName: string;
  thumbnailUrl: string;
}

export async function fetchYouTubeOEmbed(videoId: string): Promise<YouTubeOEmbed | null> {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`);
    if (!res.ok) return null;
    const data = await res.json();
    return { title: data.title, authorName: data.author_name, thumbnailUrl: data.thumbnail_url };
  } catch {
    return null;
  }
}
