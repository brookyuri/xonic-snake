import { describe, it, expect } from 'vitest'
import { LateTickMonitor } from '../lateTicks'

const TICK = 180

/** n тиков с интервалом dt, начиная с at; возвращает момент последнего. */
function run(m: LateTickMonitor, n: number, at: number, dt: number): number {
  for (let i = 0; i < n; i++) m.tick(at + i * dt)
  return at + (n - 1) * dt
}

describe('LateTickMonitor', () => {
  it('on time: never offers 1986', () => {
    const m = new LateTickMonitor(TICK)
    run(m, 200, 0, TICK)
    expect(m.intervals).toBe(199)
    expect(m.late).toBe(0)
    expect(m.shouldOffer()).toBe(false)
  })

  it('waits for 30 intervals even if every tick is late', () => {
    const m = new LateTickMonitor(TICK)
    run(m, 30, 0, 300) // 29 интервалов
    expect(m.shouldOffer()).toBe(false)
    m.tick(30 * 300)
    expect(m.intervals).toBe(30)
    expect(m.shouldOffer()).toBe(true)
  })

  it('more than 10% late → offers exactly once', () => {
    const m = new LateTickMonitor(TICK)
    let t = run(m, 28, 0, TICK) // 27 вовремя
    for (let i = 0; i < 4; i++) m.tick((t += 300)) // 4 опоздавших: 4/31 ≈ 13%
    expect(m.late).toBe(4)
    expect(m.shouldOffer()).toBe(true)
    expect(m.shouldOffer()).toBe(false)
  })

  it('exactly 10% is not enough', () => {
    const m = new LateTickMonitor(TICK)
    let t = run(m, 28, 0, TICK) // 27 интервалов вовремя
    for (let i = 0; i < 3; i++) m.tick((t += 271)) // 3 из 30 = 10%
    expect(m.intervals).toBe(30)
    expect(m.late).toBe(3)
    expect(m.shouldOffer()).toBe(false)
  })

  it('a break (countdown, pause, lost life) is not a late tick', () => {
    const m = new LateTickMonitor(TICK)
    const t = run(m, 20, 0, TICK)
    m.pause()
    expect(m.tick(t + 4000)).toBe(false) // первый тик после отсчёта — без интервала
    run(m, 20, t + 4000 + TICK, TICK)
    expect(m.late).toBe(0)
    expect(m.intervals).toBe(19 + 20)
  })
})
