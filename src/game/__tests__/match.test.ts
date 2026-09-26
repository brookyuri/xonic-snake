import { describe, it, expect } from 'vitest'
import { MatchController, type MatchOptions } from '../match'
import { asStepped, type Bot } from '../../bot/types'
import type { Direction } from '../../engine/types'
import { assertInvariants } from '../../engine/invariants'
import { normalBot, normalBotSteps } from '../../bot/normalBot'
import { mulberry32 } from '../../bot/rng'

const TICK = 280

/** Фейковые часы: время двигает только тест. */
function fakeClock(start = 1000) {
  let t = start
  return {
    now: () => t,
    set: (v: number) => void (t = v),
    add: (dt: number) => void (t += dt),
  }
}

/** Бот, который ходит по заданному списку, а потом прямо. */
function scriptedBot(moves: Direction[]): Bot {
  return (state) => moves[state.round] ?? state.players.P2.direction
}

// RED кружит по периметру своего дома 3×3 и никогда из него не выходит.
const RED_CIRCLE: Direction[] = ['LEFT', 'UP', 'RIGHT', 'RIGHT', 'DOWN', 'DOWN', 'LEFT', 'LEFT']
const circlingBot: Bot = (state) => RED_CIRCLE[state.round % RED_CIRCLE.length]
// BLUE: шаг вверх внутри дома, дальше — круг по периметру дома.
const BLUE_CIRCLE: Direction[] = ['LEFT', 'DOWN', 'DOWN', 'RIGHT', 'RIGHT', 'UP', 'UP', 'LEFT']
const blueTurn = (tick: number): Direction => (tick === 0 ? 'UP' : BLUE_CIRCLE[(tick - 1) % BLUE_CIRCLE.length])

function setup(extra: Partial<MatchOptions> = {}) {
  const clock = fakeClock()
  const match = new MatchController({
    tickMs: TICK,
    maxRounds: 100,
    bot: asStepped(circlingBot),
    now: clock.now,
    strict: true,
    ...extra,
  })
  /** Дойти до конца отсчёта; возвращает момент его окончания. */
  const finishCountdown = () => {
    const end = clock.now() + 3000
    clock.set(end)
    match.frame()
    expect(match.snapshot.phase).toBe('RUNNING')
    return end
  }
  return { clock, match, finishCountdown }
}

