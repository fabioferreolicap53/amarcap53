import React, { useState, useEffect } from 'react';
import { X, Share, HeartPulse } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

    setIsIOS(isIOSDevice);
    setIsStandalone(standalone);

    // Se já está rodando como standalone, não mostra banner nunca
    if (standalone) return;

    // Verificar se usuário fechou recentemente (3 dias)
    const lastDismissed = localStorage.getItem('pwa-banner-dismissed');
    const now = Date.now();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    const shouldShow = !lastDismissed || (now - parseInt(lastDismissed) > threeDays);

    if (!shouldShow) return;

    // iOS: mostra banner com instruções alternativas (sem beforeinstallprompt)
    if (isIOSDevice) {
      setShowBanner(true);
      return;
    }

    // Android/Desktop: intercepta beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault(); // Impede mini-infobar padrão do Chrome
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Se o evento não disparar em 30s, não mostra banner (app já instalado ou não suporta)
    const timeout = setTimeout(() => {
      if (!deferredPrompt) setShowBanner(false);
    }, 30000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleClose = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-banner-dismissed', Date.now().toString());
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
