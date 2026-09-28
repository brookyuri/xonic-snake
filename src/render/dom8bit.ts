import type { Direction, Owner, PlayerId, Pos } from '../engine/types'
import type { BoardRenderer, MountOptions, RenderSnapshot } from './types'

/**
 * Тема 1986: поле из DOM-клеток — ровно то, что раньше рисовал React-компонент Board
 * (те же элементы, классы и порядок), но без React: за тик меняются только клетки,
 * у которых сменился класс, и transform голов/шариков.
 * Рамка поля (board-frame, полосы отсчёта) — у контейнера, её рисует BoardView.
 */

const ARROW_ROTATION: Record<Direction, number> = { UP: 0, RIGHT: 90, DOWN: 180, LEFT: 270 }
/** Пиксельная стрелка 7×7, смотрит вверх (та же, что на D-pad). */
export const ARROW_PATH = 'M3 0h1v1h1v1h1v1h1v1H5v3H2V4H0V3h1V2h1V1h1z'
const SVG_NS = 'http://www.w3.org/2000/svg'
const PIECE_CLASS = 'board-piece absolute left-0 top-0 flex items-center justify-center'

/** Период мигания угрозы; должен совпадать с --blink-ms в index.css. */
const BLINK_MS = 640

/** Класс клетки: земля — сплошная заливка, след — штриховка (различаются не только цветом). */
export function cellClass(territory: Owner, trail: Owner, captured: boolean, danger: boolean): string {
  if (captured) return 'cell cell-capture'
  if (trail === 'P1') return danger ? 'cell cell-p1-trail trail-danger' : 'cell cell-p1-trail'
  if (trail === 'P2') return 'cell cell-p2-trail'
  if (territory === 'P1') return 'cell cell-p1-land'
  if (territory === 'P2') return 'cell cell-p2-land'
  return 'cell'
}

/** Последний записанный стиль элемента: браузер нормализует значения, сравниваем со своими. */
const written = new WeakMap<Element, string>()

/** Положение элемента размером в одну клетку поверх сетки size×size. */
function placeCell(el: HTMLElement, pos: Pos, size: number): void {
  const key = `${size}:${pos.x},${pos.y}`
  if (written.get(el) === key) return
  written.set(el, key)
  el.style.width = `${100 / size}%`
  el.style.height = `${100 / size}%`
  el.style.transform = `translate(${pos.x * 100}%, ${pos.y * 100}%)`
}

interface HeadEl {
  box: HTMLDivElement
  svg: SVGSVGElement
}

export class Dom8bitRenderer implements BoardRenderer {
  private el: HTMLElement | null = null
  private grid: HTMLDivElement | null = null
  private pieces: HTMLDivElement | null = null
  private cols = 0
  private rows = 0
  private cells: HTMLDivElement[] = []
  private classes: string[] = []
  private heads = new Map<PlayerId, HeadEl>()
  private balls: HTMLDivElement[] = []
  private hits: HTMLDivElement[] = []

  /** Синхронный: к моменту возврата промиса поле уже в DOM (первый кадр без пустоты). */
  mount(el: HTMLElement, opts: MountOptions): Promise<void> {
    this.el = el
    this.build(opts.cols, opts.rows)
    return Promise.resolve()
  }

