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
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  value,
  onChange,
  label,
  placeholder = "Selecionar...",
  className = "",
  disabled = false,
  showSearch = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedOptions: Option[] = options.map(opt => 
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const filteredOptions = normalizedOptions.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 12,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  const handleOpen = () => {
    if (!disabled) {
      updatePosition();
      setIsOpen(true);
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleUpdate = () => updatePosition();
      window.addEventListener('scroll', handleUpdate, true);
      window.addEventListener('resize', handleUpdate);
      return () => {
        window.removeEventListener('scroll', handleUpdate, true);
        window.removeEventListener('resize', handleUpdate);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('.multiselect-portal-content')) {
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
              onClick={clearAll}
              className="p-1 hover:bg-rose-500/10 rounded-lg text-rose-500/40 hover:text-rose-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-primary/40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && dropdownPosition && createPortal(
        <div 
          className="multiselect-portal-content fixed z-[9999] animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300 origin-top"
          style={{ 
            top: dropdownPosition.top, 
            left: dropdownPosition.left, 
            width: dropdownPosition.width 
          }}
        >
          <div className="bg-white border border-primary/10 rounded-[2rem] shadow-[0px_25px_70px_rgba(0,0,0,0.2)] p-4 backdrop-blur-xl bg-white/95 ring-1 ring-black/5">
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

            <div className="max-h-[250px] overflow-y-auto no-scrollbar space-y-1">
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
        </div>,
        document.body
      )}
    </div>
  );
};
