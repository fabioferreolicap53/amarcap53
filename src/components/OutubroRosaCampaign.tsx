import React, { useEffect, useRef, useState } from 'react';
import { Ribbon, ArrowUpRight, X } from 'lucide-react';

const CAMPAIGN_URL = 'https://amarcap53global.pages.dev/';
const SHOW_DELAY_MS = 1500;   // espera antes de aparecer
const VISIBLE_MS = 9000;      // tempo flutuando na tela

type Phase = 'hidden' | 'shown' | 'leaving';

export const OutubroRosaCampaign: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('hidden');
  const dismissTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);
  const shownAt = useRef(0);
  const remaining = useRef(VISIBLE_MS);

  const clearDismiss = () => {
    if (dismissTimer.current) {
      window.clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  };

  const scheduleDismiss = (ms: number) => {
    shownAt.current = Date.now();
    dismissTimer.current = window.setTimeout(() => {
      setPhase('leaving');
      leaveTimer.current = window.setTimeout(() => setPhase('hidden'), 450);
    }, ms);
  };

  const hide = () => {
    clearDismiss();
    setPhase('leaving');
    leaveTimer.current = window.setTimeout(() => setPhase('hidden'), 450);
  };

  useEffect(() => {
    const showTimer = window.setTimeout(() => {
      setPhase('shown');
      remaining.current = VISIBLE_MS;
      scheduleDismiss(VISIBLE_MS);
    }, SHOW_DELAY_MS);

    return () => {
      window.clearTimeout(showTimer);
      clearDismiss();
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    };
  }, []);

  // Pausa a contagem ao passar o mouse/foco (dá tempo de clicar)
  const pause = () => {
    if (phase !== 'shown' || !dismissTimer.current) return;
    remaining.current = Math.max(400, remaining.current - (Date.now() - shownAt.current));
    clearDismiss();
  };
  const resume = () => {
    if (phase !== 'shown' || dismissTimer.current) return;
    scheduleDismiss(remaining.current);
  };

  if (phase === 'hidden') return null;

  return (
    <>
      <style>{`
        @keyframes rosaPopIn {
          0% { opacity: 0; transform: translateY(36px) scale(0.8) rotate(-4deg); }
          60% { opacity: 1; transform: translateY(-8px) scale(1.04) rotate(1.5deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
        }
        @keyframes rosaPopOut {
          to { opacity: 0; transform: translateY(24px) scale(0.9) rotate(3deg); }
        }
        @keyframes rosaFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        @keyframes rosaSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes rosaCountdown {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes rosaShimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
      `}</style>

      <div
        className="fixed right-4 bottom-4 sm:right-6 sm:bottom-6 z-[9998] w-[min(21rem,calc(100vw-2rem))] pointer-events-auto"
        style={{
          animation: phase === 'leaving'
            ? 'rosaPopOut 0.45s ease-in forwards'
            : 'rosaPopIn 0.7s cubic-bezier(0.22, 1.35, 0.36, 1) both',
        }}
        onMouseEnter={pause}
        onMouseLeave={resume}
        onFocus={pause}
        onBlur={resume}
      >
        <div className="relative" style={{ animation: 'rosaFloat 3.5s ease-in-out infinite' }}>
          {/* Bordado cônico giratório — moldura "ajoelhada" rosa */}
          <span
            aria-hidden
            className="absolute -inset-[3px] rounded-[1.9rem] blur-[2px] opacity-90"
            style={{
              background:
                'conic-gradient(from 0deg, #ff8ac4, #ec008c, #ffffff, #ff4fa3, #ec008c, #ff8ac4)',
              animation: 'rosaSpin 4s linear infinite',
            }}
          />

          <a
            href={CAMPAIGN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block rounded-[1.75rem] overflow-hidden bg-gradient-to-br from-[#ad1457] via-[#e91e69] to-[#ff4081] shadow-[0_18px_45px_rgba(233,30,105,0.55)] transition-shadow hover:shadow-[0_22px_60px_rgba(233,30,105,0.75)]"
          >
            {/* Brilhos internos */}
            <span aria-hidden className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-white/25 blur-2xl" />
            <span aria-hidden className="absolute -bottom-14 -right-8 w-36 h-36 rounded-full bg-fuchsia-300/30 blur-2xl" />
            {/* Sparkles piscando */}
            <span aria-hidden className="absolute top-3 right-12 w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            <span aria-hidden className="absolute bottom-8 left-3 w-1 h-1 rounded-full bg-white/90 animate-ping [animation-delay:0.6s]" />

            <div className="relative p-4 pr-9">
              <div className="flex items-center gap-3">
                {/* Selo do laço com anéis pulsantes */}
                <span className="relative shrink-0 w-12 h-12 rounded-2xl bg-white/15 border border-white/30 backdrop-blur-sm flex items-center justify-center ring-2 ring-pink-200/40">
                  <Ribbon className="w-6 h-6 text-white drop-shadow" />
                  <span aria-hidden className="absolute inset-0 rounded-2xl border-2 border-white/60 animate-ping [animation-delay:0.9s]" />
                </span>

                <div className="min-w-0">
                  <p
                    className="font-black uppercase leading-tight text-[15px] tracking-wide text-white bg-[linear-gradient(90deg,#fff,#ffd6e8,#fff,#ffc2e2,#fff)] bg-[length:200%_100%] bg-clip-text text-transparent"
                    style={{ animation: 'rosaShimmer 3s linear infinite' }}
                  >
                    Outubro Rosa 2026
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/80 leading-snug mt-0.5">
                    Campanha da CAP 5.3 · Dados do rastreamento
                  </p>
                </div>
              </div>

              {/* CTA */}
              <span className="mt-3.5 flex items-center justify-center gap-2 w-full rounded-xl bg-white py-2.5 px-2 text-[11px] font-black uppercase tracking-wide text-[#c2185b] shadow-lg shadow-pink-900/25 group-hover:bg-pink-50 group-hover:scale-[1.02] transition-all duration-300">
                Conheça os dados da campanha
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </span>
            </div>

            {/* Barra de tempo restante (pausa no hover) */}
            <span
              aria-hidden
              className="absolute bottom-0 left-0 h-1 bg-white/85 rounded-r-full group-hover:[animation-play-state:paused]"
              style={{ animation: 'rosaCountdown 9s linear forwards' }}
            />
          </a>

          {/* Fechar — irmão do <a> (button dentro de âncora é inválido) */}
          <button
            onClick={hide}
            aria-label="Fechar campanha Outubro Rosa"
            className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
};
