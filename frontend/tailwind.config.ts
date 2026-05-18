import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        surface: {
          page: '#f8fafc',
          sidebar: '#f1f5f9',
          card: '#ffffff',
        },
        primary: {
          DEFAULT: '#4f46e5',
          hover: '#4338ca',
          foreground: '#ffffff',
        },
        border: {
          DEFAULT: '#e2e8f0',
          strong: '#cbd5e1',
        },
        text: {
          primary: '#0f172a',
          secondary: '#475569',
          disabled: '#94a3b8',
          inverse: '#ffffff',
        },
        nav: {
          active: '#4f46e5',
          activeBg: '#eef2ff',
          hover: '#f1f5f9',
        },
        label: {
          rose:    { bg: '#ffe4e6', text: '#be123c' },
          amber:   { bg: '#fef3c7', text: '#b45309' },
          emerald: { bg: '#d1fae5', text: '#047857' },
          sky:     { bg: '#e0f2fe', text: '#0369a1' },
          violet:  { bg: '#ede9fe', text: '#6d28d9' },
          orange:  { bg: '#ffedd5', text: '#c2410c' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
