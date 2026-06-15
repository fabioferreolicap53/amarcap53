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
