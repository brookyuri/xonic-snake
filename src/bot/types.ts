import type { Direction, GameState, PlayerId } from '../engine/types'

/**
 * Бот видит только state (раздел 5.1): ход противника в этом раунде ему недоступен.
 * rng — источник случайности для детерминированных турниров; по умолчанию Math.random.
 */
export type Bot = (state: GameState, player: PlayerId, rng?: () => number) => Direction
