import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption<T = string | number> {
  value: T;
  label: string;
  badge?: string;
  description?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps<T = string | number> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

export function CustomSelect<T = string | number>({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
  buttonClassName = '',
  menuClassName = '',
  icon,
  size = 'md',
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const paddingClass = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs';

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 rounded-xl bg-studio-card border border-studio-border text-studio-text hover:border-accent/40 focus:outline-none focus:border-accent transition-all select-none shadow-studio-subtle font-medium ${paddingClass} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="text-accent flex-shrink-0">{icon}</span>}
          {selectedOption?.icon && (
            <span className="text-studio-textMuted flex-shrink-0">{selectedOption.icon}</span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-accent-muted text-accent border border-accent/20">
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-studio-textMuted transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180 text-accent' : ''
          }`}
        />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 mt-1.5 min-w-[200px] w-max max-w-xs z-50 rounded-xl bg-studio-surface border border-studio-border shadow-2xl p-1.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 overflow-hidden ${menuClassName}`}
        >
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-left transition-colors select-none ${
                    isSelected
                      ? 'bg-accent/15 text-accent font-semibold'
                      : 'text-studio-text hover:bg-studio-card hover:text-studio-text'
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                      <span className="text-xs truncate">{opt.label}</span>
                      {opt.badge && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-studio-card border border-studio-border text-accent">
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    {opt.description && (
                      <span className="text-[10px] text-studio-textMuted truncate mt-0.5 font-normal">
                        {opt.description}
                      </span>
                    )}
                  </div>

                  {isSelected && <Check className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