  private build(cols: number, rows: number): void {
    this.grid?.remove()
    this.pieces?.remove()
    this.cols = cols
    this.rows = rows
    const grid = document.createElement('div')
    grid.className = 'grid h-full w-full'
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`
    this.cells = []
    this.classes = []
    for (let i = 0; i < cols * rows; i++) {
      const cell = document.createElement('div')
      this.cells.push(cell)
      this.classes.push('')
      grid.appendChild(cell)
    }
    const pieces = document.createElement('div')
    pieces.className = 'pointer-events-none absolute inset-0'
    this.grid = grid
    this.pieces = pieces
    this.heads.clear()
    this.balls = []
    this.hits = []
    // Первыми в контейнере: за ними идут оверлеи хоста (отсчёт, LEVEL CLEAR).
    this.el!.prepend(grid, pieces)
  }

  update(s: RenderSnapshot): void {
    if (!this.el) return
    if (s.cols !== this.cols || s.rows !== this.rows) this.build(s.cols, s.rows)
    this.updateCells(s)
    this.updateHeads(s)
    this.updateBalls(s)
    this.updateHits(s)
  }

  private updateCells(s: RenderSnapshot): void {
    const danger = s.danger ?? false
    for (let y = 0; y < s.rows; y++) {
      const row = s.board[y]
      for (let x = 0; x < s.cols; x++) {
        const i = y * s.cols + x
        const cls = cellClass(row[x].territory, row[x].trail, s.flash?.has(i) ?? false, danger)
        if (cls === this.classes[i]) continue
        this.classes[i] = cls
        const cell = this.cells[i]
        cell.className = cls
        // Клетки следа становятся «под угрозой» в разные тики; отрицательная задержка по
        // общим часам ставит каждую в одну фазу мигания с остальными.
        if (cls.includes('trail-danger')) {
          cell.style.animationDelay = `-${Math.round(performance.now() % BLINK_MS)}ms`
        }
      }
    }
  }

  /** Головы — первыми в слое фигур, шарики поверх голов, клетки удара — поверх всего. */
  private updateHeads(s: RenderSnapshot): void {
    const seen = new Set<PlayerId>()
    for (const snake of s.snakes) {
      seen.add(snake.id)
      let h = this.heads.get(snake.id)
      const created = !h
      if (!h) {
        h = this.createHead(snake.id)
        this.heads.set(snake.id, h)
      }
      // Стили — до вставки в DOM (как у React): элемент сразу появляется на своём месте.
      placeCell(h.box, snake.head, s.cols)
      if (written.get(h.svg) !== snake.direction) {
        written.set(h.svg, snake.direction)
        h.svg.style.transform = `rotate(${ARROW_ROTATION[snake.direction]}deg)`
      }
      if (created) this.pieces!.insertBefore(h.box, this.balls[0] ?? this.hits[0] ?? null)
    }
    for (const [id, h] of this.heads) {
      if (seen.has(id)) continue
      h.box.remove()
      this.heads.delete(id)
    }
  }

  private createHead(id: PlayerId): HeadEl {
    const box = document.createElement('div')
    box.dataset.head = id
    box.className = PIECE_CLASS
    const head = document.createElement('div')
    head.className = `head ${id === 'P1' ? 'head-p1' : 'head-p2'}`
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', '0 0 7 7')
    svg.setAttribute('shape-rendering', 'crispEdges')
    svg.setAttribute('class', 'h-[70%] w-[70%]')
    svg.setAttribute('aria-hidden', 'true')
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', ARROW_PATH)
    path.setAttribute('fill', 'currentColor')
    svg.appendChild(path)
    head.appendChild(svg)
    box.appendChild(head)
    return { box, svg }
  }

  private updateBalls(s: RenderSnapshot): void {
    while (this.balls.length > s.balls.length) this.balls.pop()!.remove()
    while (this.balls.length < s.balls.length) {
      const box = document.createElement('div')
      box.dataset.ball = ''
      box.className = PIECE_CLASS
      const ball = document.createElement('div')
      ball.className = 'ball'
      box.appendChild(ball)
      placeCell(box, s.balls[this.balls.length].pos, s.cols)
      this.pieces!.insertBefore(box, this.hits[0] ?? null)
      this.balls.push(box)
    }
    s.balls.forEach((b, i) => placeCell(this.balls[i], b.pos, s.cols))
  }

  private updateHits(s: RenderSnapshot): void {
    const highlight = s.highlight ?? []
    const cls = `${s.highlightStyle === 'frame' ? 'hit-frame' : 'collision-cell'} absolute left-0 top-0`
    while (this.hits.length > highlight.length) this.hits.pop()!.remove()
    while (this.hits.length < highlight.length) {
      const hit = document.createElement('div')
      hit.dataset.collision = ''
      hit.className = cls
      placeCell(hit, highlight[this.hits.length], s.cols)
      this.pieces!.appendChild(hit)
      this.hits.push(hit)
    }
    highlight.forEach((pos, i) => {
      if (this.hits[i].className !== cls) this.hits[i].className = cls
      placeCell(this.hits[i], pos, s.cols)
    })
  }

  /** 1986 движется дискретно: кадры между тиками ничего не меняют. */
  frame(): void {}

  /** Размер задаёт CSS (проценты клетки) — пересчитывать нечего. */
  resize(): void {}

  destroy(): void {
    this.grid?.remove()
    this.pieces?.remove()
    this.grid = this.pieces = this.el = null
    this.heads.clear()
    this.balls = []
    this.hits = []
  }
}
