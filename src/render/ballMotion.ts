import type { Pos } from '../engine/types'
import type { BallView } from './types'

/**
 * Движение шарика между клетками, когда шаг шарика длится span тиков (SOLO_RULES v0.3,
 * раздел 13: на Easy шарики ходят через тик). Чтобы шарик ехал плавно, без остановок через
 * тик, один шаг растягивается на span тиков: на тике шага шарик проходит первую часть пути,
 * на следующих тиках без шага — оставшиеся. Чистые функции; состояние хранит рендерер.
 */
export interface BallMotion {
  from: Pos
  to: Pos
  /** Какой по счёту тик шага сейчас идёт: 0 — тик, на котором шарик шагнул. */
  tick: number
}

const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y

/**
 * Новое движение после update(). fresh — пришёл новый тик (с событиями движка).
 * - шарик шагнул (prev ≠ pos) — новый шаг, тик 0;
 * - новый тик без шага, а шаг ещё не кончился (tick + 1 < span) — следующий тик того же шага;
 * - иначе шарик стоит в своей клетке. Обновление без тика (возрождение, новый уровень,
 *   пауза) ничего не продолжает: если клетка не та — шарик сразу в ней.
 */
export function nextBallMotion(prev: BallMotion | undefined, view: BallView, span: number, fresh: boolean): BallMotion {
  if (!same(view.prev, view.pos)) {
    // Без нового тика шаг не начинаем заново: тот же кадр пришёл ещё раз.
    if (!fresh && prev && same(prev.from, view.prev) && same(prev.to, view.pos)) return prev
    return { from: view.prev, to: view.pos, tick: 0 }
  }
  if (prev && same(prev.to, view.pos)) {
    if (!fresh) return prev
    if (prev.tick + 1 < span) return { ...prev, tick: prev.tick + 1 }
  }
  return { from: view.pos, to: view.pos, tick: 0 }
}

/**
 * Доля пройденного пути 0..1: (тик шага + alpha) / span. settled — игра стоит (отсчёт, пауза,
 * удар): шарик в своей клетке. Reduced motion — тоже без интерполяции.
 */
export function ballFraction(motion: BallMotion, alpha: number, span: number, settled: boolean): number {
  if (settled || same(motion.from, motion.to)) return 1
  return Math.min(1, (motion.tick + alpha) / Math.max(1, span))
}
