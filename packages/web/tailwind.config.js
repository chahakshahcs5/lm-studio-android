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
          bg: '#08090C',
          surface: '#0E1015',
          card: '#14171F',
          cardHover: '#1B1F2A',
          border: 'rgba(255, 255, 255, 0.08)',
          borderSubtle: 'rgba(255, 255, 255, 0.04)',
          borderFocus: '#00F5A0',
        },
        emerald: {
          accent: '#00F5A0',
          glow: 'rgba(0, 245, 160, 0.35)',
          muted: 'rgba(0, 245, 160, 0.12)',
        },
        amber: {
          accent: '#FF9F1C',
          glow: 'rgba(255, 159, 28, 0.35)',
          muted: 'rgba(255, 159, 28, 0.12)',
        },
        crimson: {
          accent: '#FF4A5A',
          glow: 'rgba(255, 74, 90, 0.35)',
          muted: 'rgba(255, 74, 90, 0.12)',
        },
        cyan: {
          accent: '#00D8F6',
          glow: 'rgba(0, 216, 246, 0.35)',
          muted: 'rgba(0, 216, 246, 0.12)',
        }
      },
      boxShadow: {
        'glow-emerald': '0 0 20px -3px rgba(0, 245, 160, 0.25)',
        'glow-amber': '0 0 20px -3px rgba(255, 159, 28, 0.25)',
        'glow-crimson': '0 0 20px -3px rgba(255, 74, 90, 0.25)',
        'studio-subtle': '0 4px 20px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
