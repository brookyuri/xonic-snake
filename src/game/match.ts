import { createInitialState } from '../engine/state'
import { getLegalMoves } from '../engine/moves'
import { resolveRound } from '../engine/resolve'
import type { Direction, GameEvent, GameState } from '../engine/types'
import type { SteppedBot } from '../bot/types'
import { enqueueDirection, straightOrClockwise, takeHumanMove } from './input'

/**
 * COUNTDOWN / RUNNING / PAUSED / FINISHED — общие для режимов. LIFE_LOST и LEVEL_CLEAR —
 * только Solo: короткая пауза в игре (вспышка удара, экран «LEVEL N CLEAR»), затем отсчёт.
 */
export type Phase = 'COUNTDOWN' | 'RUNNING' | 'PAUSED' | 'FINISHED' | 'LIFE_LOST' | 'LEVEL_CLEAR'

export const COUNTDOWN_MS = 3000

export interface Snapshot<S, E> {
  phase: Phase
  state: S
  /** События последнего тика. */
  events: E[]
  /** Сыграно тиков (за всю партию). */
  ticks: number
  /** 3, 2, 1 во время отсчёта; 0 в остальное время. */
  countdown: number
  /** Нажатия, ещё не забранные тиками (5.1.1). */
  queue: readonly Direction[]
  /** Сколько занял сам тик (движок, плюс ход бота, если он не был посчитан заранее), мс. */
  lastTickCostMs: number
  /** Когда начался последний тик (часы матча). */
  lastTickAt: number
}

export type MatchSnapshot = Snapshot<GameState, GameEvent>

export interface TickOptions {
  tickMs: number
  /** Часы матча в мс. В браузере — performance.now, в тестах — фейковые. */
  now?: () => number
  countdownMs?: number
}

/** Итог тика для общего цикла: новое состояние и куда перейти дальше. */
export interface TickResult<S, E> {
  state: S
  events: E[]
  queue: Direction[]
  /** RUNNING, FINISHED или пауза в игре (LIFE_LOST / LEVEL_CLEAR) на holdMs. */
  phase: Phase
  holdMs?: number
}

/**
 * Общий цикл реального времени (GAME_RULES.md 5.1–5.1.2) для Duel и Solo: отсчёт
 * 3-2-1, тики без дрейфа и без «догона», очередь нажатий, пауза. UI вызывает frame()
 * на каждом кадре (requestAnimationFrame); контроллер сам решает, пора ли тикать.
 */
export abstract class TickController<S, E> {
  protected readonly now: () => number
  protected readonly tickMs: number
  private readonly countdownMs: number
  private listeners = new Set<() => void>()
  private countdownEndsAt = 0
  private nextTickAt = 0
  private holdEndsAt = 0
  snapshot: Snapshot<S, E>

  constructor(options: TickOptions, initial: S) {
    this.now = options.now ?? (() => performance.now())
    this.tickMs = options.tickMs
    this.countdownMs = options.countdownMs ?? COUNTDOWN_MS
    this.snapshot = {
      phase: 'COUNTDOWN',
      state: initial,
      events: [],
      ticks: 0,
      countdown: 0,
      queue: [],
      lastTickCostMs: 0,
      lastTickAt: 0,
    }
    this.startCountdown()
  }

  /** Текущее направление змейки человека (для правил очереди 5.1.1). */
  protected abstract direction(state: S): Direction

  /** Разыграть один тик: движок + ход из очереди. */
  protected abstract resolveTick(state: S, queue: readonly Direction[]): TickResult<S, E>

