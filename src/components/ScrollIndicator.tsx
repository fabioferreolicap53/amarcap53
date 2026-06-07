import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, MousePointer2 } from 'lucide-react';

export const ScrollIndicator: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = indicatorRef.current?.parentElement;
    const scrollableChild = parent?.querySelector('.overflow-x-auto') as HTMLElement;

    if (!scrollableChild) return;

    const checkScroll = () => {
      if (scrollableChild) {
        const canScroll = scrollableChild.scrollWidth > scrollableChild.clientWidth + 10; // Margem de erro
        setIsVisible(canScroll && !hasScrolled);
      }
    };

    // Observer para detectar mudanças de tamanho (carregamento de dados ou redimensionamento)
    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
    });

    resizeObserver.observe(scrollableChild);

    const handleScroll = () => {
      if (scrollableChild.scrollLeft > 20) {
        setHasScrolled(true);
        setIsVisible(false);
      }
    };

    scrollableChild.addEventListener('scroll', handleScroll, { passive: true });

    // Auto-hide após 8 segundos
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 8000);

    return () => {
      resizeObserver.disconnect();
      scrollableChild.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, [hasScrolled]);

  // Se não estiver visível, renderiza um div invisível para manter o ref e o parent check funcionando
  if (!isVisible) return <div ref={indicatorRef} className="hidden" aria-hidden="true" />;

  return (
    <div 
      ref={indicatorRef}
      className="lg:hidden fixed md:absolute right-4 bottom-24 md:top-1/2 md:-translate-y-1/2 z-50 pointer-events-none animate-in fade-in zoom-in slide-in-from-right-10 duration-700"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="bg-primary/95 backdrop-blur-2xl p-4 rounded-[2.5rem] shadow-[0_20px_60px_rgba(var(--primary-rgb),0.5)] border border-white/30 flex items-center gap-4 animate-bounce ring-8 ring-primary/5">
          <div className="flex flex-col">
            <span className="text-[12px] font-black text-white uppercase tracking-tighter leading-none">Deslize</span>
            <span className="text-[9px] font-bold text-white/50 uppercase tracking-[0.2em] mt-1.5">Ver Tabela</span>
          </div>
          <div className="relative bg-white/10 p-2.5 rounded-2xl shadow-inner">
            <ChevronRight className="w-7 h-7 text-white animate-pulse" />
            <MousePointer2 className="w-5 h-5 text-blue-300 absolute -bottom-1 -right-1 rotate-12 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
          </div>
        </div>
        
        {/* Barra de progresso visual de tempo */}
        <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-md border border-white/5">
          <div className="h-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)] animate-[shrink_8s_linear_forwards]" />
        </div>
      </div>
    </div>
  );
};
