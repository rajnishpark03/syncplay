/**
 * Fullscreen helpers with mobile landscape handling.
 *
 * Phones are portrait by default, so a 16:9 video fills only a sliver of the
 * screen. Locking to landscape on entry (and releasing on exit) makes
 * fullscreen actually fill the display. The Orientation Lock API is only
 * available while fullscreen and only on some browsers, so every call is
 * best-effort — failing to lock never breaks going fullscreen.
 */

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape' | 'portrait' | 'any') => Promise<void>;
};

export function isFullscreenActive(): boolean {
  const doc = document as FsDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

async function lockLandscape() {
  // Only meaningful on touch devices held in portrait; desktops just ignore it.
  const orientation = screen.orientation as LockableOrientation | undefined;
  try {
    await orientation?.lock?.('landscape');
  } catch {
    // iOS Safari and some Android browsers reject this — fullscreen still works.
  }
}

function unlockOrientation() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // not supported — nothing to undo
  }
}

/**
 * Enters fullscreen on `el` and rotates to landscape on mobile.
 * `video` is the iOS fallback: Safari can only fullscreen a <video> directly.
 */
export async function enterFullscreen(el: HTMLElement | null, video?: HTMLVideoElement | null) {
  if (!el) return;
  const target = el as FsElement;
  const request = target.requestFullscreen?.bind(target) ?? target.webkitRequestFullscreen?.bind(target);

  if (request) {
    try {
      await request();
      await lockLandscape();
      return;
    } catch {
      // fall through to the native video path below
    }
  }

  const iosVideo = video as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null | undefined;
  iosVideo?.webkitEnterFullscreen?.();
}

export async function exitFullscreen() {
  const doc = document as FsDocument;
  unlockOrientation();
  try {
    await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
  } catch {
    // already exited
  }
}

export async function toggleFullscreen(el: HTMLElement | null, video?: HTMLVideoElement | null) {
  if (isFullscreenActive()) await exitFullscreen();
  else await enterFullscreen(el, video);
}

/** Subscribes to fullscreen changes (covers Esc and the native exit button). */
export function onFullscreenChange(handler: () => void): () => void {
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
  };
}
