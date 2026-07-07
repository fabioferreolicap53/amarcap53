import { useState, useEffect } from 'react';

type Platform = 'android' | 'ios' | 'windows' | 'other';

function getPlatform(): Platform {
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Windows/i.test(ua)) return 'windows';
  return 'other';
}

function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if ((window.navigator as any).standalone === true) return true;
  if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return true;
  return false;
}

// Captura global FORA do componente — antes do React montar
let capturedPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    capturedPrompt = e;
  });
}

const DISMISS_KEY = 'pwa_install_banner_dismissed';

export function useInstallPrompt() {
  const platform = getPlatform();
  const standalone = isStandalone();
  const dismissed = localStorage.getItem(DISMISS_KEY) === '1';

  const [deferredPrompt, setDeferredPrompt] = useState<any>(capturedPrompt);
  const [installed, setInstalled] = useState(standalone);

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

  const shouldShow = !installed && !dismissed && (
    canNativeInstall || platform === 'ios' || platform === 'android'
  );

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setInstalled(true);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
  };

  return { shouldShow, platform, canNativeInstall, install, dismiss, installed };
}
