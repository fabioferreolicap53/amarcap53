import React, { useEffect, useState } from 'react';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message,
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (visible) requestAnimationFrame(() => setMounted(true));
    else setMounted(false);
  }, [visible]);

  if (!visible && !mounted) return null;

  return (
    <div
      className="fixed bottom-5 left-5 z-[200] pointer-events-none transition-all duration-300 ease-out"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(8px)',
      }}
    >
      <div className="flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-xl bg-[#0a1628]/90 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/[0.07]">
        <div className="relative w-3 h-3">
          <div className="absolute inset-0 rounded-full border-[2px] border-white/10" />
          <div className="absolute inset-0 rounded-full border-[2px] border-transparent border-t-white/70 animate-spin" style={{ animationDuration: '0.7s' }} />
        </div>
        {message && (
          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/40">
            {message}
          </span>
        )}
      </div>
    </div>
  );
};
