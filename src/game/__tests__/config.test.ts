import { describe, it, expect } from 'vitest'
import { formatClock, maxRoundsFor, SPEEDS, timeLeftMs } from '../config'
import { createInitialState } from '../../engine/state'

describe('speed and match length (5.3)', () => {
  it('maxRounds = ceil(120000 / tickMs)', () => {
    expect(maxRoundsFor(SPEEDS.slow)).toBe(300)
    expect(maxRoundsFor(SPEEDS.normal)).toBe(429)
    expect(maxRoundsFor(SPEEDS.fast)).toBe(667)
  })

  it('a full match lasts at least two minutes of ticks', () => {
    for (const tick of Object.values(SPEEDS)) expect(maxRoundsFor(tick) * tick).toBeGreaterThanOrEqual(120_000)
  })

  it('time left = (maxRounds − round) × tickMs', () => {
    const state = createInitialState({ maxRounds: 300 })
    expect(timeLeftMs(state, 400)).toBe(120_000)
    state.round = 290
    expect(timeLeftMs(state, 400)).toBe(4_000)
  })

  it('never shows more than the match length (Normal: 429 × 280 = 120 120 ms)', () => {
    const state = createInitialState({ maxRounds: maxRoundsFor(SPEEDS.normal) })
    expect(formatClock(timeLeftMs(state, SPEEDS.normal))).toBe('2:00')
    state.round = 1
    expect(timeLeftMs(state, SPEEDS.normal)).toBe(428 * 280)
  })

  it('formats m:ss with seconds rounded up', () => {
    expect(formatClock(120_000)).toBe('2:00')
    expect(formatClock(107_000)).toBe('1:47')
    expect(formatClock(9_001)).toBe('0:10')
    expect(formatClock(400)).toBe('0:01')
    expect(formatClock(0)).toBe('0:00')
  })
})
