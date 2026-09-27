import { memo, useLayoutEffect, useRef, type CSSProperties, type PointerEventHandler, type ReactNode } from 'react'
import type { Direction, GameState, Owner, PlayerId, Pos } from '../engine/types'

/** Клетки, захваченные в последнем тике (ключ y*size+x → захватчик). */
export interface Flash {
  cells: Map<number, PlayerId>
}

const ARROW_ROTATION: Record<Direction, number> = { UP: 0, RIGHT: 90, DOWN: 180, LEFT: 270 }
const PLAYERS: PlayerId[] = ['P1', 'P2']

interface Props {
  state: GameState
  flash?: Flash | null
  /** Мигание следа человека, когда он под угрозой. */
  dangerTrail?: boolean
  /** Клетки столкновения на экране конца игры. */
  highlight?: Pos[]
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
const Cell = memo(function Cell({ className }: { className: string }) {
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
  state,
  flash,
  dangerTrail = false,
  highlight = [],
  loading = false,
  className = '',
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  children,
}: Props) {
  const size = state.board.length

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
        {state.board.map((row, y) =>
          row.map((cell, x) => (
            <Cell
              key={y * size + x}
              className={cellClass(cell.territory, cell.trail, !!flash?.cells.has(y * size + x), dangerTrail)}
            />
          ))
        )}
      </div>

      <div className="pointer-events-none absolute inset-0">
        {PLAYERS.map((id) => (
          <div
            key={`head-${id}`}
            data-head={id}
            className="absolute left-0 top-0 flex items-center justify-center"
            style={cellBox(state.players[id].head, size)}
          >
            <div className={`head ${id === 'P1' ? 'head-p1' : 'head-p2'}`}>
              <PixelArrow direction={state.players[id].direction} className="h-[70%] w-[70%]" />
            </div>
          </div>
        ))}

        {highlight.map((pos, i) => (
          <div
            key={`hit-${i}`}
            data-collision
            className="collision-cell absolute left-0 top-0"
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

/** Легенда (правила, пауза): те же заливки и штриховки, что и на поле. */
export function Legend({ items = DUEL_LEGEND }: { items?: readonly LegendItem[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1 font-pixel text-[10px] uppercase text-ts-text2" data-testid="legend">
      {items.map(([cls, label]) => (
        <li key={cls} className="flex items-center gap-2">
          <span className={`cell ${cls} inline-block h-3.5 w-3.5 shrink-0`} aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  )
}
