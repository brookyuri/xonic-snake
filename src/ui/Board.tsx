import { memo, useLayoutEffect, useRef, type CSSProperties, type PointerEventHandler, type ReactNode } from 'react'
import type { Cell, Direction, GameState, Owner, PlayerId, Pos } from '../engine/types'

/** Клетки, захваченные в последнем тике (ключ y*size+x → захватчик). */
export interface Flash {
  cells: Map<number, PlayerId>
}

const ARROW_ROTATION: Record<Direction, number> = { UP: 0, RIGHT: 90, DOWN: 180, LEFT: 270 }

/** Голова змейки на поле. */
export interface HeadView {
  id: PlayerId
  pos: Pos
  direction: Direction
}

/** Головы Duel: BLUE и RED. */
export const duelHeads = (state: GameState): HeadView[] =>
  (['P1', 'P2'] as const).map((id) => ({ id, pos: state.players[id].head, direction: state.players[id].direction }))

interface Props {
  /** Доска любого размера (Duel 15×15, Solo 20×20, схемы в правилах). */
  board: readonly (readonly Cell[])[]
  heads: readonly HeadView[]
  /** Шарики Solo: квадраты поверх клеток, двигаются дискретно. */
  balls?: readonly Pos[]
  flash?: Flash | null
  /** Мигание следа человека, когда он под угрозой. */
  dangerTrail?: boolean
  /** Клетки столкновения на экране конца игры. */
  highlight?: Pos[]
  /**
   * Как мигает клетка столкновения: 'fill' — вся клетка белым/чёрным (Duel), 'frame' —
   * только рамка, содержимое клетки видно (удар в Solo).
   */
  highlightStyle?: 'fill' | 'frame'
  /** Рамка показывает полосы «загрузки» (отсчёт 3-2-1). */
  loading?: boolean
  className?: string
  style?: CSSProperties
  onPointerDown?: PointerEventHandler<HTMLDivElement>
  onPointerMove?: PointerEventHandler<HTMLDivElement>
  onPointerUp?: PointerEventHandler<HTMLDivElement>
  children?: ReactNode
}

/** Положение элемента размером в одну клетку поверх сетки size×size. */
function cellBox(pos: Pos, size: number): CSSProperties {
  return {
    width: `${100 / size}%`,
    height: `${100 / size}%`,
    transform: `translate(${pos.x * 100}%, ${pos.y * 100}%)`,
  }
}

/** Класс клетки: земля — сплошная заливка, след — штриховка (различаются не только цветом). */
export function cellClass(territory: Owner, trail: Owner, captured: boolean, danger: boolean): string {
  if (captured) return 'cell cell-capture'
  if (trail === 'P1') return danger ? 'cell cell-p1-trail trail-danger' : 'cell cell-p1-trail'
  if (trail === 'P2') return 'cell cell-p2-trail'
  if (territory === 'P1') return 'cell cell-p1-land'
  if (territory === 'P2') return 'cell cell-p2-land'
  return 'cell'
}

/** Период мигания угрозы; должен совпадать с --blink-ms в index.css. */
const BLINK_MS = 640

/**
 * Клетка перерисовывается только когда меняется её класс: за тик обычно
 * меняются 2–4 клетки из 225, остальные React пропускает.
 */
const CellView = memo(function CellView({ className }: { className: string }) {
  const ref = useRef<HTMLDivElement>(null)
  // Клетки следа становятся «под угрозой» в разные тики; отрицательная задержка по общим
  // часам ставит каждую в одну фазу мигания с остальными.
  useLayoutEffect(() => {
    if (ref.current && className.includes('trail-danger')) {
      ref.current.style.animationDelay = `-${Math.round(performance.now() % BLINK_MS)}ms`
    }
  }, [className])
  return <div ref={ref} className={className} />
})

/** Какие клетки строки y сейчас во вспышке захвата: строка-ключ вида ",3,4,5". */
function flashedInRow(flash: Flash | null | undefined, y: number, size: number): string {
  if (!flash) return ''
  let key = ''
  for (let x = 0; x < size; x++) if (flash.cells.has(y * size + x)) key += `,${x}`
  return key
}

/**
 * Строка поля. Движок Solo оставляет неизменённые строки теми же объектами, поэтому
 * React пропускает строку целиком (за тик обычно меняется одна строка из 20); в Duel
 * строки копируются каждый раунд — тогда работает memo клеток.
 */
