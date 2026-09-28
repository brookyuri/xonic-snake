import { Container, FillGradient, Graphics, GraphicsPath } from 'pixi.js'
import type { PlayerId } from '../../engine/types'
import {
  bodyBase,
  DIRECTION_ANGLE,
  headRotation,
  interpolateCell,
  neckPolyline,
  polylineLength,
  dashPolyline,
  taperRuns,
  type Pt,
} from '../geometry'
import type { BoardVariant, SnakeView } from '../types'
import { SNAKE, type SnakePalette } from './palette'

/** Геометрия головы в локальных координатах, ось X — вперёд (VISUAL_2026.md «Змея»). */
const HEAD_CONTOUR = 'M -9 -7 C -1 -10.5, 9 -9.5, 14 -4.5 C 16.5 -2, 16.5 2, 14 4.5 C 9 9.5, -1 10.5, -9 7 C -12 4, -12 -4, -9 -7 Z'
const HEAD_SHEEN = 'M -4 -4.5 C 2 -6.5, 8 -5.5, 11 -2.5'
const TONGUE = 'M 15.5 0 L 21 0 M 21 0 L 24 -2.6 M 21 0 L 24 2.6'

/** Язык мелькает: 250 мс каждые 1.6 с; у змей разная фаза. */
const TONGUE_PERIOD_MS = 1600
const TONGUE_SHOWN_MS = 250

/** Размеры тела от клетки (VISUAL_2026.md): «px» спецификации — при клетке 24 px. */
export interface SnakeMetrics {
  cell: number
  /** Толщина тела W. */
  width: number
  /** Масштаб «пикселей» спецификации: cell / 24. */
  px: number
  /** Масштаб головы: cell / 19 (Solo — cell / 18). */
  headScale: number
}

export function snakeMetrics(cell: number, variant: BoardVariant): SnakeMetrics {
  return {
    cell,
    width: cell * (variant === 'solo' ? 0.66 : 0.62),
    px: cell / 24,
    headScale: cell / (variant === 'solo' ? 18 : 19),
  }
}

/**
 * Слои тела снизу вверх: 2 штриха свечения, контур, тело, чешуйчатые полосы, кольца, блик.
 * factor — толщина от W (с сужением хвоста), extra — добавка в px спецификации;
 * dash — пунктир [on, off] в px спецификации; fromCell1 — слой начинается с клетки 1.
 */
interface LayerSpec {
  color: keyof SnakePalette
  alpha: number
  factor: number
  extra: number
  dash?: [number, number]
  fromCell1?: boolean
  cap: 'round' | 'butt'
}

const LAYERS: LayerSpec[] = [
  { color: 'glow', alpha: 0.12, factor: 1, extra: 8, cap: 'round' },
  { color: 'glow', alpha: 0.22, factor: 1, extra: 4, cap: 'round' },
  { color: 'outline', alpha: 1, factor: 1, extra: 2.5, cap: 'round' },
  { color: 'body', alpha: 1, factor: 1, extra: 0, cap: 'round' },
  { color: 'deep', alpha: 0.6, factor: 0.5, extra: 0, dash: [2, 5], fromCell1: true, cap: 'butt' },
  { color: 'ring', alpha: 1, factor: 0.8, extra: 0, dash: [3, 19], fromCell1: true, cap: 'butt' },
  { color: 'sheen', alpha: 0.75, factor: 0.18, extra: 0, fromCell1: true, cap: 'round' },
]

function tracePath(g: Graphics, points: readonly Pt[]): void {
  g.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y)
}

/**
 * Кусок тела points во все слои. startIndex — номер первого отрезка куска в теле (для
 * сужения хвоста), dashPhase — длина тела от клетки 1 до начала куска (пунктир не сдвигается).
 */
function drawBody(
  layers: readonly Graphics[],
  points: readonly Pt[],
  startIndex: number,
  dashPhase: number,
  m: SnakeMetrics,
  pal: SnakePalette
): void {
  if (points.length < 2) return
  LAYERS.forEach((spec, li) => {
    const g = layers[li]
    let pts = points
    let first = startIndex
    // Слои «от клетки 1» пропускают первый отрезок тела.
    if (spec.fromCell1 && startIndex === 0) {
      pts = points.slice(1)
      first = 1
      if (pts.length < 2) return
    }
    const style = { color: pal[spec.color] as number, alpha: spec.alpha, cap: spec.cap, join: 'round' as const }
    for (const run of taperRuns(pts, 1, first)) {
      const width = run.width * spec.factor * m.width + spec.extra * m.px
      if (spec.dash) {
        const runPhase = dashPhase + polylineLength(pts.slice(0, pts.indexOf(run.points[0]) + 1))
        const dashes = dashPolyline(run.points, spec.dash[0] * m.px, spec.dash[1] * m.px, runPhase)
        if (dashes.length === 0) continue
        for (const d of dashes) tracePath(g, d)
      } else tracePath(g, run.points)
      g.stroke({ ...style, width })
    }
  })
}

