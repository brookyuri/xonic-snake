import { getLegalMoves } from '../engine/moves'
import type { Direction, GameState, PlayerId } from '../engine/types'

// Раздел 5.1: бот видит только state, никогда не получает ход человека.
export function randomBot(
  state: GameState,
  rng: () => number = Math.random,
  player: PlayerId = 'P2'
): Direction {
  const legal = getLegalMoves(state, player)
  return legal[Math.floor(rng() * legal.length)]
}
