import type { Direction, Pos } from '../types'

/** Поле Solo (SOLO_RULES.md раздел 2). У Duel своё — BOARD_SIZE = 15. */
export const SOLO_BOARD_SIZE = 20

/** Внутреннее поле 18×18: прогресс считается только по нему. */
export const INNER_CELLS = (SOLO_BOARD_SIZE - 2) * (SOLO_BOARD_SIZE - 2)

/** Старт змейки в начале уровня: вдоль нижней кромки. После потери жизни — RESPAWN_POINTS. */
export const SOLO_START: { head: Pos; direction: Direction } = {
  head: { x: 9, y: SOLO_BOARD_SIZE - 1 },
  direction: 'RIGHT',
}

/**
 * Точки возрождения после потери жизни (раздел 2.1): середины сторон рамки, направление —
 * вдоль рамки по часовой стрелке. Порядок важен: при равенстве берётся первая.
 */
export const RESPAWN_POINTS: readonly { head: Pos; direction: Direction }[] = [
  { head: { x: 9, y: SOLO_BOARD_SIZE - 1 }, direction: 'RIGHT' },
  { head: { x: 0, y: 9 }, direction: 'DOWN' },
  { head: { x: 10, y: 0 }, direction: 'LEFT' },
  { head: { x: SOLO_BOARD_SIZE - 1, y: 10 }, direction: 'UP' },
]

export const START_LIVES = 3
export const MAX_LIVES = 5

/** Доля внутреннего поля для перехода на следующий уровень. */
export const LEVEL_TARGET = 0.75

/** Шарики появляются не ближе этого расстояния (по Чебышёву) к старту змейки. */
export const BALL_MIN_DISTANCE = 6

/**
 * Шарики делают шаг раз в столько тиков (1 — каждый тик). Запас на случай, если
 * плейтест покажет, что слишком сложно (риск 12.3). В UI не выводится.
 */
export const BALL_STEP_EVERY = 1

/** Шариков на уровне N. */
export const ballsForLevel = (level: number) => level + 1

/** Очки за уровень: 100 × level плюс 50 × level за каждый полный процент сверх 75. */
export function levelBonus(level: number, innerCaptured: number): number {
  const percent = Math.floor((innerCaptured * 100) / INNER_CELLS)
  return 100 * level + 50 * level * Math.max(0, percent - Math.round(LEVEL_TARGET * 100))
}
