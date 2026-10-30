/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        studio: {
          bg: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          card: 'var(--bg-card)',
          cardHover: 'var(--bg-card-hover)',
          border: 'var(--border)',
          borderSubtle: 'var(--border-subtle)',
          text: 'var(--text-main)',
          textMuted: 'var(--text-muted)',
          textDim: 'var(--text-dim)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          muted: 'var(--primary-muted)',
          glow: 'var(--primary-glow)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          muted: 'var(--secondary-muted)',
          glow: 'var(--secondary-glow)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
          glow: 'var(--accent-glow)',
        },
        crimson: {
          accent: '#E63946',
          muted: 'rgba(230, 57, 70, 0.12)',
        },
        amber: {
          accent: '#F59E0B',
          muted: 'rgba(245, 158, 11, 0.12)',
        },
      },
      boxShadow: {
        'primary-glow': '0 0 20px -2px var(--primary-glow)',
        'secondary-glow': '0 0 20px -2px var(--secondary-glow)',
        'accent-glow': '0 0 20px -2px var(--accent-glow)',
        'studio-subtle': 'var(--shadow-subtle)',
      },
    },
  },
  plugins: [],
}
