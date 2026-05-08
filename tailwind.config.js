/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
  important: '#app',
};
