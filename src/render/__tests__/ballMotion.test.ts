import { describe, it, expect } from 'vitest'
import { ballFraction, nextBallMotion, type BallMotion } from '../ballMotion'

const A = { x: 5, y: 5 }
const B = { x: 6, y: 6 }
const C = { x: 7, y: 7 }

describe('ball motion over 2 ticks (Easy)', () => {
  it('the step spreads over two ticks: 0 → 0.5 on the step tick, 0.5 → 1 on the next', () => {
    let m: BallMotion | undefined
    m = nextBallMotion(m, { prev: A, pos: B }, 2, true)
    expect(ballFraction(m, 0, 2, false)).toBe(0)
    expect(ballFraction(m, 1, 2, false)).toBe(0.5)
    // Следующий тик: шарик не ходит (prev = pos) — едет дальше, без остановки.
    m = nextBallMotion(m, { prev: B, pos: B }, 2, true)
    expect(m).toEqual({ from: A, to: B, tick: 1 })
    expect(ballFraction(m, 0, 2, false)).toBe(0.5)
    expect(ballFraction(m, 1, 2, false)).toBe(1)
    // Новый шаг — снова с начала.
    m = nextBallMotion(m, { prev: B, pos: C }, 2, true)
    expect(m).toEqual({ from: B, to: C, tick: 0 })
  })

  it('is continuous across ticks (end of one tick = start of the next)', () => {
    let m = nextBallMotion(undefined, { prev: A, pos: B }, 2, true)
    const endOfFirst = ballFraction(m, 1, 2, false)
    m = nextBallMotion(m, { prev: B, pos: B }, 2, true)
    expect(ballFraction(m, 0, 2, false)).toBe(endOfFirst)
  })

  it('a second idle tick in a row stops the ball in its cell', () => {
    let m = nextBallMotion(undefined, { prev: A, pos: B }, 2, true)
    m = nextBallMotion(m, { prev: B, pos: B }, 2, true)
    m = nextBallMotion(m, { prev: B, pos: B }, 2, true)
    expect(m).toEqual({ from: B, to: B, tick: 0 })
    expect(ballFraction(m, 0.3, 2, false)).toBe(1)
  })

  it('Normal (span 1) is the old per-tick lerp', () => {
    let m = nextBallMotion(undefined, { prev: A, pos: B }, 1, true)
    expect(ballFraction(m, 0.25, 1, false)).toBe(0.25)
    m = nextBallMotion(m, { prev: B, pos: B }, 1, true)
    expect(ballFraction(m, 0.25, 1, false)).toBe(1)
  })

  it('re-rendering the same frame (no new tick) changes nothing', () => {
    const m = nextBallMotion(undefined, { prev: A, pos: B }, 2, true)
    expect(nextBallMotion(m, { prev: A, pos: B }, 2, false)).toBe(m)
    const m2 = nextBallMotion(m, { prev: B, pos: B }, 2, true)
    expect(nextBallMotion(m2, { prev: B, pos: B }, 2, false)).toBe(m2)
  })

  it('a jump without a tick (respawn, new level) puts the ball in its cell at once', () => {
    const m = nextBallMotion(undefined, { prev: A, pos: B }, 2, true)
    const moved = nextBallMotion(m, { prev: C, pos: C }, 2, false)
    expect(moved).toEqual({ from: C, to: C, tick: 0 })
  })

  it('settled (countdown, pause, hit) and reduced motion: the ball is in its cell', () => {
    const m = nextBallMotion(undefined, { prev: A, pos: B }, 2, true)
    expect(ballFraction(m, 0, 2, true)).toBe(1)
  })
})
