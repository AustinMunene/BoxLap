/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'f1-red': '#E8002D',
        'f1-dark': '#080808',
        'f1-card': '#0f0f0f',
        'f1-border': 'rgba(255,255,255,0.08)',
        'f1-muted': '#888',
      },
      fontFamily: {
        'f1': ['Titillium Web', 'sans-serif'],
        'mono': ['DM Mono', 'monospace'],
      },
      backdropBlur: {
        'glass': '12px',
      }
    },
  },
  plugins: [],
}
