import { continueSolo, createSoloState, getLegalMoves, resolveSoloTick } from '../engine/solo'
import type { SoloEvent, SoloState } from '../engine/solo'
import type { Direction } from '../engine/types'
import { takeMoveFrom } from './input'
import { TickController, type Snapshot, type TickOptions, type TickResult } from './match'

/** Вспышка клетки удара: 3 мигания по 320 мс, затем отсчёт 3-2-1. */
export const LIFE_LOST_MS = 960
/** Экран «LEVEL N CLEAR»: 1.5 с или до тапа, затем отсчёт и новый уровень. */
export const LEVEL_CLEAR_MS = 1500

export type SoloSnapshot = Snapshot<SoloState, SoloEvent>

export interface SoloMatchOptions extends TickOptions {
  /** Зерно шариков: одна партия — одно зерно (SOLO_RULES.md раздел 8). */
  seed: number
  /** Начальная позиция вместо старта уровня 1 (для тестов). */
  initial?: SoloState
  lifeLostMs?: number
  levelClearMs?: number
}

/**
 * Партия Solo на общем цикле (тики, очередь, пауза, автопауза, отсчёт) плюс паузы в
 * игре: после LIFE_LOST — вспышка удара, после LEVEL_COMPLETE — экран уровня; обе
 * заканчиваются отсчётом 3-2-1. GAME_OVER — конец партии.
 */
export class SoloMatchController extends TickController<SoloState, SoloEvent> {
  private readonly holds: { lifeLost: number; levelClear: number }

  constructor(options: SoloMatchOptions) {
    super(options, options.initial ?? createSoloState({ seed: options.seed }))
    this.holds = {
      lifeLost: options.lifeLostMs ?? LIFE_LOST_MS,
      levelClear: options.levelClearMs ?? LEVEL_CLEAR_MS,
    }
  }

  protected direction(state: SoloState): Direction {
    return state.player.direction
  }

  /** Пауза в игре закончилась (по таймеру, тапу или после PAUSE → RESUME) — продолжаем. */
  protected beforeCountdown(state: SoloState): SoloState {
    return state.status === 'LIFE_LOST' || state.status === 'LEVEL_COMPLETE' ? continueSolo(state) : state
  }

  protected resolveTick(state: SoloState, queue: readonly Direction[]): TickResult<SoloState, SoloEvent> {
    const human = takeMoveFrom(getLegalMoves(state), state.player.direction, queue)
    const result = resolveSoloTick(state, human.move)
    const base = { state: result.state, events: result.events, queue: human.queue }
    switch (result.state.status) {
      case 'GAME_OVER':
        return { ...base, phase: 'FINISHED' }
      case 'LIFE_LOST':
        return { ...base, phase: 'LIFE_LOST', holdMs: this.holds.lifeLost }
      case 'LEVEL_COMPLETE':
        return { ...base, phase: 'LEVEL_CLEAR', holdMs: this.holds.levelClear }
      default:
        return { ...base, phase: 'RUNNING' }
    }
  }
}
