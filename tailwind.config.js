/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#eef4ff',
          100: '#dae6ff',
          200: '#bcd2ff',
          300: '#8eb4ff',
          400: '#5a8bff',
          500: '#3866ff',
          600: '#2548f0',
          700: '#1d36cf',
          800: '#1d31a8',
          900: '#1d2f85',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        'card-dark': '0 1px 2px 0 rgb(0 0 0 / 0.4), 0 1px 3px 0 rgb(0 0 0 / 0.3)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'scale-in': 'scale-in 0.18s ease-out',
        'slide-in-right': 'slide-in-right 0.22s ease-out',
      },
    },
  },
  plugins: [],
};
