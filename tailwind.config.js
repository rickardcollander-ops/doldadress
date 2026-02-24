/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'success-purple': '#7C5CFF',
        'ai-blue': '#4DA3FF',
        'growth-green': '#2FE0A7',
        'risk-red': '#FF5A5A',
        'warning-amber': '#FFB020',
      },
    },
  },
  plugins: [],
}