function buildHead(pal: SnakePalette): { head: Container; tongue: Graphics } {
  const head = new Container()
  const g = new Graphics()
  const gradient = new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: pal.head[0] },
      { offset: 0.5, color: pal.head[1] },
      { offset: 1, color: pal.head[2] },
    ],
    textureSpace: 'local',
  })
  g.path(new GraphicsPath(HEAD_CONTOUR)).fill(gradient).stroke({ width: 1.2, color: pal.outline, join: 'round' })
  g.path(new GraphicsPath(HEAD_SHEEN)).stroke({ width: 1, color: pal.sheen, alpha: 0.75, cap: 'round' })
  for (const side of [-1, 1]) {
    g.ellipse(6.5, side * 4.6, 2.4, 1.7).fill(pal.eye)
    g.rect(6.5 - 0.4, side * 4.6 - 1.3, 0.8, 2.6).fill(pal.pupil)
    g.circle(12.2, side * 1.6, 0.6).fill(pal.outline)
  }
  const tongue = new Graphics()
  tongue.path(new GraphicsPath(TONGUE)).stroke({ width: 1.2, color: pal.tongue, cap: 'round', join: 'round' })
  // Язык под головой: его основание уходит в морду.
  head.addChild(tongue, g)
  return { head, tongue }
}

/**
 * Одна змея: неподвижная часть тела перестраивается только на тике, последний участок
 * (до интерполированной головы) и голова — на каждом кадре.
 */
export class SnakeSprite {
  readonly container = new Container()
  private readonly fixed: Graphics[]
  private readonly moving: Graphics[]
  private readonly head: Container
  private readonly tongue: Graphics
  private readonly pal: SnakePalette
  private readonly tonguePhase: number
  private base: Pt[] = []
  private baseKey = ''
  /** Длина тела от клетки 1 до конца неподвижной части — фаза пунктира для последнего участка. */
  private baseDashLength = 0
  private view: SnakeView | null = null
  private moveKey = ''
  private angleFrom = 0
  private angleTo = 0
  private angle = 0

  constructor(
    id: PlayerId,
    private m: SnakeMetrics,
    private readonly reducedMotion: boolean
  ) {
    this.pal = SNAKE[id]
    this.tonguePhase = id === 'P1' ? 0 : TONGUE_PERIOD_MS / 2
    // Слои чередуются: неподвижная часть слоя, затем её продолжение — так последний участок
    // не перекрывает кольца и блик соседнего отрезка.
    this.fixed = LAYERS.map(() => new Graphics())
    this.moving = LAYERS.map(() => new Graphics())
    LAYERS.forEach((_, i) => this.container.addChild(this.fixed[i], this.moving[i]))
    const { head, tongue } = buildHead(this.pal)
    this.head = head
    this.tongue = tongue
    this.head.scale.set(m.headScale)
    this.container.addChild(this.head)
  }

  setMetrics(m: SnakeMetrics): void {
    this.m = m
    this.head.scale.set(m.headScale)
    this.baseKey = ''
    if (this.view) this.update(this.view)
  }

  update(view: SnakeView): void {
    this.view = view
    const target = DIRECTION_ANGLE[view.direction]
    const moveKey = `${view.prevHead.x},${view.prevHead.y}>${view.head.x},${view.head.y}`
    if (view.prevHead.x === view.head.x && view.prevHead.y === view.head.y) {
      // Не двигалась (старт, возрождение, схема): сразу в нужную сторону.
      this.angleFrom = this.angleTo = target
    } else if (moveKey !== this.moveKey) {
      // Новый тик: голова доворачивает от того угла, что сейчас на экране.
      this.angleFrom = Math.atan2(Math.sin(this.angle), Math.cos(this.angle))
      this.angleTo = target
    }
    this.moveKey = moveKey

    const key = `${this.m.cell}|${view.trail.map((p) => `${p.x},${p.y}`).join(' ')}|${view.head.x},${view.head.y}`
    if (key === this.baseKey) return
    this.baseKey = key
    this.base = bodyBase(view.trail, view.head, this.m.cell)
    for (const g of this.fixed) g.clear()
    drawBody(this.fixed, this.base, 0, 0, this.m, this.pal)
    this.baseDashLength = this.base.length > 1 ? polylineLength(this.base.slice(1)) : 0
  }

  frame(alpha: number, now: number): void {
    const view = this.view
    if (!view) return
    const end = interpolateCell(view.prevHead, view.head, alpha, this.m.cell)
    this.angle = headRotation(this.angleFrom, this.angleTo, alpha)
    for (const g of this.moving) g.clear()
    if (this.base.length === 0) {
      // Дома: только голова и короткая шея.
      drawBody(this.moving, neckPolyline(end, this.angle, this.m.cell), 2, 0, this.m, this.pal)
    } else {
      const last = this.base[this.base.length - 1]
      if (Math.hypot(end.x - last.x, end.y - last.y) > 1e-3) {
        drawBody(this.moving, [last, end], this.base.length - 1, this.baseDashLength, this.m, this.pal)
      }
    }
    this.head.position.set(end.x, end.y)
    this.head.rotation = this.angle
    this.tongue.visible = !this.reducedMotion && (now + this.tonguePhase) % TONGUE_PERIOD_MS < TONGUE_SHOWN_MS
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }
}
