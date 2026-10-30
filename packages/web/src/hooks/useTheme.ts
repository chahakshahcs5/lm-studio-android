import { useState, useEffect, useCallback } from 'react';

export interface ThemePreset {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  mode?: 'dark' | 'light';
  description?: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'studio-crimson',
    name: 'Crimson & Cyan',
    primary: '#E63946',
    secondary: '#00D8F6',
    description: 'Classic LM Studio & Android-GPU high-contrast aesthetic',
  },
  {
    id: 'linear-indigo',
    name: 'Electric Indigo',
    primary: '#6366F1',
    secondary: '#A855F7',
    description: 'Modern Raycast & Linear obsidian dark styling',
  },
  {
    id: 'cyber-emerald',
    name: 'Mint Emerald',
    primary: '#10B981',
    secondary: '#06B6D4',
    description: 'Clean hardware monitoring and terminal style',
  },
  {
    id: 'solar-amber',
    name: 'Solar Flare',
    primary: '#F59E0B',
    secondary: '#EF4444',
    description: 'High-energy amber and flame titanium look',
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    primary: '#FF007F',
    secondary: '#00F5FF',
    description: 'Vibrant neon pink and electric cyan',
  },
  {
    id: 'polar-frost',
    name: 'Polar Frost',
    primary: '#0284C7',
    secondary: '#38BDF8',
    description: 'Clean Nordic ice blue and sky tones',
  },
  {
    id: 'velvet-purple',
    name: 'Dracula Velvet',
    primary: '#9333EA',
    secondary: '#EC4899',
    description: 'Deep violet with rich magenta accents',
  },
  {
    id: 'minimal-slate',
    name: 'Titanium Slate',
    primary: '#64748B',
    secondary: '#94A3B8',
    description: 'Subtle monochrome minimal palette',
  },
];

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num) || clean.length !== 6) {
    return { r: 230, g: 57, b: 70 }; // default crimson fallback
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function useTheme() {
  const [mode, setMode] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('studio_mode');
    return (saved === 'dark' || saved === 'light') ? saved : 'dark';
  });

  const [primaryColor, setPrimaryColor] = useState<string>(() => {
    return localStorage.getItem('studio_primary_color') || '#E63946';
  });

  const [secondaryColor, setSecondaryColor] = useState<string>(() => {
    return localStorage.getItem('studio_secondary_color') || '#00D8F6';
  });

  const [activePreset, setActivePreset] = useState<string>(() => {
    return localStorage.getItem('studio_active_preset') || 'studio-crimson';
  });

  // Apply colors to root CSS variables immediately
  const applyColors = useCallback(
    (currentMode: 'dark' | 'light', primary: string, secondary: string) => {
      const root = document.documentElement;

      // Toggle class
      root.classList.remove('dark', 'light');
      root.classList.add(currentMode);

      // Primary color variables
      root.style.setProperty('--primary', primary);
      root.style.setProperty('--primary-muted', hexToRgba(primary, 0.14));
      root.style.setProperty('--primary-glow', hexToRgba(primary, 0.35));

      // Map --accent to primary for backwards-compatibility
      root.style.setProperty('--accent', primary);
      root.style.setProperty('--accent-muted', hexToRgba(primary, 0.14));
      root.style.setProperty('--accent-glow', hexToRgba(primary, 0.35));

      // Secondary color variables
      root.style.setProperty('--secondary', secondary);
      root.style.setProperty('--secondary-muted', hexToRgba(secondary, 0.14));
      root.style.setProperty('--secondary-glow', hexToRgba(secondary, 0.35));

      // Persist in localStorage
      localStorage.setItem('studio_mode', currentMode);
      localStorage.setItem('studio_primary_color', primary);
      localStorage.setItem('studio_secondary_color', secondary);
    },
    []
  );

  useEffect(() => {
    applyColors(mode, primaryColor, secondaryColor);
  }, [mode, primaryColor, secondaryColor, applyColors]);

  const toggleMode = () => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const applyPreset = (preset: ThemePreset) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
    setActivePreset(preset.id);
    localStorage.setItem('studio_active_preset', preset.id);
    if (preset.mode) {
      setMode(preset.mode);
    }
  };

  const updatePrimary = (color: string) => {
    setPrimaryColor(color);
    setActivePreset('custom');
    localStorage.setItem('studio_active_preset', 'custom');
  };

  const updateSecondary = (color: string) => {
    setSecondaryColor(color);
    setActivePreset('custom');
    localStorage.setItem('studio_active_preset', 'custom');
  };

  const resetToDefault = () => {
    applyPreset(THEME_PRESETS[0]);
  };

  return {
    mode,
    primaryColor,
    secondaryColor,
    activePreset,
    toggleMode,
    setMode,
    applyPreset,
    updatePrimary,
    updateSecondary,
    resetToDefault,
  };
}
