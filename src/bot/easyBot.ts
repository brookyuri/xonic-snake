import { getLegalMoves } from '../engine/moves'
import { movesAvoidingOwnTrail, step } from './analysis'
import { chooseMove, EASY_CONFIG } from './normalBot'
import { pick } from './rng'
import type { Bot } from './types'

/**
 * Бот уровня Easy поверх normalBot (EASY_CONFIG):
 * - реакция: думает только на каждом REACTION_TICKS-м тике, в остальные едет прямо,
 *   если прямо — не стена и не собственный след;
 * - ошибки: с вероятностью MISTAKE_RATE берёт случайный ход, не ведущий на свой след;
 * - меньше осторожности (MINMAX_WEIGHT) и вдвое слабее атака.
 */
export const easyBot: Bot = (state, player, rng = Math.random) => {
  const config = EASY_CONFIG
  const { head, direction } = state.players[player]

  if (state.round % config.REACTION_TICKS !== 0) {
    const ahead = step(head, direction)
    const straightIsLegal = getLegalMoves(state, player).includes(direction)
    if (straightIsLegal && state.board[ahead.y][ahead.x].trail !== player) return direction
  }

  if (rng() < config.MISTAKE_RATE) {
    const safe = movesAvoidingOwnTrail(state, player)
    if (safe.length > 0) return pick(safe, rng)
  }

  return chooseMove(state, player, rng, config)
}
