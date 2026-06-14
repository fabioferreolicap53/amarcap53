import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerPTBRProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  isISO?: boolean;
}

type PickerView = 'days' | 'months' | 'years';

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const DatePickerPTBR: React.FC<DatePickerPTBRProps> = ({
  value,
  onChange,
  label,
  placeholder = 'DD/MM/YYYY',
  className = '',
  isISO = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState('');
  const [view, setView] = useState<PickerView>('days');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value || value === '--') {
      setDisplayValue('');
      return;
    }
    if (isISO && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const [y, m, d] = value.split('-');
      setDisplayValue(`${d}/${m}/${y}`);
      setCurrentYear(parseInt(y));
      setCurrentMonth(parseInt(m) - 1);
    } else {
      setDisplayValue(value);
    }
  }, [value, isISO]);

  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const calHeight = 320;
      const calWidth = 280;
      const gap = 8;
      let left = rect.left + window.scrollX + (rect.width - calWidth) / 2;
      left = Math.max(16, Math.min(left, window.innerWidth - calWidth - 16));
      const spaceBelow = window.innerHeight - rect.bottom;
      let top: number;
      if (spaceBelow >= calHeight + gap) {
        top = rect.bottom + window.scrollY + gap;
      } else {
        top = rect.top + window.scrollY - calHeight - gap;
        if (top < window.scrollY + 16) top = window.scrollY + 16;
      }
      setDropdownPosition({ top, left, width: calWidth });
    }
  };

  const handleOpen = () => {
    if (window.innerWidth < 1024) return;
    updatePosition();
    setView('days');
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsOpen(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const h = () => updatePosition();
      window.addEventListener('scroll', h, true);
      window.addEventListener('resize', h);
      return () => {
        window.removeEventListener('scroll', h, true);
        window.removeEventListener('resize', h);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!(e.target as HTMLElement).closest('.datepicker-portal-content')) {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Calendar math
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const selectDay = (day: number) => {
    const d = String(day).padStart(2, '0');
    const m = String(currentMonth + 1).padStart(2, '0');
    const y = currentYear;
    onChange(isISO ? `${y}-${m}-${d}` : `${d}/${m}/${y}`);
    setIsOpen(false);
  };

  const selectMonth = (m: number) => {
    setCurrentMonth(m);
    setView('days');
  };

  const selectYear = (y: number) => {
    setCurrentYear(y);
    setView('months');
  };

  const setQuickDate = (offset: number | null) => {
    if (offset === null) {
      onChange('');
    } else {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      onChange(isISO ? `${y}-${m}-${d}` : `${d}/${m}/${y}`);
    }
    setIsOpen(false);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.replace(/\D/g, '');
    if (input.length > 8) input = input.slice(0, 8);
    let formatted = '';
    if (input.length > 0) {
      formatted += input.slice(0, 2);
      if (input.length > 2) formatted += '/' + input.slice(2, 4);
      if (input.length > 4) formatted += '/' + input.slice(4, 8);
    }
    setDisplayValue(formatted);
    if (input.length === 8) {
      const [d, m, y] = [input.slice(0, 2), input.slice(2, 4), input.slice(4, 8)];
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      if (date.getFullYear() === +y && date.getMonth() === +m - 1 && date.getDate() === +d) {
        onChange(isISO ? `${y}-${m}-${d}` : `${d}/${m}/${y}`);
      }
    } else if (input.length === 0) {
      onChange('');
    }
  };

  /* ── Year grid ── */
  const yearStart = currentYear - 6;
  const years = Array.from({ length: 13 }, (_, i) => yearStart + i);

  /* ── Calendar header ── */
  const CalendarHeader = (
    <div className="flex items-center justify-between mb-4">
      {view === 'days' && (
        <>
          <button type="button" onClick={() => { setView('years'); }} className="text-[11px] font-black text-on-surface/80 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/5">
            {currentYear}
          </button>
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); } else setCurrentMonth(m => m - 1); }}
              className="p-1.5 hover:bg-primary/5 rounded-lg text-on-surface/30 hover:text-primary transition-all">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setView('months')} className="text-[11px] font-black text-on-surface/70 hover:text-primary px-3 py-1 rounded-lg hover:bg-primary/5 transition-all uppercase tracking-wider">
              {MONTHS[currentMonth]}
            </button>
            <button type="button" onClick={() => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); } else setCurrentMonth(m => m + 1); }}
              className="p-1.5 hover:bg-primary/5 rounded-lg text-on-surface/30 hover:text-primary transition-all">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="w-12" />
        </>
      )}
      {view === 'months' && (
        <>
          <button type="button" onClick={() => setView('years')} className="text-[11px] font-black text-on-surface/80 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/5">
            {currentYear}
          </button>
          <span className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest">Selecionar mês</span>
          <div className="w-12" />
        </>
      )}
      {view === 'years' && (
        <>
          <span className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest">Selecionar ano</span>
          <div className="w-12" />
          <div className="w-12" />
        </>
      )}
    </div>
  );

  /* ── Views ── */
  const DaysView = (
    <>
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map(d => <div key={d} className="text-[8px] font-bold text-on-surface/25 uppercase text-center py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-[2px]">
        {days.map((day, i) => {
          const isToday = day && new Date().toDateString() === new Date(currentYear, currentMonth, day).toDateString();
          const isSelected = day && displayValue === `${String(day).padStart(2, '0')}/${String(currentMonth + 1).padStart(2, '0')}/${currentYear}`;
          return (
            <button
              key={i}
              type="button"
              disabled={!day}
              onClick={() => day && selectDay(day)}
              className={`
                h-8 text-[11px] font-bold flex items-center justify-center rounded-lg transition-all
                ${!day ? 'invisible' : 'cursor-pointer hover:bg-primary/8'}
                ${isSelected ? 'bg-[#0a1628] text-white shadow-md' : isToday ? 'text-primary font-black' : 'text-on-surface/60 hover:text-primary'}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </>
  );

  const MonthsView = (
    <div className="grid grid-cols-3 gap-2">
      {MONTH_SHORT.map((m, i) => (
        <button
          key={m}
          type="button"
          onClick={() => selectMonth(i)}
          className={`
            py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all
            ${i === currentMonth ? 'bg-[#0a1628] text-white shadow-md' : 'text-on-surface/50 hover:bg-primary/5 hover:text-primary'}
          `}
        >
          {m}
        </button>
      ))}
    </div>
  );

  const YearsView = (
    <>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setCurrentYear(y => y - 13)} className="p-1.5 hover:bg-primary/5 rounded-lg text-on-surface/30 hover:text-primary transition-all">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest">{yearStart}–{yearStart + 12}</span>
        <button type="button" onClick={() => setCurrentYear(y => y + 13)} className="p-1.5 hover:bg-primary/5 rounded-lg text-on-surface/30 hover:text-primary transition-all">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {years.map(y => (
          <button
            key={y}
            type="button"
            onClick={() => selectYear(y)}
            className={`
              py-3 rounded-xl text-[11px] font-bold transition-all
              ${y === currentYear ? 'bg-[#0a1628] text-white shadow-md' : 'text-on-surface/50 hover:bg-primary/5 hover:text-primary'}
            `}
          >
            {y}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <div className={`space-y-1.5 flex-1 min-w-[140px] relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-[10px] font-black text-primary/50 uppercase tracking-widest ml-1">
          {label}
        </label>
      )}
      <div className="relative group">
        <input
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          value={displayValue}
          onChange={handleTextChange}
          onFocus={handleOpen}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full p-3 pr-10 bg-surface-container-low border-2 border-transparent rounded-xl text-xs font-bold text-on-surface outline-none focus:border-primary/20 transition-all hover:bg-surface-container placeholder:text-on-surface/20 shadow-sm focus:shadow-md"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {displayValue && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(''); }}
              className="p-1.5 hover:bg-rose-500/10 rounded-lg text-rose-500/40 hover:text-rose-500 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" onClick={(e) => { e.stopPropagation(); if (window.innerWidth < 1024) return; isOpen ? setIsOpen(false) : handleOpen(); }}
            className={`p-2 rounded-xl transition-all ${isOpen ? 'bg-primary text-white scale-105' : 'bg-primary/5 text-primary hover:bg-primary/10 group-hover:scale-105'} lg:flex hidden`}>
            <CalendarIcon className="w-4 h-4" />
          </button>
          <div className="px-2.5 py-1.5 bg-slate-100 text-slate-400 rounded-xl lg:hidden flex items-center">
            <span className="text-[10px] font-black tracking-widest">123</span>
          </div>
        </div>
      </div>

      {isOpen && dropdownPosition && createPortal(
        <div
          className="datepicker-portal-content fixed z-[9999] max-w-[95vw]"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width }}
        >
          <div className="bg-white/95 backdrop-blur-xl border border-on-surface/[0.06] rounded-2xl shadow-[0_12px_48px_rgba(0,0,0,0.12)] p-4">
            {/* Quick actions */}
            <div className="flex gap-1.5 mb-3">
              <button type="button" onClick={() => setQuickDate(0)}
                className="flex-1 py-2 bg-on-surface/[0.03] hover:bg-primary text-on-surface/50 hover:text-white text-[9px] font-bold uppercase rounded-lg transition-all">
                Hoje
              </button>
              <button type="button" onClick={() => setQuickDate(null)}
                className="flex-1 py-2 bg-on-surface/[0.03] hover:bg-rose-500 text-on-surface/50 hover:text-white text-[9px] font-bold uppercase rounded-lg transition-all">
                Limpar
              </button>
            </div>

            {CalendarHeader}

            {view === 'days' && DaysView}
            {view === 'months' && MonthsView}
            {view === 'years' && YearsView}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
