import { getLegalMoves } from '../engine/moves'
import { pick } from './rng'
import type { Bot } from './types'

/** Случайный легальный ход. Нужен только как базовый противник в тестах. */
export const randomBot: Bot = (state, player, rng = Math.random) =>
  pick(getLegalMoves(state, player), rng)
