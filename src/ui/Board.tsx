import type { GameState, PlayerId } from '../engine/types'
import { BOARD_SIZE } from '../engine/constants'

export const FLASH_MS = 300

/** Клетки, захваченные в последнем раунде (ключ y*BOARD_SIZE+x → захватчик). */
export interface Flash {
  cells: Map<number, PlayerId>
  lit: boolean
}

const COLOR = {
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

export function Board({ state, flash }: { state: GameState; flash: Flash | null }) {
  const { P1, P2 } = state.players

  return (
    <div
      className="grid w-full aspect-square rounded-lg overflow-hidden border border-neutral-800"
      style={{
        gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
        gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
      }}
    >
      {state.board.map((row, y) =>
        row.map((cell, x) => {
          const isP1Head = P1.head.x === x && P1.head.y === y
          const isP2Head = P2.head.x === x && P2.head.y === y

          let background = COLOR.empty
          if (cell.trail === 'P1') background = COLOR.p1Trail
          else if (cell.trail === 'P2') background = COLOR.p2Trail
          else if (cell.territory === 'P1') background = COLOR.p1Territory
          else if (cell.territory === 'P2') background = COLOR.p2Territory

          const headColor = isP1Head ? COLOR.p1Head : isP2Head ? COLOR.p2Head : null

          const capturer = flash?.cells.get(y * BOARD_SIZE + x)
          let transition: string | undefined
          if (capturer && flash?.lit) {
            background = capturer === 'P1' ? COLOR.p1Flash : COLOR.p2Flash
          } else if (capturer) {
            transition = `background-color ${FLASH_MS}ms ease-out`
          }

          return (
            <div
              key={`${x}-${y}`}
              className="relative"
              style={{ backgroundColor: background, transition }}
            >
              {headColor && (
                <div
                  className="absolute inset-[18%] rounded-full"
                  style={{ backgroundColor: headColor, boxShadow: `0 0 6px 1px ${headColor}` }}
                />
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
