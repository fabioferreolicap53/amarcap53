import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerPTBRProps {
  value: string; // ISO date YYYY-MM-DD or DD/MM/YYYY
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  isISO?: boolean; // If true, expects/returns YYYY-MM-DD
}

export const DatePickerPTBR: React.FC<DatePickerPTBRProps> = ({ 
  value, 
  onChange, 
  label, 
  placeholder = "DD/MM/YYYY",
  className = "",
  isISO = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal display value when external value changes
  useEffect(() => {
    if (!value || value === '--') {
      setDisplayValue('');
      return;
    }

    if (isISO && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const [y, m, d] = value.split('-');
      setDisplayValue(`${d}/${m}/${y}`);
    } else {
      setDisplayValue(value);
    }
  }, [value, isISO]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const days = [];
  const totalDays = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const firstDay = getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());

  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= totalDays; i++) days.push(i);

  const handleDateSelect = (day: number) => {
    const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const d = String(selected.getDate()).padStart(2, '0');
    const m = String(selected.getMonth() + 1).padStart(2, '0');
    const y = selected.getFullYear();
    
    const formatted = `${d}/${m}/${y}`;
    const iso = `${y}-${m}-${d}`;
    
    onChange(isISO ? iso : formatted);
    setIsOpen(false);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.replace(/\D/g, '');
    if (input.length > 8) input = input.slice(0, 8);

    let formatted = '';
    if (input.length > 0) {
      formatted += input.slice(0, 2);
      if (input.length > 2) {
        formatted += '/' + input.slice(2, 4);
        if (input.length > 4) {
          formatted += '/' + input.slice(4, 8);
        }
      }
    }

    setDisplayValue(formatted);

    if (input.length === 8) {
      const d = input.slice(0, 2);
      const m = input.slice(2, 4);
      const y = input.slice(4, 8);
      
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      if (
        date.getFullYear() === parseInt(y) && 
        date.getMonth() === parseInt(m) - 1 && 
        date.getDate() === parseInt(d)
      ) {
        onChange(isISO ? `${y}-${m}-${d}` : `${d}/${m}/${y}`);
      }
    } else if (input.length === 0) {
      onChange('');
    }
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
          value={displayValue}
          onChange={handleTextChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full p-4 pr-12 bg-surface-container-low border-2 border-transparent rounded-2xl text-sm font-bold text-on-surface outline-none focus:border-primary/20 transition-all hover:bg-surface-container placeholder:text-on-surface/20 shadow-sm focus:shadow-md"
        />
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {displayValue && (
            <button 
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              className="p-1.5 hover:bg-rose-500/10 rounded-lg text-rose-500/40 hover:text-rose-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
            className={`p-2 rounded-xl transition-all ${isOpen ? 'bg-primary text-white scale-105' : 'bg-primary/5 text-primary hover:bg-primary/10 group-hover:scale-105'}`}
          >
            <CalendarIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-primary/10 rounded-[2rem] shadow-[0px_25px_70px_rgba(0,0,0,0.2)] z-[100] p-6 w-[280px] md:w-[300px] animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl bg-white/95">
          <div className="flex gap-2 mb-6">
            <button 
              onClick={() => setQuickDate(0)}
              className="flex-1 py-2.5 bg-primary/5 hover:bg-primary text-primary hover:text-white text-[10px] font-black uppercase rounded-xl transition-all border border-primary/10 hover:border-transparent hover:shadow-lg hover:shadow-primary/20"
            >
              Hoje
            </button>
            <button 
              onClick={() => setQuickDate(null)}
              className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white text-[10px] font-black uppercase rounded-xl transition-all border border-rose-100 hover:border-transparent hover:shadow-lg hover:shadow-rose-200"
            >
              Limpar
            </button>
          </div>
          
          <div className="flex items-center justify-between mb-6 px-1">
            <button 
              onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} 
              className="p-2 hover:bg-slate-100 rounded-xl transition-all active:scale-90"
            >
              <ChevronLeft className="w-5 h-5 text-primary" />
            </button>
            <div className="text-center">
              <span className="text-xs font-black uppercase text-slate-800 tracking-widest block">{months[currentMonth.getMonth()]}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{currentMonth.getFullYear()}</span>
            </div>
            <button 
              onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} 
              className="p-2 hover:bg-slate-100 rounded-xl transition-all active:scale-90"
            >
              <ChevronRight className="w-5 h-5 text-primary" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-3">
            {daysOfWeek.map(d => <div key={d} className="text-[9px] font-black text-slate-300 uppercase text-center py-1">{d}</div>)}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              const isToday = day && new Date().toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString();
              const isSelected = day && displayValue === `${String(day).padStart(2, '0')}/${String(currentMonth.getMonth() + 1).padStart(2, '0')}/${currentMonth.getFullYear()}`;
              
              return (
                <div 
                  key={i} 
                  onClick={() => day && handleDateSelect(day)}
                  className={`
                    text-[11px] font-black h-9 flex items-center justify-center rounded-xl transition-all relative
                    ${day ? 'cursor-pointer hover:bg-primary/10 hover:text-primary active:scale-90' : ''}
                    ${isSelected ? 'bg-primary !text-white shadow-lg shadow-primary/30 z-10 scale-105' : 'text-slate-600'}
                    ${isToday && !isSelected ? 'text-primary' : ''}
                  `}
                >
                  {day}
                  {isToday && !isSelected && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
