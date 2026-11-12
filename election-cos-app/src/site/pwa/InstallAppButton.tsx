/**
 * "Install the app" for the public site. See installApp.ts for when it shows.
 */
import { useEffect, useId, useState } from 'react';
import { installMode, isStandalone, type BeforeInstallPromptEvent, type InstallMode } from './installApp';

export function InstallAppButton({ className = '' }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const helpId = useId();

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep it for our own button instead of the browser's mini-bar
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const mode: InstallMode = installMode({
    standalone: installed,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    hasPrompt: deferred !== null,
  });
  if (mode === 'installed' || mode === 'unavailable') return null;

  const onClick = async () => {
    if (mode === 'ios') {
      setShowIosHelp((v) => !v);
      return;
    }
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null); // a prompt event can be used once
    if (outcome === 'accepted') setInstalled(true);
  };

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => void onClick()}
        className={`site-btn-outline-paper text-site-sm ${className}`.trim()}
        aria-expanded={mode === 'ios' ? showIosHelp : undefined}
        aria-controls={mode === 'ios' ? helpId : undefined}
      >
        Install the app
      </button>
      {mode === 'ios' && showIosHelp && (
        <span
          id={helpId}
          role="note"
          className="absolute right-0 top-full z-30 mt-2 w-64 rounded-md border border-line bg-paper p-3 text-site-sm text-ink shadow-sm"
        >
          In Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>. It is free, needs no sign-in, and keeps the
          pages you have opened readable offline.
        </span>
      )}
    </span>
  );
}
