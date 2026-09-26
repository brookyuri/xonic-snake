import { createInitialState } from '../engine/state'
import { getLegalMoves } from '../engine/moves'
import { resolveRound } from '../engine/resolve'
import type { Direction, GameEvent, GameState } from '../engine/types'
import type { Bot } from '../bot/types'
import { enqueueDirection, straightOrClockwise, takeHumanMove } from './input'

export type Phase = 'COUNTDOWN' | 'RUNNING' | 'PAUSED' | 'FINISHED'

export const COUNTDOWN_MS = 3000

export interface MatchOptions {
  tickMs: number
  maxRounds: number
  /** Бот за RED (P2). Видит только state на начало тика. */
  bot: Bot
  rng?: () => number
  /** Часы матча в мс. В браузере — performance.now, в тестах — фейковые. */
  now?: () => number
  countdownMs?: number
  /** Недопустимый ход бота — баг: в strict-режиме бросаем, иначе правило упора 5.1. */
  strict?: boolean
}

export interface MatchSnapshot {
  phase: Phase
  state: GameState
  /** События последнего тика. */
  events: GameEvent[]
  /** Сыграно тиков. */
  ticks: number
  /** 3, 2, 1 во время отсчёта; 0 в остальное время. */
  countdown: number
  /** Нажатия, ещё не забранные тиками (5.1.1). */
  queue: readonly Direction[]
  /** Сколько заняли ход бота + resolveRound на последнем тике, мс. */
  lastTickCostMs: number
}

/**
 * Матч в реальном времени (раздел 5.1). UI вызывает frame() на каждом кадре
 * (requestAnimationFrame); контроллер сам решает, пора ли тикать.
 */
export class MatchController {
  private readonly opts: Required<Omit<MatchOptions, 'rng' | 'strict'>> & Pick<MatchOptions, 'rng' | 'strict'>
  private listeners = new Set<() => void>()
  private countdownEndsAt = 0
  private nextTickAt = 0
  snapshot: MatchSnapshot

  constructor(options: MatchOptions) {
    this.opts = {
      now: () => performance.now(),
      countdownMs: COUNTDOWN_MS,
      ...options,
    }
    this.snapshot = {
      phase: 'COUNTDOWN',
      state: createInitialState({ maxRounds: options.maxRounds }),
      events: [],
      ticks: 0,
      countdown: 0,
      queue: [],
      lastTickCostMs: 0,
    }
    this.startCountdown()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Нажатие направления: в очередь (5.1.1). На паузе и после конца игры игнорируется. */
  steer(direction: Direction): void {
    const { phase, queue, state } = this.snapshot
    if (phase === 'PAUSED' || phase === 'FINISHED') return
    const next = enqueueDirection(queue, state.players.P1.direction, direction)
    if (next.length !== queue.length) this.update({ queue: next })
  }

  pause(): void {
    const { phase } = this.snapshot
    if (phase === 'RUNNING' || phase === 'COUNTDOWN') this.update({ phase: 'PAUSED', countdown: 0 })
  }

  /** Возобновление — снова с отсчёта 3-2-1 (5.1.2). */
  resume(): void {
    if (this.snapshot.phase === 'PAUSED') this.startCountdown()
  }

  togglePause(): void {
    if (this.snapshot.phase === 'PAUSED') this.resume()
    else this.pause()
  }

  /** Один кадр. Максимум один тик за вызов: отставшая вкладка не «догоняет» пачкой. */
  frame(): void {
    const now = this.opts.now()
    const { phase } = this.snapshot

    if (phase === 'COUNTDOWN') {
      if (now >= this.countdownEndsAt) {
        // Первый тик — ровно через tickMs после конца отсчёта.
        this.nextTickAt = this.countdownEndsAt + this.opts.tickMs
        this.update({ phase: 'RUNNING', countdown: 0 })
      } else {
        const countdown = Math.ceil((this.countdownEndsAt - now) / 1000)
        if (countdown !== this.snapshot.countdown) this.update({ countdown })
      }
      return
    }

    if (phase !== 'RUNNING' || now < this.nextTickAt) return
    this.tick()
    // Накопитель без дрейфа: следующий тик отсчитывается от запланированного, не от фактического.
    this.nextTickAt += this.opts.tickMs
    // Если кадр опоздал больше чем на тик — пропущенное время не отыгрываем.
    if (this.nextTickAt <= now) this.nextTickAt = now + this.opts.tickMs
  }

  private startCountdown(): void {
    this.countdownEndsAt = this.opts.now() + this.opts.countdownMs
    this.update({ phase: 'COUNTDOWN', countdown: Math.ceil(this.opts.countdownMs / 1000) })
  }

  private tick(): void {
    const started = performance.now()
    const { state, queue, ticks } = this.snapshot

    // Ход бота — строго по state на начало тика, до хода человека (5.1).
    let botMove = this.opts.bot(state, 'P2', this.opts.rng)
    if (!getLegalMoves(state, 'P2').includes(botMove)) {
      if (this.opts.strict) throw new Error(`Bot returned an illegal move: ${botMove}`)
      botMove = straightOrClockwise(state, 'P2')
    }
    const human = takeHumanMove(state, 'P1', queue)
    const result = resolveRound(state, human.move, botMove)

    this.update({
      state: result.state,
      events: result.events,
      queue: human.queue,
      ticks: ticks + 1,
      phase: result.state.status === 'FINISHED' ? 'FINISHED' : 'RUNNING',
      lastTickCostMs: performance.now() - started,
    })
  }

  private update(patch: Partial<MatchSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }
}
