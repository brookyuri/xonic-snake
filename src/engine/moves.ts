import { BOARD_SIZE, DIRECTION_DELTA, OPPOSITE_DIRECTION } from './constants'
import type { Direction, GameState, PlayerId, Pos } from './types'

const ALL_DIRECTIONS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT']

/**
 * Раздел 5.2: недопустимы выход за поле size×size и разворот на 180°.
 * Общая часть для Duel (15×15) и Solo (20×20).
 */
export function legalMovesFrom(head: Pos, direction: Direction, size: number): Direction[] {
  return ALL_DIRECTIONS.filter((dir) => {
    if (dir === OPPOSITE_DIRECTION[direction]) return false

    const delta = DIRECTION_DELTA[dir]
    const nx = head.x + delta.x
    const ny = head.y + delta.y
    if (nx < 0 || nx >= size || ny < 0 || ny >= size) return false

    return true
  })
}

export function getLegalMoves(state: GameState, player: PlayerId): Direction[] {
  const p = state.players[player]
  return legalMovesFrom(p.head, p.direction, BOARD_SIZE)
}