const Row = memo(function Row({
  row,
  y,
  flashed,
  danger,
}: {
  row: readonly Cell[]
  y: number
  flashed: string
  danger: boolean
}) {
  const size = row.length
  return (
    <>
      {row.map((cell, x) => (
        <CellView
          key={y * size + x}
          className={cellClass(cell.territory, cell.trail, isFlashed(flashed, x), danger)}
        />
      ))}
    </>
  )
})

const isFlashed = (flashed: string, x: number) => flashed !== '' && `${flashed},`.includes(`,${x},`)

/** Пиксельная стрелка 7×7, смотрит вверх; поворот — на кратные 90°, пиксели не размываются. */
export function PixelArrow({ direction, className = '' }: { direction: Direction; className?: string }) {
  return (
    <svg
      viewBox="0 0 7 7"
      shapeRendering="crispEdges"
      className={className}
      style={{ transform: `rotate(${ARROW_ROTATION[direction]}deg)` }}
      aria-hidden
    >
      <path d="M3 0h1v1h1v1h1v1h1v1H5v3H2V4H0V3h1V2h1V1h1z" fill="currentColor" />
    </svg>
  )
}

export function Board({
  board,
  heads,
  balls = [],
  flash,
  dangerTrail = false,
  highlight = [],
  highlightStyle = 'fill',
  loading = false,
  className = '',
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  children,
}: Props) {
  const size = board.length

  return (
    <div
      className={`board-frame relative aspect-square overflow-hidden ${loading ? 'board-loading' : ''} ${className}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="grid h-full w-full"
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gridTemplateRows: `repeat(${size}, 1fr)` }}
      >
        {board.map((row, y) => (
          <Row
            key={y}
            row={row}
            y={y}
            flashed={flashedInRow(flash, y, size)}
            danger={dangerTrail && row.some((c) => c.trail === 'P1')}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0">
        {heads.map(({ id, pos, direction }) => (
          <div
            key={`head-${id}`}
            data-head={id}
            className="board-piece absolute left-0 top-0 flex items-center justify-center"
            style={cellBox(pos, size)}
          >
            <div className={`head ${id === 'P1' ? 'head-p1' : 'head-p2'}`}>
              <PixelArrow direction={direction} className="h-[70%] w-[70%]" />
            </div>
          </div>
        ))}

        {/* Шарики поверх голов: в одной клетке они бывают только в момент удара — шарик должен быть виден. */}
        {balls.map((pos, i) => (
          <div
            key={`ball-${i}`}
            data-ball
            className="board-piece absolute left-0 top-0 flex items-center justify-center"
            style={cellBox(pos, size)}
          >
            <div className="ball" />
          </div>
        ))}

        {highlight.map((pos, i) => (
          <div
            key={`hit-${i}`}
            data-collision
            className={`${highlightStyle === 'frame' ? 'hit-frame' : 'collision-cell'} absolute left-0 top-0`}
            style={cellBox(pos, size)}
          />
        ))}
      </div>
      {children}
    </div>
  )
}

export type LegendItem = readonly [className: string, label: string]

export const DUEL_LEGEND: readonly LegendItem[] = [
  ['cell-p1-land', 'Your land'],
  ['cell-p1-trail', 'Your trail'],
  ['cell-p2-land', 'RED land'],
  ['cell-p2-trail', 'RED trail'],
]

/** 'ball' — не заливка клетки, а сам шарик на пустой клетке. */
export const SOLO_LEGEND: readonly LegendItem[] = [
  ['cell-p1-land', 'Your land'],
  ['cell-p1-trail', 'Your trail'],
  ['ball', 'Ball'],
]

/** Легенда (правила, пауза): те же заливки, штриховки и шарик, что и на поле. */
export function Legend({ items = DUEL_LEGEND }: { items?: readonly LegendItem[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1 font-pixel text-[10px] uppercase text-ts-text2" data-testid="legend">
      {items.map(([cls, label]) => (
        <li key={cls} className="flex items-center gap-2">
          {cls === 'ball' ? (
            <span className="cell inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
              <span className="ball" />
            </span>
          ) : (
            <span className={`cell ${cls} inline-block h-3.5 w-3.5 shrink-0`} aria-hidden />
          )}
          {label}
        </li>
      ))}
    </ul>
  )
}
