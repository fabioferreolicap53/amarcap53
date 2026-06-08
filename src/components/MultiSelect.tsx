import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';

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
  placeholder = "Selecionar...",
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
      const dropdownHeight = 300; // Altura máxima estimada
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

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className={`space-y-1.5 flex-1 min-w-[180px] relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-[10px] font-black text-primary/50 uppercase tracking-widest ml-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div 
        onClick={handleOpen}
        className={`
          min-h-[56px] w-full p-2 pl-4 pr-10 bg-surface-container-low border-2 rounded-2xl transition-all cursor-pointer flex flex-wrap gap-2 items-center
          ${isOpen ? 'border-primary/20 bg-white shadow-md' : 'border-transparent hover:bg-surface-container'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {value.length === 0 ? (
          <span className="text-sm font-bold text-on-surface/20 uppercase tracking-tight">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1.5 pr-6">
            {value.map(v => {
              const label = normalizedOptions.find(o => o.value === v)?.label || v;
              return (
                <span 
                  key={v} 
                  className="bg-primary/10 text-primary text-[10px] font-black uppercase py-1 px-2.5 rounded-lg flex items-center gap-1.5 border border-primary/5 hover:bg-primary/20 transition-colors"
                >
                  {label}
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
            className={`multiselect-dropdown-content z-[9999] animate-in fade-in duration-200 ${
              portalHost
                ? 'absolute'
                : `absolute inset-x-0 ${dropdownPosition.openAbove ? 'bottom-full mb-2 slide-in-from-bottom-1 origin-bottom' : 'top-full mt-2 slide-in-from-top-1 origin-top'}`
            }`}
            style={portalHost ? {
              top: dropdownPosition.openAbove
                ? dropdownPosition.top - dropdownPosition.maxHeight - containerRef.current!.offsetHeight - 8
                : dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width
            } : undefined}
          >
            <div className="bg-white border border-primary/10 rounded-2xl shadow-[0px_15px_40px_rgba(0,0,0,0.15)] p-3 backdrop-blur-xl bg-white/98 ring-1 ring-black/5">
            {showSearch && (
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full bg-slate-50 border border-slate-100 p-3 pl-11 rounded-2xl text-xs font-bold outline-none focus:border-primary/20 transition-all"
                  autoFocus
                />
              </div>
            )}

            <div className="overflow-y-auto no-scrollbar space-y-1" style={{ maxHeight: dropdownPosition.maxHeight }}>
              {filteredOptions.length === 0 ? (
                <p className="text-[10px] font-bold text-slate-400 text-center py-4 uppercase">Nenhum resultado</p>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = value.includes(opt.value);
                  return (
                    <div
                      key={opt.value}
                      onClick={() => toggleOption(opt.value)}
                      className={`
                        flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all
                        ${isSelected ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-slate-50 text-slate-600'}
                      `}
                    >
                      <span className="text-xs font-bold uppercase tracking-tight">{opt.label}</span>
                      {isSelected && <Check className="w-4 h-4" />}
                    </div>
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
