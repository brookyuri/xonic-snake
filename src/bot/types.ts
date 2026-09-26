import type { Direction, GameState, PlayerId } from '../engine/types'

/**
 * Бот видит только state (раздел 5.1): ход противника в этом раунде ему недоступен.
 * rng — источник случайности для детерминированных турниров; по умолчанию Math.random.
 */
export type Bot = (state: GameState, player: PlayerId, rng?: () => number) => Direction

/**
 * То же решение, но по шагам: генератор уступает управление после каждой оцененной
 * пары ходов, чтобы game loop мог растянуть расчёт на несколько кадров.
 * Результат и расход rng — те же, что у синхронной версии.
 */
export type SteppedBot = (
  state: GameState,
  player: PlayerId,
  rng?: () => number
) => Generator<void, Direction, void>

/** Довести пошаговое решение до конца синхронно. */
export function runToEnd<T>(steps: Generator<void, T, void>): T {
  for (;;) {
    const r = steps.next()
    if (r.done) return r.value
  }
}

/** Синхронный бот как пошаговый (без промежуточных шагов). */
export function asStepped(bot: Bot): SteppedBot {
  // eslint-disable-next-line require-yield
  return function* (state, player, rng) {
    return bot(state, player, rng)
  }
}
