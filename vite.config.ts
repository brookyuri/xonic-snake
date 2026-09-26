/// <reference types="vitest/config" />
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// `npm run bench` запускает vitest с --mode bench; в обычном `npm test` бенчмарк исключён.
export default defineConfig(({ mode }) => ({
  // Относительные пути в сборке: dist работает из любого подкаталога (GitHub Pages, itch.io и т.п.).
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: mode === 'bench' ? configDefaults.exclude : [...configDefaults.exclude, '**/benchmark.test.ts'],
  },
}))
