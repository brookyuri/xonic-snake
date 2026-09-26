import type { GameState } from '../engine/types'

/** Длительность тика по скорости, мс (раздел 5.3). Меняются только здесь. */
export const SPEEDS = { slow: 400, normal: 280, fast: 180 } as const
export type Speed = keyof typeof SPEEDS

/** Длительность матча: 2 минуты. */
export const MATCH_MS = 120_000

/** Последние секунды матча, когда таймер выделяется. */
export const FINAL_SECONDS = 10

/** maxRounds = ceil(MATCH_MS / tickMs). */
export function maxRoundsFor(tickMs: number): number {
  return Math.ceil(MATCH_MS / tickMs)
}

/**
 * Оставшееся время матча: (maxRounds − round) × tickMs, но не больше MATCH_MS —
 * из-за ceil в maxRounds (429 × 280 = 120 120 мс) на старте иначе было бы «2:01».
 */
export function timeLeftMs(state: GameState, tickMs: number): number {
  return Math.min(MATCH_MS, Math.max(0, (state.maxRounds - state.round) * tickMs))
}

/** 107 000 мс → "1:47". Секунды округляются вверх: 0:00 только в самом конце. */
export function formatClock(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
