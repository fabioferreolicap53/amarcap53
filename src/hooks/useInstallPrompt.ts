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

function hasInstalledFlag(): boolean {
  try { return localStorage.getItem('pwa_installed') === '1'; }
  catch { return false; }
}

function isDismissed(): boolean {
  try { return sessionStorage.getItem('pwa_install_banner_dismiss') === '1'; }
  catch { return false; }
}

// Detecta se PWA já está instalada via API do browser
async function detectInstalled(): Promise<boolean> {
  try {
    if ('getInstalledRelatedApps' in navigator) {
      const apps = await (navigator as any).getInstalledRelatedApps();
      if (apps && apps.length > 0) return true;
    }
  } catch {}
  return false;
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
  const [dismissed, setDismissed] = useState(isDismissed);
  const [installed, setInstalled] = useState(() => {
    if (isStandalone()) return true;
    if (hasInstalledFlag()) return true;
    return false;
  });

  useEffect(() => {
    // Detecta instalação via API (funciona em janela anônima)
    detectInstalled().then(detectionResult => {
      if (detectionResult) {
        setInstalled(true);
        try { localStorage.setItem('pwa_installed', '1'); } catch {}
      }
    });

    const handler = (e: Event) => {
      e.preventDefault();
      capturedPrompt = e;
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      try { localStorage.setItem('pwa_installed', '1'); } catch {}
    };
    window.addEventListener('appinstalled', installedHandler);

    if (isStandalone() && !hasInstalledFlag()) {
      try { localStorage.setItem('pwa_installed', '1'); } catch {}
    }

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
    try { sessionStorage.setItem('pwa_install_banner_dismiss', '1'); } catch {}
    setDismissed(true);
  }, []);

  return { shouldShow, platform, canNativeInstall, install, dismiss, installed };
}
