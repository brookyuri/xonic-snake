import { describe, it, expect } from 'vitest'
import { assertSoloInvariants, type SoloState } from '../../engine/solo'
import { frameGrid, put, soloFromGrid } from '../../engine/solo/__tests__/soloHelpers'
import { LEVEL_CLEAR_MS, LIFE_LOST_MS, SoloMatchController } from '../soloMatch'

const TICK = 180

function fakeClock(start = 1000) {
  let t = start
  return { now: () => t, set: (v: number) => void (t = v), add: (dt: number) => void (t += dt) }
}

// Голова (9,16) идёт UP, прямо перед ней шарик (9,15): первый же тик — BALL_HIT.
function aboutToBeHit(lives = 3): SoloState {
  return soloFromGrid(put(put(put(frameGrid(), 9, 16, ['1', 't', 't']), 9, 15, ['o']), 15, 3, ['o']), {
    vel: [
      [1, 1],
      [1, 1],
    ],
    lives,
  })
}

// Верх поля уже земля, один ход UP замыкает контур до 77.7% (как ST10).
function aboutToClear(): SoloState {
  let g = frameGrid()
  for (let y = 1; y <= 9; y++) g = put(g, 1, y, ['#'.repeat(18)])
  g = put(put(put(g, 9, 10, ['1', ...Array(8).fill('t')]), 3, 14, ['o']), 5, 12, ['o'])
  return soloFromGrid(g, {
    vel: [
      [1, 1],
      [1, 1],
    ],
  })
}

function setup(initial?: SoloState) {
  const clock = fakeClock()
  const match = new SoloMatchController({ tickMs: TICK, seed: 5, now: clock.now, initial })
  const finishCountdown = () => {
    clock.add(3000)
    match.frame()
    expect(match.snapshot.phase).toBe('RUNNING')
    return clock.now()
  }
  /** Первый тик после отсчёта; возвращает его время. */
  const firstTick = () => {
    const end = finishCountdown()
    clock.set(end + TICK)
    match.frame()
    return end + TICK
  }
  return { clock, match, finishCountdown, firstTick }
}

