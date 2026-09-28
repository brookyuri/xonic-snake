import { Container, FillGradient, Graphics, GraphicsPath, Sprite, Texture } from 'pixi.js'
import type { PlayerId } from '../../engine/types'
import {
  bodyBase,
  dashIntervals,
  DIRECTION_ANGLE,
  headRotation,
  interpolateCell,
  polylineLength,
  dashPolyline,
  segmentWidth,
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

/** Номер слоя угрозы в LAYERS: его прозрачность меняется на кадре. */
const DANGER_LAYER = 2

const LAYERS: LayerSpec[] = [
  { color: 'glow', alpha: 0.12, factor: 1, extra: 8, cap: 'round' },
  { color: 'glow', alpha: 0.22, factor: 1, extra: 4, cap: 'round' },
  // Угроза следу: свечение, прозрачность пульсирует на кадре (по умолчанию 0).
  { color: 'danger', alpha: 1, factor: 1, extra: 10, cap: 'round' },
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
  specs: readonly LayerSpec[],
  layers: readonly Graphics[],
  points: readonly Pt[],
  startIndex: number,
  dashPhase: number,
  m: SnakeMetrics,
  pal: SnakePalette
): void {
  if (points.length < 2) return
  specs.forEach((spec, li) => {
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
 * Слой последнего участка: прямоугольники из белой текстуры (сплошной — один, пунктир — пул).
 * Лишние куски не прячутся через visible, а сжимаются в ноль: в Pixi v8 смена visible
 * заставляет пересобирать список отрисовки всей сцены на каждом кадре.
 */
class SegmentLayer {
  readonly container = new Container()
  private readonly sprites: Sprite[] = []

  constructor(
    private readonly color: number,
    private readonly alpha: number
  ) {}

  /** Прямоугольник вдоль отрезка: от from до to (px от начала), толщина width. */
  private piece(i: number, x: number, y: number, angle: number, from: number, to: number, width: number): void {
    let sprite = this.sprites[i]
    if (!sprite) {
      sprite = new Sprite(Texture.WHITE)
      sprite.anchor.set(0, 0.5)
      sprite.tint = this.color
      sprite.alpha = this.alpha
      this.sprites.push(sprite)
      this.container.addChild(sprite)
    }
    sprite.position.set(x + Math.cos(angle) * from, y + Math.sin(angle) * from)
    sprite.rotation = angle
    sprite.setSize(to - from, width)
  }

  /** Отрезок из (x, y) под углом angle длины length; dash — [on, off, phase] или сплошной. */
  draw(x: number, y: number, angle: number, length: number, width: number, dash?: [number, number, number]): void {
    let used = 0
    if (!dash) this.piece(used++, x, y, angle, 0, length, width)
    else for (const [from, to] of dashIntervals(length, dash[0], dash[1], dash[2])) this.piece(used++, x, y, angle, from, to, width)
    for (let i = used; i < this.sprites.length; i++) this.sprites[i].setSize(0, 0)
  }

  hide(): void {
    for (const sprite of this.sprites) sprite.setSize(0, 0)
  }
}

/** Смерть: вспышка тела белым, затем частицы; голова гаснет последней. */
export const DEATH_FLASH_MS = 120
const HEAD_FADE_FROM_MS = 350
const HEAD_FADE_MS = 400
/** Угроза: прозрачность свечения 0.25 ↔ 0.6, период 400 мс. */
const DANGER_PERIOD_MS = 400

/**
 * Одна змея: неподвижная часть тела перестраивается только на тике. Последний участок —
 * прямой отрезок до интерполированной головы — это прямоугольники-спрайты: на кадре
 * меняются только их положение и длина, геометрия не строится. Его концы закрыты
 * круглым концом неподвижной части и головой. Шея «дома» строится один раз и едет с головой.
 */
export class SnakeSprite {
  readonly container = new Container()
  /** Всё тело без головы: для смерти и затемнения. */
  private readonly body = new Container()
  private readonly specs: LayerSpec[]
  private readonly fixed: Graphics[]
  private readonly moving: SegmentLayer[]
  private readonly neck = new Container()
  private readonly neckLayers: Graphics[]
  private readonly flash = new Graphics()
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
  private danger = false
  /** Момент смерти (0 — жива) и ход, на котором умерла: новый ход — снова жива (возрождение). */
  private diedAt = 0
  private diedKey = ''
  private lastEnd: Pt = { x: 0, y: 0 }

  constructor(
    id: PlayerId,
    private m: SnakeMetrics,
    private readonly reducedMotion: boolean
  ) {
    this.pal = SNAKE[id]
    this.tonguePhase = id === 'P1' ? 0 : TONGUE_PERIOD_MS / 2
    // Reduced motion: вместо пульсации — статичная красная обводка тела (уже, чем свечение).
    this.specs = LAYERS.map((spec, i) => (i === DANGER_LAYER && reducedMotion ? { ...spec, extra: 6 } : spec))
    // Слои чередуются: неподвижная часть слоя, затем её продолжение — так последний участок
    // не перекрывает кольца и блик соседнего отрезка.
    this.fixed = this.specs.map(() => new Graphics())
    this.moving = this.specs.map((spec) => new SegmentLayer(this.pal[spec.color] as number, spec.alpha))
    this.specs.forEach((_, i) => this.body.addChild(this.fixed[i], this.moving[i].container))
    this.neckLayers = this.specs.map(() => new Graphics())
    this.neck.addChild(...this.neckLayers)
    this.body.addChild(this.neck)
    const { head, tongue } = buildHead(this.pal)
    this.head = head
    this.tongue = tongue
    this.flash.alpha = 0
    this.container.addChild(this.body, this.flash, this.head)
    this.setMetrics(m)
    this.applyDanger(0)
  }

  setMetrics(m: SnakeMetrics): void {
    this.m = m
    this.head.scale.set(m.headScale)
    // Шея в своих координатах: от 0.6 клетки позади до головы, ось X — вперёд.
    for (const g of this.neckLayers) g.clear()
    drawBody(this.specs, this.neckLayers, [{ x: -0.6 * m.cell, y: 0 }, { x: 0, y: 0 }], 2, 0, m, this.pal)
    this.baseKey = ''
    if (this.view) this.update(this.view, this.danger)
  }

  update(view: SnakeView, danger = false): void {
    this.view = view
    this.danger = danger
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
    // Возрождение (Solo): змейка уже в другом месте — снова видна.
    if (this.diedAt > 0 && moveKey !== this.diedKey) this.revive()

    const key = `${this.m.cell}|${view.trail.map((p) => `${p.x},${p.y}`).join(' ')}|${view.head.x},${view.head.y}`
    if (key === this.baseKey) return
    this.baseKey = key
    this.base = bodyBase(view.trail, view.head, this.m.cell)
    for (const g of this.fixed) g.clear()
    drawBody(this.specs, this.fixed, this.base, 0, 0, this.m, this.pal)
    this.baseDashLength = this.base.length > 1 ? polylineLength(this.base.slice(1)) : 0
  }

  /**
   * Смерть (событие движка DIED / LIFE_LOST). Возвращает точки тела для частиц — по 3 на
   * клетку. Reduced motion: тело просто темнеет, без вспышки и частиц.
   */
  die(now: number): Pt[] {
    if (!this.view || this.diedAt > 0) return []
    this.diedAt = now
    this.diedKey = this.moveKey
    const end = interpolateCell(this.view.prevHead, this.view.head, 1, this.m.cell)
    this.lastEnd = end
    this.angle = this.angleTo
    if (this.reducedMotion) return []
    const line = [...this.base, end]
    this.flash.clear()
    if (line.length > 1) {
      this.flash.moveTo(line[0].x, line[0].y)
      for (let i = 1; i < line.length; i++) this.flash.lineTo(line[i].x, line[i].y)
      this.flash.stroke({ width: this.m.width + 2.5 * this.m.px, color: 0xffffff, cap: 'round', join: 'round' })
    } else this.flash.circle(end.x, end.y, this.m.width / 2).fill(0xffffff)
    const points: Pt[] = []
    for (let i = 1; i < line.length; i++) {
      for (const t of [0.2, 0.55, 0.85]) {
        points.push({ x: line[i - 1].x + (line[i].x - line[i - 1].x) * t, y: line[i - 1].y + (line[i].y - line[i - 1].y) * t })
      }
    }
    if (points.length === 0) points.push(end)
    return points
  }

  /** Цвета частиц смерти: тело, блик, кольца, белый. */
  get deathColors(): number[] {
    return [this.pal.body, this.pal.sheen, this.pal.ring, 0xffffff]
  }

  private revive(): void {
    this.diedAt = 0
    this.body.alpha = 1
    this.head.alpha = 1
    this.flash.alpha = 0
  }

  private applyDanger(now: number): void {
    const a = !this.danger || this.diedAt > 0 ? 0 : this.reducedMotion ? 1 : 0.425 + 0.175 * Math.sin((now / DANGER_PERIOD_MS) * Math.PI * 2)
    this.fixed[DANGER_LAYER].alpha = a
    this.moving[DANGER_LAYER].container.alpha = a
    this.neckLayers[DANGER_LAYER].alpha = a
  }

  frame(alpha: number, now: number): void {
    const view = this.view
    if (!view) return
    const dead = this.diedAt > 0
    // Мёртвая змея стоит в клетке удара.
    const end = dead ? this.lastEnd : interpolateCell(view.prevHead, view.head, alpha, this.m.cell)
    this.lastEnd = end
    if (!dead) this.angle = headRotation(this.angleFrom, this.angleTo, alpha)
    const home = this.base.length === 0
    // alpha, а не visible — см. SegmentLayer.
    this.neck.alpha = home ? 1 : 0
    this.neck.position.set(end.x, end.y)
    this.neck.rotation = this.angle
    this.drawMoving(home ? null : this.base[this.base.length - 1], end)
    this.head.position.set(end.x, end.y)
    this.head.rotation = this.angle
    this.tongue.alpha = !dead && !this.reducedMotion && (now + this.tonguePhase) % TONGUE_PERIOD_MS < TONGUE_SHOWN_MS ? 1 : 0
    this.applyDanger(now)
    if (dead) this.dying(now - this.diedAt)
  }

  private dying(t: number): void {
    if (this.reducedMotion) {
      this.body.alpha = 0.35
      this.head.alpha = 0.35
      return
    }
    this.flash.alpha = t < DEATH_FLASH_MS ? 1 : 0
    this.body.alpha = t < DEATH_FLASH_MS ? 1 : 0
    this.head.alpha = t < HEAD_FADE_FROM_MS ? 1 : Math.max(0, 1 - (t - HEAD_FADE_FROM_MS) / HEAD_FADE_MS)
  }

  /** Последний участок: от конца неподвижной части до интерполированной головы. */
  private drawMoving(last: Pt | null, end: Pt): void {
    const length = last ? Math.hypot(end.x - last.x, end.y - last.y) : 0
    if (!last || length < 1e-3) {
      for (const layer of this.moving) layer.hide()
      return
    }
    const angle = Math.atan2(end.y - last.y, end.x - last.x)
    const index = this.base.length - 1
    this.specs.forEach((spec, i) => {
      // Слои «от клетки 1» не рисуются на первом отрезке тела.
      if (spec.fromCell1 && index === 0) return this.moving[i].hide()
      const width = segmentWidth(index, 1) * spec.factor * this.m.width + spec.extra * this.m.px
      const dash: [number, number, number] | undefined = spec.dash
        ? [spec.dash[0] * this.m.px, spec.dash[1] * this.m.px, this.baseDashLength]
        : undefined
      this.moving[i].draw(last.x, last.y, angle, length, width, dash)
    })
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }
}
