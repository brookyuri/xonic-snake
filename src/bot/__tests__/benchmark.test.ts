import { describe, it, expect } from 'vitest'
import { normalBot } from '../normalBot'
import { randomBot } from '../randomBot'
import { safeBot } from '../safeBot'
import type { Bot } from '../types'
import { playMatch, report } from './tournament'

const SEED = 20260926

const moveTimes: number[] = []

const timedNormal: Bot = (state, player, rng) => {
  const start = performance.now()
  const move = normalBot(state, player, rng)
  moveTimes.push(performance.now() - start)
  return move
}

describe('normalBot benchmark', () => {
  it('meets the win-rate and speed targets', () => {
    const vsRandom = playMatch('normal vs random', timedNormal, randomBot, 500, SEED)
    const vsSafe = playMatch('normal vs safe', timedNormal, safeBot, 500, SEED + 1)
    const vsNormal = playMatch('normal vs normal', timedNormal, timedNormal, 200, SEED + 2)

    const mean = moveTimes.reduce((a, t) => a + t, 0) / moveTimes.length
    const max = Math.max(...moveTimes)
    const sorted = [...moveTimes].sort((a, b) => a - b)
    const p99 = sorted[Math.floor(sorted.length * 0.99)]

    console.log(
      [
        `benchmark seed ${SEED}`,
        '| match | games | win | loss | draw | avg rounds | avg capture | avg winner territory |',
        '|---|---|---|---|---|---|---|---|',
        report(vsRandom),
        report(vsSafe),
        report(vsNormal),
        `normalBot move time: mean ${mean.toFixed(2)}ms, p99 ${p99.toFixed(2)}ms, max ${max.toFixed(2)}ms over ${moveTimes.length} moves`,
      ].join('\n')
    )

    expect(vsRandom.wins / vsRandom.games).toBeGreaterThanOrEqual(0.95)
    expect(vsSafe.wins / vsSafe.games).toBeGreaterThanOrEqual(0.8)
    expect(mean).toBeLessThan(20)
    expect(max).toBeLessThan(100)
  }, 600_000)
})
