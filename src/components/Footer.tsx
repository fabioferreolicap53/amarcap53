import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-8 mt-12 border-t border-primary/5">
      <div className="max-w-[1500px] mx-auto px-4 flex flex-col items-center gap-2">
        <div className="h-px w-12 bg-primary/10 mb-2" />
        <p className="text-[10px] md:text-[11px] font-black text-primary/30 uppercase tracking-[0.3em] text-center">
          Desenvolvido por <span className="text-primary/50">Fabio Ferreira de Oliveira</span>
        </p>
        <p className="text-[9px] font-bold text-primary/20 uppercase tracking-widest">
          DAPS / CAP 5.3
        </p>
      </div>
    </footer>
  );
};
