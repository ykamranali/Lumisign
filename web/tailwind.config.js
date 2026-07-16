/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          blue: '#00d4ff',
          cyan: '#22f5ff',
          purple: '#a855f7',
          pink: '#ec4899',
        },
        dark: {
          900: '#05060f',
          800: '#0a0c1b',
          700: '#0f1326',
          600: '#161b33',
          500: '#1e2547',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(0, 212, 255, 0.35)',
        'glow-purple': '0 0 24px rgba(168, 85, 247, 0.4)',
        card: '0 8px 32px rgba(0, 0, 0, 0.45)',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(rgba(0,212,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.05) 1px, transparent 1px)',
      },
      keyframes: {
        float: { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
        'pulse-glow': { '0%, 100%': { opacity: '0.6' }, '50%': { opacity: '1' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'border-rotate': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
        shimmer: 'shimmer 2s infinite',
        'border-rotate': 'border-rotate 6s linear infinite',
      },
    },
  },
  plugins: [],
};

module.exports = config;
