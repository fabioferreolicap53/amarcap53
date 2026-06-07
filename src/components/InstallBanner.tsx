import React, { useState, useEffect } from 'react';
import { X, Download, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detectar iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    
    setIsIOS(isIOSDevice);

    // Verificar se usuário fechou recentemente (3 dias)
    const lastDismissed = localStorage.getItem('pwa-banner-dismissed');
    const now = Date.now();
    const threeDays = 3 * 24 * 60 * 60 * 1000;

    const shouldShow = !lastDismissed || (now - parseInt(lastDismissed) > threeDays);

    if (isIOSDevice && !isStandalone && shouldShow) {
      setShowBanner(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (shouldShow) setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
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

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-8 md:w-[400px] z-[9999] animate-in slide-in-from-bottom-10 fade-in duration-700">
      <div className="bg-[#051934]/95 backdrop-blur-2xl p-5 rounded-[2rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
        
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all z-20"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4 relative z-10">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
            {isIOS ? <Share className="w-6 h-6 text-white" /> : <Download className="w-6 h-6 text-white" />}
          </div>
          
          <div className="flex-1 pr-6">
            <h4 className="text-white font-black text-sm uppercase tracking-tight mb-1">
              {isIOS ? 'Instalar AMAR Saúde' : 'App AMAR Saúde'}
            </h4>
            <p className="text-white/60 text-[11px] leading-relaxed font-medium">
              {isIOS 
                ? 'Toque em "Compartilhar" e depois em "Adicionar à Tela de Início" para facilitar o acesso.' 
                : 'Instale nosso aplicativo para uma experiência mais rápida e acesso offline.'}
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
  );
};
