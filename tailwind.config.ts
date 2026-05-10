import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        'corzen-purple': '#8D3DF3',
        'corzen-green': '#3FE38A',
        'corzen-purple-light': '#F3EEFF',
        'corzen-purple-dark': '#6B25D4',
        'corzen-blue': '#1B56D6',
        'corzen-blue-dark': '#1645B0',
        'corzen-navy': '#1E293B',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'pulse-dot': { '0%, 80%, 100%': { opacity: '0.2' }, '40%': { opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'pulse-dot': 'pulse-dot 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
