import { describe, it, expect } from 'vitest'
import { summarizePerf, type TickSample } from '../perf'

const sample = (tick: number, at: number, botMs = 2, commitMs = 3): TickSample => ({
  tick,
  at,
  costMs: 1,
  botMs,
  commitMs,
})

describe('summarizePerf', () => {
  it('is all zeros with no ticks', () => {
    expect(summarizePerf([], 180)).toEqual({ ticks: 0, avgInterval: 0, lateTicksPct: 0, p95Work: 0, maxWork: 0 })
  })

  it('averages intervals and counts ticks later than 1.5 × tickMs', () => {
    // Интервалы: 180, 180, 300 (опоздал), 170.
    const samples = [sample(1, 0), sample(2, 180), sample(3, 360), sample(4, 660), sample(5, 830)]
    const s = summarizePerf(samples, 180)
    expect(s.ticks).toBe(5)
    expect(s.avgInterval).toBe(207.5)
    expect(s.lateTicksPct).toBe(25)
  })

  it('work = bot + tick + render; reports p95 and max', () => {
    const samples = Array.from({ length: 20 }, (_, i) => sample(i + 1, i * 180, i, 10))
    const s = summarizePerf(samples, 180)
    expect(s.maxWork).toBe(29)
    expect(s.p95Work).toBe(29)
  })

  it('exactly 1.5 × tickMs is not late', () => {
    expect(summarizePerf([sample(1, 0), sample(2, 270)], 180).lateTicksPct).toBe(0)
  })
})
