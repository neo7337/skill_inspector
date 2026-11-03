/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        // Theme surface tokens bound to CSS variables
        surface: {
          base: 'var(--surface-base)',
          raised: 'var(--surface-raised)',
          overlay: 'var(--surface-overlay)',
          sunken: 'var(--surface-sunken)',
        },
        'surface-base': 'var(--surface-base)',
        'surface-raised': 'var(--surface-raised)',
        'surface-overlay': 'var(--surface-overlay)',
        'surface-sunken': 'var(--surface-sunken)',
        'border-subtle': 'var(--border-subtle)',
        'border-muted': 'var(--border-muted)',

        // Brand Blue — single trusted accent
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb', // primary CTA
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      borderColor: {
        DEFAULT: 'var(--border-subtle)',
        subtle: 'var(--border-subtle)',
        muted: 'var(--border-muted)',
      },
      boxShadow: {
        // Neutral elevation — no chromatic glow
        'xs':   '0 1px 2px 0 rgba(0,0,0,0.05)',
        'card': '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'ring-brand': '0 0 0 3px rgba(37,99,235,0.18)',
        // Semantic status rings (kept for score gauges / status dots)
        'glow-emerald': '0 0 12px rgba(16,185,129,0.25)',
        'glow-amber':   '0 0 12px rgba(245,158,11,0.25)',
        'glow-rose':    '0 0 12px rgba(244,63,94,0.25)',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        fadeIn:    'fadeIn 0.2s ease-out forwards',
        fadeInUp:  'fadeInUp 0.25s ease-out forwards',
        pulseSlow: 'pulseSlow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer:   'shimmer 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
