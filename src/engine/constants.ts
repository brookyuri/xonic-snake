import type { Direction, Pos } from './types'

export const BOARD_SIZE = 15
/** Лимит матча по умолчанию (тесты, бенчмарк). В игре задаётся по скорости — раздел 5.3. */
export const MAX_ROUNDS = 100

export const DIRECTION_DELTA: Record<Direction, Pos> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
}

export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
}

// Раздел 3 GAME_RULES.md: территория 3x3, голова в центре верхнего/нижнего края.
export const START = {
  P1: {
    territory: { xMin: 6, xMax: 8, yMin: 11, yMax: 13 },
    head: { x: 7, y: 12 } as Pos,
    direction: 'UP' as Direction,
  },
  P2: {
    territory: { xMin: 6, xMax: 8, yMin: 1, yMax: 3 },
    head: { x: 7, y: 2 } as Pos,
    direction: 'DOWN' as Direction,
  },
}
