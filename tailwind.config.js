/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // WhatsApp color palette
        wa: {
          'dark-green': '#075e54',
          'teal': '#128c7e',
          'light-green': '#25d366',
          'chat-bg': '#efeae2',
          'incoming': '#ffffff',
          'outgoing': '#d9fdd3',
          'sidebar': '#ffffff',
          'sidebar-hover': '#f5f6f6',
          'sidebar-active': '#f0f2f5',
          'header': '#f0f2f5',
          'border': '#e9edef',
          'text-primary': '#111b21',
          'text-secondary': '#667781',
          'text-muted': '#8696a0',
        },
        // Dark mode WhatsApp colors
        'wa-dark': {
          'chat-bg': '#0b141a',
          'incoming': '#202c33',
          'outgoing': '#005c4b',
          'sidebar': '#111b21',
          'sidebar-hover': '#202c33',
          'sidebar-active': '#2a3942',
          'header': '#202c33',
          'border': '#2a3942',
          'text-primary': '#e9edef',
          'text-secondary': '#8696a0',
          'text-muted': '#667781',
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
      },
    },
  },
  plugins: [],
  darkMode: 'media',
}
