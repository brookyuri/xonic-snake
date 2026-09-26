import type { CSSProperties } from 'react'
import type { Direction, GameState, PlayerId, Pos } from '../engine/types'

export const FLASH_MS = 300
export const HEAD_MOVE_MS = 150
export const PREVIOUS_CELL_MS = 400

/** Клетки, захваченные в последнем раунде (ключ y*size+x → захватчик). */
export interface Flash {
  cells: Map<number, PlayerId>
  lit: boolean
}

export const COLOR = {
  empty: '#0d0d13',
  p1Territory: '#123a52',
  p2Territory: '#4a1420',
  p1Trail: '#22d3ee',
  p2Trail: '#fb4142',
  p1Head: '#a5f3fc',
  p2Head: '#ffc2c8',
  p1Flash: '#cffafe',
  p2Flash: '#ffe4e6',
}

const ARROW_ROTATION: Record<Direction, number> = { UP: 0, RIGHT: 90, DOWN: 180, LEFT: 270 }
const PLAYERS: PlayerId[] = ['P1', 'P2']

interface Props {
  state: GameState
  flash?: Flash | null
  /** Где стояли головы до последнего раунда — эта клетка коротко подсвечивается. */
  previousHeads?: Record<PlayerId, Pos> | null
  /** Меняется каждый раунд, чтобы перезапустить анимацию прошлой клетки. */
  roundKey?: number
  /** Пульсация следа человека, когда он под угрозой. */
  dangerTrail?: boolean
  /** Клетки столкновения на экране конца игры. */
  highlight?: Pos[]
  className?: string
}

/** Положение элемента размером в одну клетку поверх сетки size×size. */
function cellBox(pos: Pos, size: number): CSSProperties {
  return {
    width: `${100 / size}%`,
    height: `${100 / size}%`,
    transform: `translate(${pos.x * 100}%, ${pos.y * 100}%)`,
  }
}

export function Board({
  state,
  flash,
  previousHeads,
  roundKey = 0,
  dangerTrail = false,
  highlight = [],
  className = '',
}: Props) {
  const size = state.board.length

  return (
    <div className={`relative aspect-square overflow-hidden rounded-lg border border-neutral-800 ${className}`}>
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          gridTemplateRows: `repeat(${size}, 1fr)`,
        }}
      >
        {state.board.map((row, y) =>
          row.map((cell, x) => {
            let background = COLOR.empty
            if (cell.trail === 'P1') background = COLOR.p1Trail
            else if (cell.trail === 'P2') background = COLOR.p2Trail
            else if (cell.territory === 'P1') background = COLOR.p1Territory
            else if (cell.territory === 'P2') background = COLOR.p2Territory

            const capturer = flash?.cells.get(y * size + x)
            let transition: string | undefined
            if (capturer && flash?.lit) {
              background = capturer === 'P1' ? COLOR.p1Flash : COLOR.p2Flash
            } else if (capturer) {
              transition = `background-color ${FLASH_MS}ms ease-out`
            }
            const pulsing = dangerTrail && cell.trail === 'P1'

            return (
              <div
                key={`${x}-${y}`}
                className={pulsing ? 'trail-danger' : undefined}
                style={{ backgroundColor: background, transition }}
              />
            )
          })
        )}
      </div>

      <div className="pointer-events-none absolute inset-0">
        {previousHeads &&
          PLAYERS.map((id) => (
            <div
              key={`prev-${id}-${roundKey}`}
              className="previous-cell absolute left-0 top-0"
              style={{
                ...cellBox(previousHeads[id], size),
                backgroundColor: id === 'P1' ? COLOR.p1Head : COLOR.p2Head,
                animationDuration: `${PREVIOUS_CELL_MS}ms`,
              }}
            />
          ))}

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
                transition: `transform ${HEAD_MOVE_MS}ms ease-out`,
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
                  <path d="M5 1.5 L8.5 7 L5 5.6 L1.5 7 Z" fill="#0d0d13" />
                </svg>
              </div>
            </div>
          )
        })}

        {highlight.map((pos, i) => (
          <div
            key={`hit-${i}`}
            data-collision
            className="collision-cell absolute left-0 top-0 rounded-sm"
            style={cellBox(pos, size)}
          />
        ))}
      </div>
    </div>
  )
}
