import { MAX_ROUNDS } from '../engine/constants'
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
  return { board, players: { P1: player('P1'), P2: player('P2') }, round: 0, maxRounds: MAX_ROUNDS, status: 'PLAYING' }
}

/** Схема Solo: '#' земля, 't' след, '1' голова, 'o' шарик, '.' пусто. */
export interface SoloDiagram {
  board: Cell[][]
  heads: { id: 'P1'; pos: Pos; direction: Direction }[]
  balls: Pos[]
}

/** headOn — что под головой: своя земля или последняя клетка следа. */
export function soloDiagram(rows: string[], direction: Direction, headOn: 'land' | 'trail'): SoloDiagram {
  let head: Pos = { x: -10, y: -10 }
  const balls: Pos[] = []
  const board: Cell[][] = rows.map((row, y) =>
    [...row].map((ch, x) => {
      const cell: Cell = { territory: 'NONE', trail: 'NONE' }
      if (ch === '#') cell.territory = 'P1'
      if (ch === 't') cell.trail = 'P1'
      if (ch === 'o') balls.push({ x, y })
      if (ch === '1') {
        head = { x, y }
        if (headOn === 'land') cell.territory = 'P1'
        else cell.trail = 'P1'
      }
      return cell
    })
  )
  return { board, heads: [{ id: 'P1', pos: head, direction }], balls }
}
