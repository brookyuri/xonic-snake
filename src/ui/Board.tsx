import { memo, type CSSProperties, type PointerEventHandler, type ReactNode } from 'react'
import type { Direction, GameState, Owner, PlayerId, Pos } from '../engine/types'

export const FLASH_MS = 300

/** Клетки, захваченные в последнем тике (ключ y*size+x → захватчик). */
export interface Flash {
  cells: Map<number, PlayerId>
  lit: boolean
}

/** Цвета поля — переменные темы из src/theme.css. */
export const COLOR = {
  empty: 'var(--c-cell-empty)',
  p1Territory: 'var(--c-p1-land)',
  p2Territory: 'var(--c-p2-land)',
  p1Trail: 'var(--c-p1-trail)',
  p2Trail: 'var(--c-p2-trail)',
  p1Head: 'var(--c-p1-head)',
  p2Head: 'var(--c-p2-head)',
  p1Flash: 'var(--c-capture)',
  p2Flash: 'var(--c-capture)',
}

const ARROW_ROTATION: Record<Direction, number> = { UP: 0, RIGHT: 90, DOWN: 180, LEFT: 270 }
const PLAYERS: PlayerId[] = ['P1', 'P2']

interface Props {
  state: GameState
  flash?: Flash | null
  /** Длительность перехода головы между клетками; 0 — без анимации (схемы в правилах). */
  moveMs?: number
  /** Пульсация следа человека, когда он под угрозой. */
  dangerTrail?: boolean
  /** Клетки столкновения на экране конца игры. */
  highlight?: Pos[]
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

interface CellProps {
  territory: Owner
  trail: Owner
  flash: 'NONE' | 'LIT_P1' | 'LIT_P2' | 'FADING'
  pulsing: boolean
}

/**
 * Клетка перерисовывается только когда меняется её содержимое: за тик обычно
 * меняются 2–4 клетки из 225, остальные React пропускает.
 */
const Cell = memo(function Cell({ territory, trail, flash, pulsing }: CellProps) {
  let background = COLOR.empty
  if (trail === 'P1') background = COLOR.p1Trail
  else if (trail === 'P2') background = COLOR.p2Trail
  else if (territory === 'P1') background = COLOR.p1Territory
  else if (territory === 'P2') background = COLOR.p2Territory
  if (flash === 'LIT_P1') background = COLOR.p1Flash
  if (flash === 'LIT_P2') background = COLOR.p2Flash
  const transition = flash === 'FADING' ? `background-color ${FLASH_MS}ms ease-out` : undefined
  return <div className={pulsing ? 'trail-danger' : undefined} style={{ backgroundColor: background, transition }} />
})

export function Board({
  state,
  flash,
  moveMs = 0,
  dangerTrail = false,
  highlight = [],
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
      className={`relative aspect-square overflow-hidden border border-ts-border ${className}`}
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
          row.map((cell, x) => {
            const capturer = flash?.cells.get(y * size + x)
            const flashState: CellProps['flash'] = !capturer
              ? 'NONE'
              : flash!.lit
                ? capturer === 'P1'
                  ? 'LIT_P1'
                  : 'LIT_P2'
                : 'FADING'
            return (
              <Cell
                key={y * size + x}
                territory={cell.territory}
                trail={cell.trail}
                flash={flashState}
                pulsing={dangerTrail && cell.trail === 'P1'}
              />
            )
          })
        )}
      </div>

      <div className="pointer-events-none absolute inset-0">
        {PLAYERS.map((id) => {
          const player = state.players[id]
          const color = id === 'P1' ? COLOR.p1Head : COLOR.p2Head
          return (
            <div
              key={`head-${id}`}
              data-head={id}
              className="absolute left-0 top-0 flex items-center justify-center"
              style={{
                ...cellBox(player.head, size),
                // Линейно на весь тик: голова едет непрерывно, а не прыгает.
                transition: moveMs > 0 ? `transform ${moveMs}ms linear` : undefined,
              }}
            >
              <div
                className="flex h-[70%] w-[70%] items-center justify-center rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 6px 1px ${color}` }}
              >
                <svg
                  viewBox="0 0 10 10"
                  className="h-[70%] w-[70%]"
                  style={{ transform: `rotate(${ARROW_ROTATION[player.direction]}deg)` }}
                  aria-hidden
                >
                  <path d="M5 1.5 L8.5 7 L5 5.6 L1.5 7 Z" fill="var(--c-head-outline)" />
                </svg>
              </div>
            </div>
          )
        })}

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
