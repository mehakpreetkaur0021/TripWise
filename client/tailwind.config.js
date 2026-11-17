/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1a6b4a',
        accent: '#e8a838',
      },
    },
  },
  plugins: [],
};
