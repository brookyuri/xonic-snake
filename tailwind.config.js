/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Значения — только в src/theme.css; здесь лишь семантические имена.
      colors: {
        ts: {
          bg: 'var(--c-bg)',
          text: 'var(--c-text)',
          text2: 'var(--c-text-2)',
          blue: 'var(--c-hud-blue)',
          timer: 'var(--c-hud-timer)',
          red: 'var(--c-hud-red)',
          frame: 'var(--c-frame)',
          land: 'var(--c-p1-land)',
          ball: 'var(--c-ball)',
          border: 'var(--c-btn-border)',
          danger: 'var(--c-danger)',
          scrim: 'var(--c-scrim)',
        },
      },
      fontFamily: {
        pixel: 'var(--font-pixel)',
        mono: 'var(--font-mono)',
      },
    },
  },
  plugins: [],
}
