/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        mobile: '360px',
      },
      colors: {
        primary: {
          100: '#E6FFF3',
          200: '#B6F7DB',
          300: '#82EBC0',
          400: '#54DDA6',
          500: '#00C573',
          600: '#00AA63',
          700: '#008A50',
        },
        accent: {
          400: '#6EE3B0',
          500: '#3ECF8E',
          600: '#2BBE7D',
        },
        warning: {
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        danger: {
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
        },
        neutral: {
          50: '#FAFAFA',
          100: '#EFEFEF',
          200: '#D6D6D6',
          300: '#B4B4B4',
          400: '#989898',
          500: '#898989',
          600: '#4D4D4D',
          700: '#393939',
          800: '#2E2E2E',
          900: '#171717',
          950: '#0F0F0F',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'Circular',
          'Helvetica Neue',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'Source Code Pro',
          'Office Code Pro',
          'ui-monospace',
          'Menlo',
          'monospace',
        ],
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translate(-50%, calc(-50% + 8px))' },
          to: { opacity: '1', transform: 'translate(-50%, -50%)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-up': 'fadeUp 0.3s ease-out',
        'slide-in': 'slideIn 0.25s ease-out',
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