  /** Перед отсчётом после паузы в игре (Solo: continueSolo). По умолчанию — ничего. */
  protected beforeCountdown(state: S): S {
    return state
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Нажатие направления: в очередь (5.1.1). Работает только во время отсчёта и игры. */
  steer(direction: Direction): void {
    const { phase, queue, state } = this.snapshot
    if (phase !== 'RUNNING' && phase !== 'COUNTDOWN') return
    const next = enqueueDirection(queue, this.direction(state), direction)
    if (next.length !== queue.length) this.update({ queue: next })
  }

  pause(): void {
    const { phase } = this.snapshot
    if (phase === 'RUNNING' || phase === 'COUNTDOWN' || phase === 'LIFE_LOST' || phase === 'LEVEL_CLEAR') {
      this.update({ phase: 'PAUSED', countdown: 0 })
    }
  }

  /** Возобновление — снова с отсчёта 3-2-1 (5.1.2). */
  resume(): void {
    if (this.snapshot.phase === 'PAUSED') this.startCountdown()
  }

  togglePause(): void {
    if (this.snapshot.phase === 'PAUSED') this.resume()
    else this.pause()
  }

  /** Досрочно закрыть экран «LEVEL N CLEAR» (тап). Вспышку удара пропустить нельзя. */
  skipHold(): void {
    if (this.snapshot.phase === 'LEVEL_CLEAR') this.startCountdown()
  }

  /** Один кадр. Максимум один тик за вызов: отставшая вкладка не «догоняет» пачкой. */
  frame(): void {
    const now = this.now()
    const { phase } = this.snapshot

    if (phase === 'COUNTDOWN') {
      if (now >= this.countdownEndsAt) {
        // Первый тик — ровно через tickMs после конца отсчёта.
        this.nextTickAt = this.countdownEndsAt + this.tickMs
        this.update({ phase: 'RUNNING', countdown: 0 })
      } else {
        const countdown = Math.ceil((this.countdownEndsAt - now) / 1000)
        if (countdown !== this.snapshot.countdown) this.update({ countdown })
      }
      return
    }

    if (phase === 'LIFE_LOST' || phase === 'LEVEL_CLEAR') {
      if (now >= this.holdEndsAt) this.startCountdown()
      return
    }

    if (phase !== 'RUNNING' || now < this.nextTickAt) return
    this.tick()
    // Накопитель без дрейфа: следующий тик отсчитывается от запланированного, не от фактического.
    this.nextTickAt += this.tickMs
    // Если кадр опоздал больше чем на тик — пропущенное время не отыгрываем.
    if (this.nextTickAt <= now) this.nextTickAt = now + this.tickMs
  }

  private startCountdown(): void {
    this.countdownEndsAt = this.now() + this.countdownMs
    this.update({
      phase: 'COUNTDOWN',
      state: this.beforeCountdown(this.snapshot.state),
      countdown: Math.ceil(this.countdownMs / 1000),
    })
  }

  private tick(): void {
    const tickAt = this.now()
    const started = performance.now()
    const { state, queue, ticks } = this.snapshot
    const result = this.resolveTick(state, queue)
    if (result.holdMs !== undefined) this.holdEndsAt = tickAt + result.holdMs
    this.update({
      state: result.state,
      events: result.events,
      // Очередь очищается при потере жизни (SOLO_RULES 2.1) и после уровня: старое нажатие
      // не должно вывести змейку с рамки сразу после отсчёта.
      queue: result.phase === 'RUNNING' ? result.queue : [],
      ticks: ticks + 1,
      phase: result.phase,
      lastTickCostMs: performance.now() - started,
      lastTickAt: tickAt,
    })
  }

  protected update(patch: Partial<Snapshot<S, E>>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }
}

export interface MatchOptions extends TickOptions {
  maxRounds: number
  /** Бот за RED (P2), пошаговый. Видит только state на начало тика. */
  bot: SteppedBot
  rng?: () => number
  /** Недопустимый ход бота — баг: в strict-режиме бросаем, иначе правило упора 5.1. */
  strict?: boolean
}

/** Матч Duel (раздел 5.1): человек P1 против бота P2. */
export class MatchController extends TickController<GameState, GameEvent> {
  private readonly opts: MatchOptions
  /** Решение бота для конкретного state: генератор, который можно продвигать по кускам. */
  private pending: {
    state: GameState
    steps: Generator<void, Direction, void>
    move: Direction | null
    ms: number
  } | null = null
  /** Сколько думал бот над последним ходом, мс (для диагностики производительности). */
  lastBotMs = 0

  constructor(options: MatchOptions) {
    super(options, createInitialState({ maxRounds: options.maxRounds }))
    this.opts = options
  }

  protected direction(state: GameState): Direction {
    return state.players.P1.direction
  }

  /**
   * Считать ход бота заранее — в паузе между тиками, кусками не дольше budgetMs,
   * а не одним куском в кадре тика. Бот смотрит только на state начала тика, а он
   * известен сразу после предыдущего тика, поэтому решение то же самое; меняется лишь
   * момент расчёта. Возвращает true, когда ход готов.
   */
  prepareBotMove(budgetMs = Infinity): boolean {
    const { phase, state } = this.snapshot
    if (phase === 'FINISHED') return true
    if (this.pending?.state !== state) {
      this.pending = { state, steps: this.opts.bot(state, 'P2', this.opts.rng), move: null, ms: 0 }
    }
    return this.advanceBot(budgetMs)
  }

  private advanceBot(budgetMs: number): boolean {
    const pending = this.pending!
    if (pending.move) return true
    const started = performance.now()
    for (;;) {
      const step = pending.steps.next()
      if (step.done) {
        pending.move = this.validBotMove(pending.state, step.value)
        break
      }
      if (performance.now() - started >= budgetMs) break
    }
    pending.ms += performance.now() - started
    if (pending.move) this.lastBotMs = pending.ms
    return pending.move !== null
  }

  private validBotMove(state: GameState, move: Direction): Direction {
    if (getLegalMoves(state, 'P2').includes(move)) return move
    if (this.opts.strict) throw new Error(`Bot returned an illegal move: ${move}`)
    return straightOrClockwise(state, 'P2')
  }

  protected resolveTick(state: GameState, queue: readonly Direction[]): TickResult<GameState, GameEvent> {
    // Ход бота — строго по state на начало тика, до хода человека (5.1).
    this.prepareBotMove() // досчитать синхронно, если не успели между тиками
    const botMove = this.pending!.move!
    this.pending = null
    const human = takeHumanMove(state, 'P1', queue)
    const result = resolveRound(state, human.move, botMove)
    return {
      state: result.state,
      events: result.events,
      queue: human.queue,
      phase: result.state.status === 'FINISHED' ? 'FINISHED' : 'RUNNING',
    }
  }
}
