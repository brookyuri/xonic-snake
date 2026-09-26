import { getLegalMoves } from '../engine/moves'
import type { Direction, GameState } from '../engine/types'

// Раздел 5.1: бот видит только state, никогда не получает ход человека.
export function randomBot(state: GameState): Direction {
  const legal = getLegalMoves(state, 'P2')
  return legal[Math.floor(Math.random() * legal.length)]
}