describe('MatchController', () => {
  it('counts down 3-2-1 before running', () => {
    const { clock, match } = setup()
    const seen: number[] = []
    for (let t = 0; t < 3000; t += 250) {
      clock.set(1000 + t)
      match.frame()
      seen.push(match.snapshot.countdown)
    }
    expect([...new Set(seen)]).toEqual([3, 2, 1])
    expect(match.snapshot.phase).toBe('COUNTDOWN')
    expect(match.snapshot.ticks).toBe(0)
  })

  it('the first tick lands exactly tickMs after the countdown', () => {
    const { clock, match, finishCountdown } = setup()
    const end = finishCountdown()
    clock.set(end + TICK - 1)
    match.frame()
    expect(match.snapshot.ticks).toBe(0)
    clock.set(end + TICK)
    match.frame()
    expect(match.snapshot.ticks).toBe(1)
  })

  it('never ticks twice for one frame and does not catch up after a stall', () => {
    const { clock, match, finishCountdown } = setup()
    const end = finishCountdown()
    clock.set(end + TICK)
    match.frame()
    match.frame()
    expect(match.snapshot.ticks).toBe(1)

    // Вкладка «зависла» на 5 тиков: один тик за кадр и дальше обычный темп.
    clock.set(end + 6 * TICK)
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

  it('does not drift: ticks stay on the tickMs grid despite late frames', () => {
    const { clock, match, finishCountdown } = setup()
    const end = finishCountdown()
    // Кадры приходят с опозданием 7 мс, но расписание не сдвигается.
    for (let i = 1; i <= 20; i++) {
      match.steer(blueTurn(i - 1))
      clock.set(end + i * TICK + 7)
      match.frame()
    }
    expect(match.snapshot.phase).toBe('RUNNING')
    expect(match.snapshot.ticks).toBe(20)
    clock.set(end + 21 * TICK - 1)
    match.frame()
    expect(match.snapshot.ticks).toBe(20)
  })

  it('pause freezes the snakes; resume starts a new 3-2-1', () => {
    const { clock, match, finishCountdown } = setup()
    const end = finishCountdown()
    clock.set(end + TICK)
    match.frame()
    const before = match.snapshot.state

    match.pause()
    for (let i = 0; i < 20; i++) {
      clock.add(TICK)
      match.frame()
    }
    expect(match.snapshot.phase).toBe('PAUSED')
    expect(match.snapshot.state).toBe(before)
    expect(match.snapshot.ticks).toBe(1)

    match.steer('LEFT')
    expect(match.snapshot.queue).toEqual([])

    match.resume()
    expect(match.snapshot.phase).toBe('COUNTDOWN')
    expect(match.snapshot.countdown).toBe(3)
    const resumedEnd = finishCountdown()
    clock.set(resumedEnd + TICK)
    match.frame()
    expect(match.snapshot.ticks).toBe(2)
  })

  it('applies queued turns one per tick (rule example)', () => {
    const { clock, match, finishCountdown } = setup()
    const end = finishCountdown()
    // BLUE идёт UP; за один тик нажаты RIGHT, DOWN.
    match.steer('RIGHT')
    match.steer('DOWN')
    clock.set(end + TICK)
    match.frame()
    expect(match.snapshot.state.players.P1.direction).toBe('RIGHT')
    clock.set(end + 2 * TICK)
    match.frame()
    expect(match.snapshot.state.players.P1.direction).toBe('DOWN')
  })

  it('finishes at maxRounds and stops ticking', () => {
    const { clock, match, finishCountdown } = setup({ maxRounds: 4 })
    const end = finishCountdown()
    // BLUE кружит внутри своего дома: LEFT, DOWN, RIGHT, RIGHT.
    const turns: Direction[] = ['LEFT', 'DOWN', 'RIGHT', 'UP']
    for (let i = 1; i <= 4; i++) {
      match.steer(turns[i - 1])
      clock.set(end + i * TICK)
      match.frame()
      assertInvariants(match.snapshot.state)
    }
    expect(match.snapshot.phase).toBe('FINISHED')
    expect(match.snapshot.state.result?.reason).toBe('ROUND_LIMIT')
    clock.add(10 * TICK)
    match.frame()
    expect(match.snapshot.ticks).toBe(4)
  })

  it('in strict mode an illegal bot move is a bug', () => {
    const { clock, match, finishCountdown } = setup({ bot: asStepped(scriptedBot(['UP'])) })
    const end = finishCountdown()
    clock.set(end + TICK)
    // RED стартует с direction DOWN: UP — разворот.
    expect(() => match.frame()).toThrow(/illegal/)
  })

  it('without strict an illegal bot move falls back to the wall rule', () => {
    const { clock, match, finishCountdown } = setup({ bot: asStepped(scriptedBot(['UP'])), strict: false })
    const end = finishCountdown()
    clock.set(end + TICK)
    match.frame()
    expect(match.snapshot.state.players.P2.direction).toBe('DOWN')
  })

  it('the bot decides from the state at the start of the tick, before the human move', () => {
    const seen: number[] = []
    const spy: Bot = (state) => {
      seen.push(state.round)
      return circlingBot(state, 'P2')
    }
    const { clock, match, finishCountdown } = setup({ bot: asStepped(spy) })
    const end = finishCountdown()
    match.steer('LEFT')
    clock.set(end + TICK)
    match.frame()
    expect(seen).toEqual([0])
    expect(match.snapshot.state.round).toBe(1)
  })

  it('a bot move prepared between ticks gives exactly the same game, one bot call per state', () => {
    const play = (prepare: boolean) => {
      let calls = 0
      const counting: Bot = (state, player, rng) => {
        calls++
        return normalBot(state, player, rng)
      }
      const { clock, match, finishCountdown } = setup({ bot: asStepped(counting), rng: mulberry32(11), maxRounds: 40 })
      const end = finishCountdown()
      const turns: Direction[] = ['LEFT', 'UP', 'UP', 'RIGHT', 'RIGHT', 'DOWN', 'DOWN', 'LEFT']
      for (let i = 1; i <= 40 && match.snapshot.phase === 'RUNNING'; i++) {
        if (prepare) {
          match.prepareBotMove()
          match.prepareBotMove() // повторный вызов для того же state ничего не пересчитывает
        }
        match.steer(turns[i % turns.length])
        clock.set(end + i * TICK)
        match.frame()
      }
      return { state: JSON.stringify(match.snapshot.state), ticks: match.snapshot.ticks, calls }
    }
    const direct = play(false)
    const prepared = play(true)
    expect(prepared.state).toBe(direct.state)
    expect(prepared.calls).toBe(direct.calls)
    expect(prepared.calls).toBe(prepared.ticks)
  })

  it('a bot decision sliced into tiny budgets gives the same game as one computed at the tick', () => {
    const play = (budgetMs: number | null) => {
      const { clock, match, finishCountdown } = setup({ bot: normalBotSteps, rng: mulberry32(21), maxRounds: 30 })
      const end = finishCountdown()
      let slices = 0
      const turns: Direction[] = ['UP', 'LEFT', 'LEFT', 'UP', 'RIGHT', 'RIGHT', 'RIGHT', 'DOWN']
      for (let i = 1; i <= 30 && match.snapshot.phase === 'RUNNING'; i++) {
        // Как в UI: несколько кусков между тиками, возможно не до конца.
        if (budgetMs !== null) for (let k = 0; k < 3; k++) if (!match.prepareBotMove(budgetMs)) slices++
        match.steer(turns[i % turns.length])
        clock.set(end + i * TICK)
        match.frame()
      }
      return { state: JSON.stringify(match.snapshot.state), slices }
    }
    const atTick = play(null)
    const sliced = play(0)
    expect(sliced.state).toBe(atTick.state)
    expect(sliced.slices).toBeGreaterThan(0)
  })
})
