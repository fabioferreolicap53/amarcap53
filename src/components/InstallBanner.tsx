import React, { useState } from 'react';
import { X, Download, MousePointerClick, ChevronDown, ChevronUp, Smartphone, Monitor } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

const PLATFORM_INSTRUCTIONS: Record<string, string[]> = {
  android: [
    'Toque nos 3 pontinhos (⋮) no canto superior direito.',
    'Toque em "Adicionar à tela inicial".',
    'Confirme tocando em "Adicionar".',
  ],
  ios: [
    'Toque no ícone de compartilhar (📤) na barra inferior.',
    'Role para baixo e toque em "Adicionar à Tela de Início".',
    'Toque em "Adicionar" no canto superior direito.',
  ],
  windows: [
    'Toque no ícone de instalar na barra de endereços.',
    'Confirme a instalação.',
  ],
  other: [
    'Abra o menu do navegador.',
    'Procure "Instalar aplicativo" ou "Adicionar à tela inicial".',
  ],
};

const PLATFORM_LABELS: Record<string, string> = {
  android: 'Android',
  ios: 'iOS',
  windows: 'Windows',
  other: 'seu dispositivo',
};

export const InstallBanner: React.FC = () => {
  const { shouldShow, platform, canNativeInstall, install, dismiss } = useInstallPrompt();
  const [expanded, setExpanded] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (!shouldShow) return null;

  const instructions = PLATFORM_INSTRUCTIONS[platform] || PLATFORM_INSTRUCTIONS.other;

  const handleInstall = async () => {
    if (canNativeInstall) {
      setInstalling(true);
      try { await install(); } finally { setInstalling(false); }
    } else {
      setExpanded(!expanded);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] animate-slide-in-from-bottom">
      <div className="mx-auto max-w-lg px-4 pb-6 pt-2">
        <div className="bg-gradient-to-br from-[#051934] to-[#0a2540]/95 backdrop-blur-2xl px-5 pb-5 pt-4 rounded-[2rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16" />

          <button
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all z-20"
            aria-label="Dispensar"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-4 relative z-10">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-900 rounded-2xl flex items-center justify-center shadow-lg shrink-0 border border-white/10 ring-4 ring-blue-500/10">
              {canNativeInstall ? (
                <Download className="w-6 h-6 text-white" />
              ) : (
                <Smartphone className="w-6 h-6 text-white" />
              )}
            </div>

            <div className="flex-1 pr-6">
              <h4 className="text-white font-black text-sm uppercase tracking-tight mb-1">
                {canNativeInstall ? 'Instale o AMAR - CAP 5.3' : `Para ${PLATFORM_LABELS[platform]}`}
              </h4>
              <p className="text-white/60 text-[11px] leading-relaxed font-medium">
                {canNativeInstall
                  ? 'Acesse com um toque direto da sua tela inicial.'
                  : 'Instale o AMAR - CAP 5.3 na sua tela inicial para acesso rápido.'}
              </p>

              <button
                onClick={(e) => { e.stopPropagation(); handleInstall(); }}
                disabled={installing}
                className="mt-3 flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleInstall(); }}
              >
                {canNativeInstall ? (
                  <>
                    <MousePointerClick className="w-3.5 h-3.5" />
                    {installing ? 'Instalando...' : 'Instalar agora'}
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Como instalar
                    {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </>
                )}
              </button>

              {expanded && !canNativeInstall && (
                <div className="mt-3 bg-white/5 rounded-xl p-3 border border-white/10 animate-fade-in">
                  {instructions.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 mb-2 last:mb-0">
                      <span className="w-5 h-5 bg-blue-500/20 text-blue-300 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-white/70 text-[11px] leading-relaxed font-medium">{step}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
