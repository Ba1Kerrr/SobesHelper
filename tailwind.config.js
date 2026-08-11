/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    // Custom theme so daisyUI-based pages (Settings/Jobs/Kanban/panels) share
    // one palette with OverlayPage's chat/nav chrome (src/pages/OverlayPage.tsx
    // COLORS/MODE_COLORS) instead of the stock "night" theme clashing with it.
    themes: [
      {
        assistant: {
          'primary': '#7A5CFF',
          'primary-content': '#14151B',
          'secondary': '#31E6E0',
          'secondary-content': '#14151B',
          'accent': '#FFB84D',
          'accent-content': '#14151B',
          'neutral': '#2C2F3A',
          'neutral-content': '#F0F1F5',
          'base-100': '#151518',
          'base-200': '#1B1B22',
          'base-300': '#242430',
          'base-content': '#F0F1F5',
          'info': '#31E6E0',
          'success': '#5CFF8F',
          'warning': '#FFB84D',
          'error': '#FF5C7A',
          '--rounded-box': '0.75rem',
          '--rounded-btn': '0.5rem',
          '--rounded-badge': '1.9rem',
        },
      },
    ],
  },
}