describe('SoloMatchController', () => {
  it('starts level 1 with the 3-2-1 countdown, then ticks', () => {
    const { match, firstTick } = setup()
    expect(match.snapshot.phase).toBe('COUNTDOWN')
    expect(match.snapshot.state.level).toBe(1)
    firstTick()
    expect(match.snapshot.ticks).toBe(1)
    expect(match.snapshot.state.player.head).toEqual({ x: 10, y: 19 })
  })

  it('LIFE_LOST: flash, then countdown, then play resumes from the respawn point (2.1)', () => {
    const { clock, match, firstTick } = setup(aboutToBeHit())
    const hitAt = firstTick()
    expect(match.snapshot.phase).toBe('LIFE_LOST')
    expect(match.snapshot.events.find((e) => e.type === 'LIFE_LOST')).toMatchObject({
      at: { x: 9, y: 15 },
      livesLeft: 2,
    })

    // Во время вспышки тиков нет, нажатия игнорируются.
    clock.set(hitAt + LIFE_LOST_MS - 1)
    match.frame()
    match.steer('UP')
    expect(match.snapshot.phase).toBe('LIFE_LOST')
    expect(match.snapshot.ticks).toBe(1)
    expect(match.snapshot.queue).toEqual([])
    // Вспышку тапом не пропустить.
    match.skipHold()
    expect(match.snapshot.phase).toBe('LIFE_LOST')

    clock.set(hitAt + LIFE_LOST_MS)
    match.frame()
    expect(match.snapshot.phase).toBe('COUNTDOWN')
    expect(match.snapshot.countdown).toBe(3)
    expect(match.snapshot.state.status).toBe('PLAYING')
    // Шарики (15,3) и (9,15): дальше всего от них середина левой стороны.
    expect(match.snapshot.state.player.head).toEqual({ x: 0, y: 9 })
    expect(match.snapshot.state.player.direction).toBe('DOWN')

    clock.add(3000)
    match.frame()
    expect(match.snapshot.phase).toBe('RUNNING')
    clock.add(TICK)
    match.frame()
    expect(match.snapshot.ticks).toBe(2)
    expect(match.snapshot.state.player.head).toEqual({ x: 0, y: 10 })
    assertSoloInvariants(match.snapshot.state)
  })

  it('pause during the LIFE_LOST flash: nothing moves, RESUME goes through 3-2-1 once', () => {
    const { clock, match, firstTick } = setup(aboutToBeHit())
    const hitAt = firstTick()
    clock.set(hitAt + 300)
    match.frame()
    match.pause()
    expect(match.snapshot.phase).toBe('PAUSED')

    // Долгая пауза: вспышка «истекла», но пока на паузе — ни отсчёта, ни тиков.
    for (let i = 0; i < 20; i++) {
      clock.add(500)
      match.frame()
    }
    expect(match.snapshot.phase).toBe('PAUSED')
    expect(match.snapshot.ticks).toBe(1)
    expect(match.snapshot.state.status).toBe('LIFE_LOST')

    match.resume()
    expect(match.snapshot.phase).toBe('COUNTDOWN')
    expect(match.snapshot.state.status).toBe('PLAYING')
    expect(match.snapshot.state.lives).toBe(2)
    clock.add(3000)
    match.frame()
    clock.add(TICK)
    match.frame()
    expect(match.snapshot.ticks).toBe(2)
    expect(match.snapshot.state.lives).toBe(2)
  })

  it('LEVEL_COMPLETE: "LEVEL CLEAR" for 1.5 s, then countdown into level 2', () => {
    const { clock, match, firstTick } = setup(aboutToClear())
    const clearAt = firstTick()
    expect(match.snapshot.phase).toBe('LEVEL_CLEAR')
    expect(match.snapshot.state.level).toBe(1)
    expect(match.snapshot.events.find((e) => e.type === 'LEVEL_COMPLETE')).toEqual({
      type: 'LEVEL_COMPLETE',
      level: 1,
      bonus: 200,
    })

    clock.set(clearAt + LEVEL_CLEAR_MS - 1)
    match.frame()
    expect(match.snapshot.phase).toBe('LEVEL_CLEAR')
    clock.set(clearAt + LEVEL_CLEAR_MS)
    match.frame()
    expect(match.snapshot.phase).toBe('COUNTDOWN')
    const next = match.snapshot.state
    expect(next.level).toBe(2)
    expect(next.balls).toHaveLength(3)
    expect(next.lives).toBe(4)
    expect(next.score).toBe(290)
    expect(next.progress).toBe(0)
    assertSoloInvariants(next)
  })

  it('a tap closes "LEVEL CLEAR" early; the level is not skipped twice', () => {
    const { match, firstTick } = setup(aboutToClear())
    firstTick()
    match.skipHold()
    expect(match.snapshot.phase).toBe('COUNTDOWN')
    expect(match.snapshot.state.level).toBe(2)
    match.skipHold()
    match.frame()
    expect(match.snapshot.state.level).toBe(2)
  })

  it('pause on "LEVEL CLEAR" moves on to the next level exactly once', () => {
    const { match, firstTick } = setup(aboutToClear())
    firstTick()
    match.pause()
    expect(match.snapshot.state.level).toBe(1)
    match.resume()
    expect(match.snapshot.state.level).toBe(2)
    match.pause()
    match.resume()
    expect(match.snapshot.state.level).toBe(2)
  })

  it('never ticks twice per frame, also right after an in-game pause', () => {
    const { clock, match, firstTick } = setup(aboutToBeHit())
    const hitAt = firstTick()
    clock.set(hitAt + LIFE_LOST_MS)
    match.frame() // → COUNTDOWN
    clock.add(3000)
    match.frame() // → RUNNING
    const start = clock.now()
    // Кадр опоздал на десять тиков — один тик, без догона.
    clock.set(start + TICK * 10)
    match.frame()
    match.frame()
    expect(match.snapshot.ticks).toBe(2)
    clock.add(TICK - 1)
    match.frame()
    expect(match.snapshot.ticks).toBe(2)
    clock.add(1)
    match.frame()
    expect(match.snapshot.ticks).toBe(3)
  })

  it('the last life ends the game: FINISHED, no more ticks', () => {
    const { clock, match, firstTick } = setup(aboutToBeHit(1))
    firstTick()
    expect(match.snapshot.phase).toBe('FINISHED')
    expect(match.snapshot.events[match.snapshot.events.length - 1]).toEqual({ type: 'GAME_OVER', level: 1, score: 0 })
    clock.add(10_000)
    match.frame()
    match.resume()
    match.pause()
    expect(match.snapshot.ticks).toBe(1)
    expect(match.snapshot.phase).toBe('FINISHED')
  })

  it('steering works through the shared queue (5.1.1)', () => {
    const { clock, match, finishCountdown } = setup()
    const end = finishCountdown()
    match.steer('UP')
    match.steer('RIGHT')
    clock.set(end + TICK)
    match.frame()
    expect(match.snapshot.state.player.head).toEqual({ x: 9, y: 18 })
    clock.add(TICK)
    match.frame()
    expect(match.snapshot.state.player.head).toEqual({ x: 10, y: 18 })
  })
})
