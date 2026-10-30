import React from 'react';
import {
  Palette,
  Sun,
  Moon,
  RotateCcw,
  Sparkles,
  Check,
  X,
  Sliders,
  Layers,
  Zap,
  Bot,
} from 'lucide-react';
import { THEME_PRESETS, ThemePreset } from '../hooks/useTheme';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'dark' | 'light';
  primaryColor: string;
  secondaryColor: string;
  activePreset: string;
  onToggleMode: () => void;
  onSetMode: (mode: 'dark' | 'light') => void;
  onApplyPreset: (preset: ThemePreset) => void;
  onUpdatePrimary: (color: string) => void;
  onUpdateSecondary: (color: string) => void;
  onResetToDefault: () => void;
}

const QUICK_COLORS = [
  '#E63946', // Crimson Red
  '#FF4D5A', // Coral
  '#F59E0B', // Amber
  '#10B981', // Mint Emerald
  '#06B6D4', // Cyan
  '#0284C7', // Sky Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#64748B', // Slate
];

export const ThemeModal: React.FC<ThemeModalProps> = ({
  isOpen,
  onClose,
  mode,
  primaryColor,
  secondaryColor,
  activePreset,
  onToggleMode,
  onSetMode,
  onApplyPreset,
  onUpdatePrimary,
  onUpdateSecondary,
  onResetToDefault,
}) => {
  if (!isOpen) return null;

  const handleRandomize = () => {
    const randomPrimary = QUICK_COLORS[Math.floor(Math.random() * QUICK_COLORS.length)];
    let randomSecondary = QUICK_COLORS[Math.floor(Math.random() * QUICK_COLORS.length)];
    if (randomSecondary === randomPrimary) {
      randomSecondary = '#00D8F6';
    }
    onUpdatePrimary(randomPrimary);
    onUpdateSecondary(randomSecondary);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-studio-surface border border-studio-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-studio-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center shadow-accent-glow">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-mono text-base font-bold text-studio-text">
                Theme Studio & Color Palette
              </h3>
              <p className="text-xs text-studio-textMuted">
                Live reactive theming. Changes apply instantly across the entire studio.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-studio-textMuted hover:text-studio-text p-1.5 rounded-lg hover:bg-studio-card transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle: Dark vs Light */}
        <div>
          <label className="font-mono text-xs font-bold uppercase tracking-wider text-studio-text mb-2.5 block">
            Interface Appearance Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onSetMode('dark')}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2.5 text-xs font-semibold transition-all ${
                mode === 'dark'
                  ? 'bg-studio-card border-accent text-accent shadow-accent-glow'
                  : 'bg-studio-surface border-studio-border text-studio-textMuted hover:text-studio-text'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Matte Dark Obsidian</span>
              {mode === 'dark' && <Check className="w-3.5 h-3.5 ml-1" />}
            </button>

            <button
              onClick={() => onSetMode('light')}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2.5 text-xs font-semibold transition-all ${
                mode === 'light'
                  ? 'bg-studio-card border-accent text-accent shadow-accent-glow'
                  : 'bg-studio-surface border-studio-border text-studio-textMuted hover:text-studio-text'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-500" />
              <span>Clean Light Titanium</span>
              {mode === 'light' && <Check className="w-3.5 h-3.5 ml-1" />}
            </button>
          </div>
        </div>

        {/* Live Preview Card */}
        <div>
          <label className="font-mono text-xs font-bold uppercase tracking-wider text-studio-text mb-2 block">
            Live Preview
          </label>
          <div className="p-4 rounded-xl bg-studio-card border border-studio-border shadow-studio-subtle flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <span className="font-mono text-xs font-bold text-studio-text">
                  Assistant Response Preview
                </span>
              </div>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                style={{
                  backgroundColor: `${secondaryColor}22`,
                  color: secondaryColor,
                  border: `1px solid ${secondaryColor}44`,
                }}
              >
                ⚡ 28.4 tokens/s
              </span>
            </div>

            <div
              className="p-3 rounded-lg text-xs leading-relaxed"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderLeft: `3px solid ${primaryColor}`,
                color: 'var(--text-main)',
              }}
            >
              Local inference running on smartphone ARM cores. Color theme adjusts in real time!
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                className="px-3 py-1 rounded-lg text-xs font-semibold text-white transition-transform active:scale-95"
                style={{ backgroundColor: primaryColor }}
              >
                Primary Button
              </button>
              <span
                className="text-xs font-mono font-semibold"
                style={{ color: secondaryColor }}
              >
                Secondary Accent State
              </span>
            </div>
          </div>
        </div>

        {/* Curated Preset Themes */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="font-mono text-xs font-bold uppercase tracking-wider text-studio-text">
              Curated Theme Presets
            </label>
            <span className="text-[11px] text-studio-textMuted">Click to apply instantly</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {THEME_PRESETS.map((p) => {
              const isSelected = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onApplyPreset(p)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-2 ${
                    isSelected
                      ? 'bg-studio-card border-accent shadow-accent-glow'
                      : 'bg-studio-surface border-studio-border hover:border-accent/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-4 h-4 rounded-full border border-black/20"
                        style={{ backgroundColor: p.primary }}
                        title="Primary"
                      />
                      <div
                        className="w-4 h-4 rounded-full border border-black/20"
                        style={{ backgroundColor: p.secondary }}
                        title="Secondary"
                      />
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                  </div>
                  <div>
                    <span className="font-mono text-xs font-bold text-studio-text block truncate">
                      {p.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Color Pickers */}
        <div>
          <label className="font-mono text-xs font-bold uppercase tracking-wider text-studio-text mb-2.5 block">
            Custom Color Tuner (Primary & Secondary)
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Primary Color Picker */}
            <div className="p-3.5 rounded-xl bg-studio-card border border-studio-border flex flex-col gap-2.5 shadow-studio-subtle">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-studio-text">Primary Accent</span>
                <span className="font-mono font-bold text-accent">{primaryColor}</span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => onUpdatePrimary(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => onUpdatePrimary(e.target.value)}
                  className="flex-1 bg-studio-surface border border-studio-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-studio-text focus:outline-none focus:border-accent uppercase"
                />
              </div>

              {/* Quick Swatches */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {QUICK_COLORS.slice(0, 7).map((color) => (
                  <button
                    key={color}
                    onClick={() => onUpdatePrimary(color)}
                    className="w-5 h-5 rounded-md transition-transform hover:scale-110 border border-black/20"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Secondary Color Picker */}
            <div className="p-3.5 rounded-xl bg-studio-card border border-studio-border flex flex-col gap-2.5 shadow-studio-subtle">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-studio-text">Secondary Accent</span>
                <span className="font-mono font-bold" style={{ color: secondaryColor }}>
                  {secondaryColor}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => onUpdateSecondary(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => onUpdateSecondary(e.target.value)}
                  className="flex-1 bg-studio-surface border border-studio-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-studio-text focus:outline-none focus:border-accent uppercase"
                />
              </div>

              {/* Quick Swatches */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {QUICK_COLORS.slice(3, 10).map((color) => (
                  <button
                    key={color}
                    onClick={() => onUpdateSecondary(color)}
                    className="w-5 h-5 rounded-md transition-transform hover:scale-110 border border-black/20"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-studio-border">
          <div className="flex items-center gap-2">
            <button
              onClick={handleRandomize}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-studio-textMuted hover:text-studio-text bg-studio-card border border-studio-border hover:border-accent transition-all"
              title="Generate a random color combination"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Shuffle</span>
            </button>

            <button
              onClick={onResetToDefault}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-studio-textMuted hover:text-studio-text bg-studio-card border border-studio-border hover:border-accent transition-all"
              title="Reset to default Studio Crimson & Cyan"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:opacity-90 transition-all shadow-accent-glow"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
