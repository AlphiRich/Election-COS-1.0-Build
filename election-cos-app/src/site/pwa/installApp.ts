/**
 * Installing the public site as an app (electioncos.co.za).
 *
 * Chrome, Edge and Samsung Internet on Android and desktop fire
 * `beforeinstallprompt`; the site keeps that event and offers its own
 * "Install the app" button. iOS Safari has no such event: there the button
 * explains Share → Add to Home Screen instead. Once the site is running as
 * an installed app (display-mode: standalone), nothing is offered.
 *
 * The worker is registered in production builds only, so `vite dev` never
 * serves yesterday's bundle from a cache.
 */

/** The event Chromium fires when the site meets the install criteria. Not in lib.dom yet. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallMode = 'prompt' | 'ios' | 'installed' | 'unavailable';

/** What the install button should do on this browser right now. */
export function installMode(opts: {
  standalone: boolean;
  userAgent: string;
  maxTouchPoints: number;
  hasPrompt: boolean;
}): InstallMode {
  if (opts.standalone) return 'installed';
  if (opts.hasPrompt) return 'prompt';
  // iPadOS reports itself as a Mac; the touch points give it away.
  const ios =
    /iPhone|iPad|iPod/.test(opts.userAgent) || (/Macintosh/.test(opts.userAgent) && opts.maxTouchPoints > 1);
  if (ios && /Safari/.test(opts.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(opts.userAgent)) return 'ios';
  return 'unavailable';
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
}

/** Register the public site's worker (built into dist-site/site-sw.js). */
export function registerSiteWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/site-sw.js', { scope: '/' }).catch(() => {
      // Offline reading is an extra; the site works the same without it.
    });
  });
}
