import type { Direction, Pos } from '../engine/types'

/**
 * Геометрия поля 2026 (VISUAL_2026.md раздел 3) — чистые функции без Pixi: центральная
 * линия тела, сужение хвоста, пунктир по длине дуги, интерполяция головы и шариков.
 * Координаты — пиксели поля, клетка cell × cell, (0,0) — левый верхний угол.
 */

export interface Pt {
  x: number
  y: number
}

export const cellCenter = (p: Pos, cell: number): Pt => ({ x: (p.x + 0.5) * cell, y: (p.y + 0.5) * cell })

export const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

const samePt = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6

/** Голова или шарик между клетками: lerp(старая клетка, новая, alpha). */
export const interpolateCell = (from: Pos, to: Pos, alpha: number, cell: number): Pt =>
  lerpPt(cellCenter(from, cell), cellCenter(to, cell), alpha)

/**
 * Неподвижная часть тела (до следующего тика): центры клеток следа от первой к голове,
 * без клетки головы — её место занимает интерполированная голова. Не зависит от alpha.
 */
export function bodyBase(trail: readonly Pos[], head: Pos, cell: number): Pt[] {
  const n = trail.length
  const upTo = n > 0 && trail[n - 1].x === head.x && trail[n - 1].y === head.y ? n - 1 : n
  const points: Pt[] = []
  for (let i = 0; i < upTo; i++) points.push(cellCenter(trail[i], cell))
  return points
}

/**
 * Центральная линия тела: неподвижная часть + интерполированная голова. Меньше двух точек —
 * змейка дома (или только что вышла): рисуются голова и шея.
 */
export function bodyPolyline(trail: readonly Pos[], prevHead: Pos, head: Pos, alpha: number, cell: number): Pt[] {
  const points = bodyBase(trail, head, cell)
  if (points.length === 0) return points
  const end = interpolateCell(prevHead, head, alpha, cell)
  if (!samePt(points[points.length - 1], end)) points.push(end)
  return points
}

/** Сужение хвоста: отрезок 0→1 — 0.44W, 1→2 — 0.74W, дальше W. */
export function segmentWidth(index: number, width: number): number {
  return index === 0 ? 0.44 * width : index === 1 ? 0.74 * width : width
}

/**
 * Участки одной толщины для штриха: [0→1], [1→2], [2→…]. startIndex — номер первого
 * отрезка points в теле (для хвоста, продолженного другим куском).
 */
export function taperRuns(points: readonly Pt[], width: number, startIndex = 0): { width: number; points: Pt[] }[] {
  const runs: { width: number; points: Pt[] }[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const w = segmentWidth(startIndex + i, width)
    const last = runs[runs.length - 1]
    if (last && last.width === w) last.points.push(points[i + 1])
    else runs.push({ width: w, points: [points[i], points[i + 1]] })
  }
  return runs
}

export function polylineLength(points: readonly Pt[]): number {
  let length = 0
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  return length
}

/**
 * Пунктир по длине дуги: куски линии, где (phase + s) mod (on + off) < on. phase — длина,
 * пройденная до points[0]: так рисунок продолжается без сдвига, когда тело растёт с головы
 * или рисуется двумя кусками. Кусок может проходить через вершину (угол) — тогда в нём
 * несколько точек.
 */
export function dashPolyline(points: readonly Pt[], on: number, off: number, phase = 0): Pt[][] {
  const period = on + off
  // Границы штрихов считаются от абсолютной длины дуги: шаг до следующей границы всегда
  // не меньше EPS, поэтому цикл не застревает на погрешностях (клетка 22.6 px и т.п.).
  const EPS = 1e-7
  const dashes: Pt[][] = []
  let current: Pt[] | null = null
  let s = phase
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len === 0) continue
    const end = s + len
    let pos = s
    while (pos < end - EPS) {
      let k = Math.floor(pos / period)
      let local = pos - k * period
      if (local >= period - EPS) {
        k++
        local = 0
      }
      const inDash = local < on - EPS
      const next = Math.min(end, k * period + (inDash ? on : period))
      if (inDash) {
        if (!current) {
          current = [lerpPt(a, b, (pos - s) / len)]
          dashes.push(current)
        }
        current.push(lerpPt(a, b, (next - s) / len))
      } else current = null
      pos = next
    }
    s = end
  }
  return dashes
}

/**
 * Пунктир на прямом отрезке длины length: интервалы [от, до] вдоль отрезка, где
 * (phase + s) mod (on + off) < on. То же правило, что в dashPolyline.
 */
export function dashIntervals(length: number, on: number, off: number, phase = 0): [number, number][] {
  const period = on + off
  const out: [number, number][] = []
  // Начало штриха, в который попадает phase, в координатах отрезка (может быть < 0).
  let start = Math.floor(phase / period) * period - phase
  for (; start < length; start += period) {
    const from = Math.max(0, start)
    const to = Math.min(length, start + on)
    if (to - from > 1e-7) out.push([from, to])
  }
  return out
}

/** Угол направления (ось y вниз): RIGHT 0, DOWN π/2, LEFT π, UP −π/2. */
export const DIRECTION_ANGLE: Record<Direction, number> = {
  RIGHT: 0,
  DOWN: Math.PI / 2,
  LEFT: Math.PI,
  UP: -Math.PI / 2,
}

/** Доля тика, за которую голова доворачивает к новому направлению. */
export const TURN_SHARE = 0.3

/** Поворот головы: от старого угла к новому по кратчайшей дуге за первые 30% тика. */
export function headRotation(from: number, to: number, alpha: number): number {
  let delta = (to - from) % (2 * Math.PI)
  if (delta > Math.PI) delta -= 2 * Math.PI
  if (delta < -Math.PI) delta += 2 * Math.PI
  const t = Math.min(1, Math.max(0, alpha / TURN_SHARE))
  return from + delta * t
}

/** Змейка дома: шея 0.6 клетки назад от головы (чтобы было видно, куда она смотрит). */
export function neckPolyline(head: Pt, angle: number, cell: number): Pt[] {
  const back = 0.6 * cell
  return [{ x: head.x - Math.cos(angle) * back, y: head.y - Math.sin(angle) * back }, head]
}
