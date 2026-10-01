import { describe, it, expect } from 'vitest'
import { ballsForLevel, ballsStepOn, SOLO_DIFFICULTY } from '../config'
import { assertSoloInvariants } from '../invariants'
import { continueSolo, resolveSoloTick } from '../resolve'
import { createSoloState } from '../state'
import type { SoloEvent, SoloState } from '../types'
import { frameGrid, put, soloFromGrid } from './soloHelpers'

const ofType = <T extends SoloEvent['type']>(events: SoloEvent[], type: T) =>
  events.filter((e): e is Extract<SoloEvent, { type: T }> => e.type === type)

/** Тик + инварианты (S5 — с учётом сложности). */
function tick(state: SoloState, move: Parameters<typeof resolveSoloTick>[1]) {
  const result = resolveSoloTick(state, move)
  assertSoloInvariants(result.state, state)
  return result
}

describe('SOLO_DIFFICULTY config (section 13)', () => {
  it('Easy: N balls, a step every 2nd tick; Normal: N + 1 balls, every tick', () => {
    expect(SOLO_DIFFICULTY.easy).toEqual({ extraBalls: 0, ballStepEvery: 2 })
    expect(SOLO_DIFFICULTY.normal).toEqual({ extraBalls: 1, ballStepEvery: 1 })
    expect([1, 2, 5].map((n) => ballsForLevel(n, 'easy'))).toEqual([1, 2, 5])
    expect([1, 2, 5].map((n) => ballsForLevel(n, 'normal'))).toEqual([2, 3, 6])
    expect([0, 1, 2, 3, 4].map((r) => ballsStepOn(r, 'easy'))).toEqual([true, false, true, false, true])
    expect([0, 1, 2, 3].map((r) => ballsStepOn(r, 'normal'))).toEqual([true, true, true, true])
  })

  it('createSoloState defaults to Normal (v0.2 behaviour)', () => {
    const s = createSoloState({ seed: 42 })
    expect(s.difficulty).toBe('normal')
    expect(s.balls).toHaveLength(2)
  })
})

describe('ST15 — Easy, level 1', () => {
  it('one ball on level 1', () => {
    for (const seed of [1, 7, 42, 2026]) {
      const s = createSoloState({ seed, difficulty: 'easy' })
      assertSoloInvariants(s)
      expect(s.difficulty).toBe('easy')
      expect(s.balls).toHaveLength(1)
    }
  })

  it('balls move only on even rounds (0, 2, 4…)', () => {
    // Змейка ездит по нижней рамке (своя земля) — следа нет, ничего не мешает шарику.
    let s: SoloState = { ...createSoloState({ seed: 7, difficulty: 'easy' }), player: { id: 'P1', head: { x: 2, y: 19 }, direction: 'RIGHT', trail: [], alive: true } }
    for (let round = 0; round < 6; round++) {
      expect(s.round).toBe(round)
      const before = s.balls[0].pos
      const r = tick(s, 'RIGHT')
      const moved = ofType(r.events, 'BALLS_MOVED')
      if (round % 2 === 0) {
        expect(moved).toHaveLength(1)
        expect(r.state.balls[0].pos).not.toEqual(before)
      } else {
        expect(moved).toHaveLength(0)
        expect(r.state.balls[0].pos).toEqual(before)
      }
      s = r.state
    }
  })

  it('on an odd round the ball stands still, but a hit on the trail is still checked', () => {
    // Голова (9,17) идёт вверх, над ней шарик (9,16); след (9,18). round = 1 — шарик не ходит.
    const grid = put(frameGrid(), 9, 16, ['o', '1', 't'])
    const s: SoloState = { ...soloFromGrid(grid, { vel: [[1, -1]], direction: 'UP' }), round: 1, difficulty: 'easy' }
    const r = tick(s, 'UP')
    expect(ofType(r.events, 'BALLS_MOVED')).toHaveLength(0)
    const lost = ofType(r.events, 'LIFE_LOST')
    expect(lost).toHaveLength(1)
    expect(lost[0]).toMatchObject({ reason: 'BALL_HIT', at: { x: 9, y: 16 } })
    expect(r.state.balls[0].pos).toEqual({ x: 9, y: 16 })
  })

  it('a ball standing next to the trail on an odd round does not hit it', () => {
    // Шарик (11,16) по диагонали от будущего следа; на нечётном тике он не двигается.
    const grid = put(frameGrid(), 9, 16, ['  o', '1  ', 't  '])
    const s: SoloState = { ...soloFromGrid(grid, { vel: [[-1, 1]], direction: 'UP' }), round: 1, difficulty: 'easy' }
    const r = tick(s, 'UP')
    expect(ofType(r.events, 'LIFE_LOST')).toHaveLength(0)
    expect(r.state.balls[0].pos).toEqual({ x: 11, y: 16 })
    // На следующем (чётном) тике тот же шарик ходит.
    const r2 = tick(r.state, 'UP')
    expect(ofType(r2.events, 'BALLS_MOVED')).toHaveLength(1)
  })
})

describe('ST16 — balls on level 2', () => {
  it('Easy: 2 balls, Normal: 3 balls', () => {
    expect(createSoloState({ seed: 3, difficulty: 'easy', level: 2 }).balls).toHaveLength(2)
    expect(createSoloState({ seed: 3, difficulty: 'normal', level: 2 }).balls).toHaveLength(3)
  })

  it('the next level keeps the difficulty (continueSolo)', () => {
    for (const difficulty of ['easy', 'normal'] as const) {
      const s: SoloState = { ...createSoloState({ seed: 5, difficulty }), status: 'LEVEL_COMPLETE' }
      const next = continueSolo(s)
      assertSoloInvariants(next)
      expect(next.difficulty).toBe(difficulty)
      expect(next.level).toBe(2)
      expect(next.balls).toHaveLength(difficulty === 'easy' ? 2 : 3)
    }
  })

  it('S5 fails when the ball count does not match the difficulty', () => {
    const easy = createSoloState({ seed: 3, difficulty: 'easy', level: 2 })
    expect(() => assertSoloInvariants({ ...easy, difficulty: 'normal' })).toThrow(/S5/)
  })
})
