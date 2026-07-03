import React, { useEffect, useState } from 'react';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  /** Variante "card" = card dark centralizado (imagem 2). Default = rodapé. */
  variant?: 'default' | 'card';
  /** Título principal exibido no variant card */
  title?: string;
  /** Subtítulo exibido no variant card */
  subtitle?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message,
  variant = 'default',
  title,
  subtitle,
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (visible) requestAnimationFrame(() => setMounted(true));
    else setMounted(false);
  }, [visible]);

  if (!visible && !mounted) return null;

  if (variant === 'card') {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-[#001b3d]/80 backdrop-blur-sm transition-opacity duration-500"
        style={{ opacity: mounted ? 1 : 0 }}
      >
        <div
          className="flex flex-col items-center gap-4 px-12 py-10 rounded-3xl bg-gradient-to-b from-[#001b3d] to-[#002b5c] shadow-2xl border border-white/5 transition-all duration-500"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          }}
        >
          {/* Spinner */}
          <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
            <path
              d="M20 4a16 16 0 0 1 16 16"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              className="animate-spin"
              style={{ transformOrigin: 'center', animationDuration: '0.9s' }}
            />
          </svg>

          {/* Título */}
          {title && (
            <h3 className="text-white text-base md:text-lg font-black uppercase tracking-widest text-center leading-tight">
              {title}
            </h3>
          )}

          {/* Subtítulo (grupo, etc) */}
          {subtitle && (
            <p className="text-purple-400 text-sm font-black uppercase tracking-wider text-center">
              {subtitle}
            </p>
          )}

          {/* Mensagem */}
          {message && (
            <p className="text-white/40 text-[11px] font-bold text-center max-w-xs">
              {message}
            </p>
          )}

          {/* Dots animados */}
          <div className="flex gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  // Variante default (rodapé)
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[200] pointer-events-none flex justify-center transition-all duration-700 ease-out"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(20px)',
      }}
    >
      <div className="mb-5 sm:mb-6 flex flex-col items-center gap-1 px-5 py-2.5 rounded-full bg-transparent shadow-none">
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="4.5" stroke="rgba(5,25,52,0.1)" strokeWidth="1.5" />
          <path
            d="M6 1.5a4.5 4.5 0 0 1 4.5 4.5"
            stroke="rgba(5,25,52,0.6)"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="animate-spin"
            style={{ transformOrigin: 'center', animationDuration: '0.9s' }}
          />
        </svg>
        {message && (
          <span className="text-[7px] font-semibold uppercase tracking-[0.18em] text-[#051934]/50 whitespace-nowrap leading-none">
            {message}
          </span>
        )}
      </div>
    </div>
  );
};
