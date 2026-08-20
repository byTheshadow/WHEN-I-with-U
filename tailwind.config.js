/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          bg: 'var(--color-theme-bg, #090d16)',
          card: 'var(--color-theme-card, rgba(30, 41, 59, 0.7))',
          accent: 'var(--color-theme-accent, #ec4899)',
          text: 'var(--color-theme-text, #f8fafc)',
        }
      }
    },
  },
  plugins: [],
}