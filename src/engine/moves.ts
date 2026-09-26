import { BOARD_SIZE, DIRECTION_DELTA, OPPOSITE_DIRECTION } from './constants'
import type { Direction, GameState, PlayerId } from './types'

const ALL_DIRECTIONS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT']

export function getLegalMoves(state: GameState, player: PlayerId): Direction[] {
  const p = state.players[player]

  return ALL_DIRECTIONS.filter((dir) => {
    if (dir === OPPOSITE_DIRECTION[p.direction]) return false

    const delta = DIRECTION_DELTA[dir]
    const nx = p.head.x + delta.x
    const ny = p.head.y + delta.y
    if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) return false

    return true
  })
}
