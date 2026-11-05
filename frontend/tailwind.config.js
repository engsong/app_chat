/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        wa: {
          teal: '#00a884',
          'teal-dark': '#008069',
          'teal-light': '#025144',
          green: '#25D366',
          'green-light': '#d9fdd3',
          'green-bubble': '#005c4b',
          'bg-light': '#f0f2f5',
          'panel-light': '#ffffff',
          'input-light': '#f0f2f5',
          'border-light': '#e9edef',
          'text-primary': '#111b21',
          'text-secondary': '#667781',
          // WhatsApp Web Dark Theme
          'bg-dark': '#111b21',
          'panel-dark': '#202c33',
          'panel-header-dark': '#202c33',
          'input-dark': '#2a3942',
          'border-dark': '#222d34',
          'text-dark-primary': '#e9edef',
          'text-dark-secondary': '#8696a0',
          'hover-dark': '#202c33',
        }
      }
    },
  },
  plugins: [],
}
