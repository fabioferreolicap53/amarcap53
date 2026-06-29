import React from 'react';
import { ClipboardList, Grip } from 'lucide-react';
import { useLongPress } from '../hooks/useLongPress';

/**
 * Botão "Acomp." com long press.
 * - Clique curto: abre modal de novo acompanhamento
 * - Segurar (500ms): navega pra lista de acompanhamentos do paciente
 */
export function AcompButton({ paciente, onOpenModal, onLongPress }: {
  paciente: any;
  onOpenModal: () => void;
  onLongPress: () => void;
}) {
  const longPressProps = useLongPress(onLongPress, onOpenModal);
  const hasAcomp = (paciente.total_acompanhamentos || 0) > 0;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        {...longPressProps}
        className={`h-10 w-24 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-tight shadow-md transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 border relative ${
          hasAcomp
            ? 'bg-[#001b3d] hover:bg-[#002b5c] text-white border-white/10 shadow-blue-900/15 hover:shadow-lg hover:shadow-blue-900/20 hover:-translate-y-0.5'
            : 'bg-slate-100 text-slate-400 border-slate-200 cursor-default'
        }`}
        title={hasAcomp ? 'Clique: novo acompanhamento | Segurar: ver acompanhamentos' : 'Sem acompanhamentos registrados'}
      >
        <ClipboardList className="w-3.5 h-3.5" />
        <span>Acomp.</span>
        {hasAcomp && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-5 px-1 flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full border-2 border-[#001b3d] shadow-md z-10">
            {paciente.total_acompanhamentos}
          </span>
        )}
      </button>
      {hasAcomp && (
        <span className="text-[7px] text-slate-400 font-medium flex items-center gap-0.5 select-none">
          <Grip className="w-2 h-2" /> segurar
        </span>
      )}
    </div>
  );
}
