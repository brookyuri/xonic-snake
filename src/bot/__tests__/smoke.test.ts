import { describe, it, expect } from 'vitest'
import { normalBot } from '../normalBot'
import { randomBot } from '../randomBot'
import { easyBot } from '../easyBot'
import { playMatch } from './tournament'

// Быстрая проверка в `npm test`; полный турнир — `npm run bench`.
describe('smoke benchmark', () => {
  it('normalBot beats randomBot in ≥ 90% of 30 games', () => {
    const start = performance.now()
    const stats = playMatch('smoke normal vs random', normalBot, randomBot, 30, 20260930)
    expect(stats.wins / stats.games).toBeGreaterThanOrEqual(0.9)
    expect(performance.now() - start).toBeLessThan(3000)
  })

  it('easyBot beats randomBot in ≥ 70% of 20 games', () => {
    const start = performance.now()
    const stats = playMatch('smoke easy vs random', easyBot, randomBot, 20, 20260931)
    expect(stats.wins / stats.games).toBeGreaterThanOrEqual(0.7)
    expect(performance.now() - start).toBeLessThan(3000)
  })
})
