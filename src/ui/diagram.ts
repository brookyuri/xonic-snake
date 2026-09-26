import type { Cell, Direction, GameState, Pos } from '../engine/types'

/**
 * Маленькая схема для HOW TO PLAY в нотации GAME_RULES.md (. B R b r 1 2).
 * Возвращает GameState, чтобы схему рисовал тот же компонент Board.
 */
export function diagram(rows: string[], directions: { P1: Direction; P2: Direction }): GameState {
  const heads: Partial<Record<'P1' | 'P2', Pos>> = {}
  const board: Cell[][] = rows.map((row, y) =>
    [...row].map((ch, x) => {
      const cell: Cell = { territory: 'NONE', trail: 'NONE' }
      if (ch === 'B') cell.territory = 'P1'
      if (ch === 'R') cell.territory = 'P2'
      if (ch === 'b') cell.trail = 'P1'
      if (ch === 'r') cell.trail = 'P2'
      if (ch === '1') heads.P1 = { x, y }
      if (ch === '2') heads.P2 = { x, y }
      return cell
    })
  )
  const player = (id: 'P1' | 'P2') => ({
    id,
    head: heads[id] ?? { x: -10, y: -10 },
    direction: directions[id],
    trail: [],
    alive: true,
  })
  return { board, players: { P1: player('P1'), P2: player('P2') }, round: 0, status: 'PLAYING' }
}
