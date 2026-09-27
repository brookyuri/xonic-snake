import { describe, it, expect } from 'vitest'
// Цвета берём прямо из src/theme.css — тест следит за токенами, а не за копией значений.
import css from '../../theme.css?raw'

const token = (name: string): string => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!m) throw new Error(`token --${name} not found`)
  return m[1]
}

/** Относительная яркость по WCAG 2.x. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('8-bit theme contrast (WCAG AA ≥ 4.5:1)', () => {
  const bg = token('c-bg')
  const textTokens = ['c-text', 'c-text-2', 'c-hud-blue', 'c-hud-timer', 'c-hud-red', 'c-danger', 'c-btn-fg']

  it.each(textTokens)('--%s on the black background', (name) => {
    expect(contrast(token(name), bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('pressed / selected button: dark text on the light fill', () => {
    expect(contrast(token('c-btn-pressed-fg'), token('c-btn-pressed-bg'))).toBeGreaterThanOrEqual(4.5)
  })

  it('reports the values', () => {
    const rows = [...textTokens.map((n) => [n, token(n), contrast(token(n), bg)] as const)]
    rows.push(['c-btn-pressed-fg on pressed-bg', token('c-btn-pressed-fg'), contrast(token('c-btn-pressed-fg'), token('c-btn-pressed-bg'))])
    console.log(rows.map(([n, hex, c]) => `${n} ${hex}: ${c.toFixed(2)}:1`).join('\n'))
  })
})
