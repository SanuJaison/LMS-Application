import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f3fafb',
          100: '#e7f6f7',
          200: '#c2e8eb',
          300: '#9ddae0',
          400: '#54bec7',
          500: '#0aa2af',
          600: '#09929e',
          700: '#087a83',
          800: '#066169',
          900: '#054f56',
          950: '#033135',
        },
        // Semantic, theme-aware palette. Values live in globals.css so the
        // same class works in both light and dark mode.
        app: 'rgb(var(--c-app) / <alpha-value>)',
        panel: 'rgb(var(--c-panel) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--c-surface-2) / <alpha-value>)',
        field: 'rgb(var(--c-field) / <alpha-value>)',
        elevated: 'rgb(var(--c-elevated) / <alpha-value>)',
        nav: 'rgb(var(--c-nav) / <alpha-value>)',
        side: 'rgb(var(--c-side) / <alpha-value>)',
        hover: 'rgb(var(--c-hover) / <alpha-value>)',
        selected: 'rgb(var(--c-selected) / <alpha-value>)',
        bulk: 'rgb(var(--c-bulk) / <alpha-value>)',
        active: 'rgb(var(--c-active) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        'line-2': 'rgb(var(--c-line-2) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        subtle: 'rgb(var(--c-subtle) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--c-accent-hover) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
