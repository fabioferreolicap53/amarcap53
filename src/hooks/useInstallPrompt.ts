import { useState, useEffect, useCallback } from 'react';

type Platform = 'android' | 'ios' | 'windows' | 'other';

function getPlatform(): Platform {
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Windows/i.test(ua)) return 'windows';
  return 'other';
}

function isStandalone(): boolean {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if ((window.navigator as any).standalone === true) return true;
    if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return true;
  } catch {}
  return false;
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem('pwa_install_banner_dismissed') === '1';
  } catch { return false; }
}

// Captura global FORA do componente
let capturedPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    capturedPrompt = e;
  });
}

export function useInstallPrompt() {
  const platform = getPlatform();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(capturedPrompt);
  const [installed, setInstalled] = useState(isStandalone());
  const [dismissed, setDismissed] = useState(isDismissed);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      capturedPrompt = e;
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const canNativeInstall = !!deferredPrompt && !installed;
  const shouldShow = !installed && !dismissed;

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setInstalled(true);
      }
    } catch {}
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    try { localStorage.setItem('pwa_install_banner_dismissed', '1'); } catch {}
    setDismissed(true);
  }, []);

  return { shouldShow, platform, canNativeInstall, install, dismiss, installed };
}
