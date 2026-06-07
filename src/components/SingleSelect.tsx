import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';

interface Option {
  label: string;
  value: string;
}

interface SingleSelectProps {
  options: string[] | Option[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  icon?: React.ReactNode;
  showSearch?: boolean;
}

export const SingleSelect: React.FC<SingleSelectProps> = ({
  options,
  value,
  onChange,
  label,
  placeholder = "Selecionar...",
  className = "",
  disabled = false,
  required = false,
  icon,
  showSearch = false
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

  const selectedOption = normalizedOptions.find(opt => opt.value === value);

  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownHeight = 300; // Altura máxima estimada
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      let top = rect.bottom + window.scrollY + 8;
      
      // Se não houver espaço embaixo e houver mais espaço em cima, inverte
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        top = rect.top + window.scrollY - dropdownHeight - 8;
      }

      setDropdownPosition({
        top: top,
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
        if (!target.closest('.singleselect-portal-content')) {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const clearValue = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div className={`space-y-2 flex-1 relative ${className}`} ref={containerRef}>
      {label && (
        <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em]">
          {icon && (
            <div className="p-1 rounded bg-primary/5 group-focus-within:bg-primary/10 transition-colors">
              {icon}
            </div>
          )}
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      
      <button 
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={`
          h-[56px] w-full px-4 bg-white border border-outline-variant/30 rounded-xl transition-all cursor-pointer flex items-center justify-between
          ${isOpen ? 'ring-2 ring-primary/20 border-primary shadow-md' : 'hover:border-primary/40 shadow-sm'}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}
        `}
      >
        <span className={`text-sm font-medium truncate ${!selectedOption ? 'text-on-surface/30' : 'text-on-surface'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        
        <div className="flex items-center gap-2">
          {value && !required && !disabled && (
            <button 
              type="button"
              onClick={clearValue}
              className="p-1 hover:bg-rose-500/10 rounded-lg text-rose-500/40 hover:text-rose-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-primary/40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && dropdownPosition && createPortal(
        <div 
          className="singleselect-portal-content fixed z-[10001] animate-in fade-in slide-in-from-top-1 duration-200 origin-top"
          style={{ 
            top: dropdownPosition.top, 
            left: dropdownPosition.left, 
            width: dropdownPosition.width 
          }}
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

            <div className="max-h-[250px] overflow-y-auto no-scrollbar space-y-1">
              {filteredOptions.length === 0 ? (
                <p className="text-[10px] font-bold text-slate-400 text-center py-4 uppercase">Nenhum resultado</p>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = value === opt.value;
                  return (
                    <div
                      key={opt.value}
                      onClick={() => handleSelect(opt.value)}
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
