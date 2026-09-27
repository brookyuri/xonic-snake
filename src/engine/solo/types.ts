import type { Cell, Player, Pos } from '../types'

/** SOLO_RULES.md раздел 3. */
export type SoloStatus = 'PLAYING' | 'LIFE_LOST' | 'LEVEL_COMPLETE' | 'GAME_OVER'

export type Unit = -1 | 1

export interface Ball {
  pos: Pos
  /** Всегда диагональ: dx, dy ∈ {-1, +1}. */
  vel: { dx: Unit; dy: Unit }
}

export interface SoloState {
  /** 20×20, board[y][x]; слои те же, что в Duel (territory / trail только P1). */
  board: Cell[][]
  player: Player
  balls: Ball[]
  /** С 1. */
  level: number
  /** Старт 3, максимум 5. */
  lives: number
  score: number
  /** Захваченные клетки внутреннего поля / 324, 0..1. */
  progress: number
  /** Тики с начала уровня. */
  round: number
  status: SoloStatus
  /** Шарики детерминированы от seed. */
  seed: number
}

export type LifeLostReason = 'SELF_TRAIL' | 'BALL_HIT'

/** SOLO_RULES.md раздел 8. */
export type SoloEvent =
  | { type: 'MOVED'; from: Pos; to: Pos }
  | { type: 'TRAIL_STARTED' }
  | { type: 'CAPTURED'; cells: Pos[]; points: number }
  | { type: 'BALLS_MOVED'; balls: { from: Pos; to: Pos }[] }
  | { type: 'LIFE_LOST'; reason: LifeLostReason; at: Pos; livesLeft: number }
  | { type: 'LEVEL_COMPLETE'; level: number; bonus: number }
  | { type: 'GAME_OVER'; level: number; score: number }
