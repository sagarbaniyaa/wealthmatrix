import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0E1116',
          900: '#12141A',
          800: '#1A1D24',
          700: '#262A33',
          500: '#4B505C',
          300: '#8A8F9C',
          100: '#D7D9DE',
        },
        brass: {
          600: '#8F6A1E',
          500: '#B98B2E',
          400: '#D2A94F',
          100: '#F1E4C4',
        },
        verdigris: {
          600: '#2F5951',
          500: '#3F7268',
          400: '#5D9389',
        },
        rust: {
          600: '#8C331F',
          500: '#B0402A',
          400: '#C96849',
        },
        paper: '#F5F3ED',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'ui-serif', 'Georgia', 'serif'],
        sans: ['var(--font-plex-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderColor: {
        hairline: 'rgba(185, 139, 46, 0.16)',
      },
    },
  },
  plugins: [],
};
export default config;
