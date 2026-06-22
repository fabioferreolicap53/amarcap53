import React, { useState, useEffect, useRef } from 'react';
import { X, Share, HeartPulse } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_TS_KEY = 'pwa-banner-dismissed-at';
const DISMISS_COUNT_KEY = 'pwa-banner-dismiss-count';
const HIDE_DAYS = 3;
const MAX_DISMISSES = 3;

function getDismissedAt(): number | null {
  try {
    const val = localStorage.getItem(DISMISS_TS_KEY);
    return val ? parseInt(val, 10) || null : null;
  } catch { return null; }
}

function getDismissCount(): number {
  try {
    const val = localStorage.getItem(DISMISS_COUNT_KEY);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch { return 0; }
}

function recordDismiss() {
  try {
    localStorage.setItem(DISMISS_TS_KEY, String(Date.now()));
    localStorage.setItem(DISMISS_COUNT_KEY, String(getDismissCount() + 1));
  } catch {}
}

function shouldHideBanner(): { hide: boolean; permanent: boolean } {
  const count = getDismissCount();
  if (count >= MAX_DISMISSES) return { hide: true, permanent: true };

  const ts = getDismissedAt();
  if (ts && (Date.now() - ts) < HIDE_DAYS * 24 * 60 * 60 * 1000) {
    return { hide: true, permanent: false };
  }
  return { hide: false, permanent: false };
}

// Checa síncrono — roda na inicialização do state, antes do primeiro render
function calcInitState(): { show: boolean; isIOS: boolean; standalone: boolean } {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    !!(navigator as any).standalone;
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  if (standalone) return { show: false, isIOS, standalone: true };

  // Fechado pelo usuário (permanente ou temporário) → não mostrar
  if (shouldHideBanner().hide) return { show: false, isIOS, standalone: false };

  // iOS: mostra sempre (não tem beforeinstallprompt)
  if (isIOS) return { show: true, isIOS, standalone: false };

  // Já tem evento capturado pelo inline script do index.html?
  if ((window as any).__deferredPrompt) {
    return { show: true, isIOS, standalone: false };
  }

  return { show: false, isIOS, standalone: false };
}

export const InstallBanner: React.FC = () => {
  const [state, setState] = useState(calcInitState);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(
    (window as any).__deferredPrompt || null,
  );

  const { show: showBanner, isIOS, standalone: isStandalone } = state;

  useEffect(() => {
    if (isStandalone) return;
    if (deferredRef.current && showBanner) return;

    const handler = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      setState((prev) => ({ ...prev, show: !shouldHideBanner().hide }));
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isStandalone, showBanner]);

  const handleInstall = async () => {
    const promptEvent = deferredRef.current;
    if (!promptEvent) return;

    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      try {
        localStorage.removeItem(DISMISS_TS_KEY);
        localStorage.removeItem(DISMISS_COUNT_KEY);
      } catch {}
      setState((prev) => ({ ...prev, show: false }));
    }
    deferredRef.current = null;
    (window as any).__deferredPrompt = null;
  };

  const handleClose = () => {
    recordDismiss();
    setState((prev) => ({ ...prev, show: false }));
  };

  if (!showBanner || isStandalone) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999]">
      <div className="mx-auto max-w-lg px-4 pb-6 pt-2">
        <div className="bg-[#051934]/95 backdrop-blur-2xl px-5 pb-5 pt-4 rounded-[2rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16" />

          <button
            onClick={handleClose}
            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all z-20"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-4 relative z-10">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-900 rounded-2xl flex items-center justify-center shadow-lg shrink-0 border border-white/10 ring-4 ring-blue-500/10">
              {isIOS ? (
                <Share className="w-6 h-6 text-white" />
              ) : (
                <HeartPulse className="w-6 h-6 text-white" />
              )}
            </div>

            <div className="flex-1 pr-6">
              <h4 className="text-white font-black text-sm uppercase tracking-tight mb-1">
                AMAR - CAP 5.3
              </h4>
              <p className="text-white/60 text-[11px] leading-relaxed font-medium">
                {isIOS
                  ? 'Toque em "Compartilhar" e depois em "Adicionar à Tela de Início" para instalar o AMAR - CAP 5.3.'
                  : 'Instale o AMAR - SISTEMA DE RASTREIO CAP 5.3 para acesso rápido aos dados.'}
              </p>

              {!isIOS && (
                <button
                  onClick={handleInstall}
                  className="mt-4 w-full py-3 bg-white text-[#051934] text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-50 transition-all shadow-lg active:scale-95"
                >
                  Instalar Agora
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
