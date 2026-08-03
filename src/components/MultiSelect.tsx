import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';

interface Option {
  label: string;
  value: string;
}

interface MultiSelectProps {
  options: string[] | Option[];
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showSearch?: boolean;
  required?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  value,
  onChange,
  label,
  placeholder = "Selecione",
  className = "",
  disabled = false,
  showSearch = true,
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number; openAbove: boolean; maxHeight: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const normalizedOptions: Option[] = options.map(opt => 
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const filteredOptions = normalizedOptions.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const portalHost = containerRef.current.closest('[data-dropdown-root="true"]') as HTMLElement | null;
      const hostRect = portalHost?.getBoundingClientRect();
      const dropdownHeight = 300;
      const viewportPadding = 12;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      const shouldOpenAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
      const availableHeight = shouldOpenAbove ? spaceAbove - viewportPadding : spaceBelow - viewportPadding;
      const maxHeight = Math.max(Math.min(availableHeight, dropdownHeight), 160);
      
      setDropdownPosition({
        top: hostRect ? rect.bottom - hostRect.top + 8 : 0,
        left: hostRect ? rect.left - hostRect.left : 0,
        width: rect.width,
        openAbove: shouldOpenAbove,
        maxHeight
      });
    }
  };

  const scheduleUpdatePosition = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      updatePosition();
      rafRef.current = null;
    });
  };

  const handleOpen = () => {
    if (!disabled) {
      scheduleUpdatePosition();
      setIsOpen(true);
    }
  };

  useEffect(() => {
    if (isOpen) {
      scheduleUpdatePosition();
      const handleUpdate = () => scheduleUpdatePosition();
      window.addEventListener('scroll', handleUpdate, true);
      window.addEventListener('resize', handleUpdate);
      return () => {
        window.removeEventListener('scroll', handleUpdate, true);
        window.removeEventListener('resize', handleUpdate);
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('.multiselect-dropdown-content')) {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (optValue: string) => {
    const newValue = value.includes(optValue)
      ? value.filter(v => v !== optValue)
      : [...value, optValue];
    onChange(newValue);
  };

  const removeValue = (e: React.MouseEvent, optValue: string) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== optValue));
  };

  const selectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(filteredOptions.map(o => o.value));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className={`space-y-1.5 flex-1 min-w-[180px] relative ${className}`} ref={containerRef}>
      {label && (
        <label className="flex items-center gap-2 text-[0.65rem] font-bold text-slate-400 uppercase tracking-[0.15em] ml-0.5">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div 
        onClick={handleOpen}
        className={`
          min-h-[56px] w-full px-4 pr-10 bg-white border border-slate-200/60 rounded-xl transition-all cursor-pointer flex flex-wrap gap-2 items-center
          ${isOpen ? 'ring-2 ring-primary/20 border-primary bg-white shadow-md' : 'hover:border-slate-300 shadow-sm'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {(Array.isArray(value) ? value.length : 0) === 0 ? (
          <span className="text-sm font-bold text-slate-400 uppercase tracking-tight">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1.5 pr-6">
            {(Array.isArray(value) ? value : []).map(v => {
              const lbl = normalizedOptions.find(o => o.value === v)?.label || v;
              return (
                <span 
                  key={v} 
                  className="bg-gradient-to-r from-[#1c2e4a] to-[#253c61] text-white text-[10px] font-black uppercase py-1 px-2.5 rounded-lg flex items-center gap-1.5 shadow-md shadow-primary/20 hover:from-[#253c61] hover:to-[#1c2e4a] transition-colors"
                >
                  {lbl}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={(e) => removeValue(e, v)}
                  />
                </span>
              );
            })}
          </div>
        )}
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value.length > 0 && (
            <button 
              type="button"
              onClick={clearAll}
              className="p-1 hover:bg-rose-500/10 rounded-lg text-rose-500/40 hover:text-rose-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-primary/40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && dropdownPosition && (() => {
        const portalHost = containerRef.current?.closest('[data-dropdown-root="true"]') as HTMLElement | null;
        const dropdownContent = (
          <div 
            className={`multiselect-dropdown-content z-[99999] animate-in fade-in duration-200 ${
              portalHost
                ? 'absolute'
                : `absolute inset-x-0 ${dropdownPosition.openAbove ? 'bottom-full mb-2 slide-in-from-bottom-1 origin-bottom' : 'top-full mt-1.5 slide-in-from-top-1 origin-top'}`
            }`}
            style={portalHost ? {
              top: dropdownPosition.openAbove
                ? dropdownPosition.top - dropdownPosition.maxHeight - containerRef.current!.offsetHeight - 8
                : dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width
            } : undefined}
          >
            <div className="w-full rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10 ring-1 ring-black/5 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-3 py-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {value.length === 0 ? 'Nenhum selecionado' : `${value.length} selecionado${value.length > 1 ? 's' : ''}`}
                </span>
                <div className="flex items-center gap-1.5">
                  <button 
                    type="button"
                    onClick={selectAll}
                    className="rounded-lg px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider transition-all duration-150 hover:scale-105 active:scale-95"
                  >
                    <span className="text-cyan-600 hover:text-cyan-700">Todas</span>
                  </button>
                  <div className="h-3 w-px bg-slate-200" />
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                    className="rounded-lg bg-gradient-to-r from-slate-800 to-slate-700 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm transition-all duration-150 hover:from-slate-700 hover:to-slate-600 hover:shadow-md active:scale-95"
                  >
                    Concluir
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="max-h-56 overflow-y-auto p-1.5" style={{ maxHeight: dropdownPosition.maxHeight }}>
                {filteredOptions.length === 0 ? (
                  <p className="text-[10px] font-bold text-slate-400 text-center py-4 uppercase">Nenhum resultado</p>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = value.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleOption(opt.value)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${
                          isSelected ? 'bg-cyan-50 text-cyan-700' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-200 ${
                          isSelected ? 'border-cyan-500 bg-cyan-500' : 'border-slate-300 hover:border-cyan-300'
                        }`}>
                          {isSelected && (
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          )}
                        </span>
                        <span className={`text-[11px] font-bold uppercase tracking-wide leading-tight transition-colors duration-150 ${
                          isSelected ? 'text-cyan-700' : ''
                        }`}>{opt.label}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );

        return portalHost ? createPortal(dropdownContent, portalHost) : dropdownContent;
      })()}
    </div>
  );
};
