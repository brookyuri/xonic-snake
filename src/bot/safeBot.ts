import { getLegalMoves } from '../engine/moves'
import { isDeadEnd, movesAvoidingOwnTrail } from './analysis'
import { pick } from './rng'
import type { Bot } from './types'

/**
 * Случайный ход, но не на свой след и не в тупик — если есть альтернатива.
 * Спарринг-партнёр для бенчмарка: не самоубивается, но и не думает о противнике.
 */
export const safeBot: Bot = (state, player, rng = Math.random) => {
  const legal = getLegalMoves(state, player)
  const noSuicide = movesAvoidingOwnTrail(state, player)
  const open = noSuicide.filter((move) => !isDeadEnd(state, player, move))
  const pool = open.length > 0 ? open : noSuicide.length > 0 ? noSuicide : legal
  return pick(pool, rng)
}
