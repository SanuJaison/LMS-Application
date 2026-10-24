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
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
