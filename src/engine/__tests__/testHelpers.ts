import { BOARD_SIZE } from '../constants'
import { resolveRound } from '../resolve'
import { assertInvariants } from '../invariants'
import type { Cell, Direction, GameEvent, GameState, Owner, Pos } from '../types'

/**
 * resolveRound + assertInvariants (раздел 13) + T18: клетка под новой головой
 * противника никогда не входит в захват и не меняет владельца.
 */
export function play(
  state: GameState,
  moveP1: Direction,
  moveP2: Direction
): { state: GameState; events: GameEvent[] } {
  const result = resolveRound(state, moveP1, moveP2)
  assertInvariants(result.state)

  for (const event of result.events) {
    if (event.type !== 'CAPTURED') continue
    const enemy = event.player === 'P1' ? 'P2' : 'P1'
    const head = result.state.players[enemy].head
    if (event.cells.some((c) => c.x === head.x && c.y === head.y)) {
      throw new Error(`T18 violated: ${event.player} captured ${enemy}'s head cell (${head.x},${head.y})`)
    }
    if (result.state.board[head.y][head.x].territory !== state.board[head.y][head.x].territory) {
      throw new Error(`T18 violated: owner of ${enemy}'s head cell changed during capture`)
    }
  }
  return result
}

export function startGrid(): string[] {
  const grid = emptyGrid()
  grid[1] = '......RRR......'
  grid[2] = '......R2R......'
  grid[3] = '......RRR......'
  grid[11] = '......BBB......'
  grid[12] = '......B1B......'
  grid[13] = '......BBB......'
  return grid
}

export function territorySize(state: GameState, player: 'P1' | 'P2'): number {
  let count = 0
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.territory === player) count++
    }
  }
  return count
}

/**
 * Строит GameState из ASCII-сетки раздела 1 GAME_RULES.md.
 * Символы: '.' пусто, 'B'/'R' территория, 'b'/'r' след, '1'/'2' голова.
 *
 * grid — массив из BOARD_SIZE строк длиной BOARD_SIZE (rows[y][x]).
 * "Истинное" состояние клетки под головой (территория/след/пусто), если оно
 * не пусто, передаётся через headCellUnder (символ '1'/'2' сам по себе
 * ничего не говорит о слое клетки под головой).
 */
export interface GridOptions {
  round?: number
  direction?: { P1?: Direction; P2?: Direction }
  trail?: { P1?: Pos[]; P2?: Pos[] }
  headCellUnder?: { P1?: Owner; P2?: Owner }
  alive?: { P1?: boolean; P2?: boolean }
}

export function stateFromGrid(grid: string[], options: GridOptions = {}): GameState {
  if (grid.length !== BOARD_SIZE) {
    throw new Error(`Grid must have ${BOARD_SIZE} rows, got ${grid.length}`)
  }

  const board: Cell[][] = []
  const head: { P1?: Pos; P2?: Pos } = {}

  for (let y = 0; y < BOARD_SIZE; y++) {
    const line = grid[y]
    if (line.length !== BOARD_SIZE) {
      throw new Error(`Row ${y} must have length ${BOARD_SIZE}, got ${line.length}`)
    }
    const row: Cell[] = []
    for (let x = 0; x < BOARD_SIZE; x++) {
      const ch = line[x]
      const cell: Cell = { territory: 'NONE', trail: 'NONE' }
      switch (ch) {
        case '.':
          break
        case 'B':
          cell.territory = 'P1'
          break
        case 'R':
          cell.territory = 'P2'
          break
        case 'b':
          cell.trail = 'P1'
          break
        case 'r':
          cell.trail = 'P2'
          break
        case '1':
        case '2': {
          const id = ch === '1' ? 'P1' : 'P2'
          if (head[id]) throw new Error(`Duplicate head '${ch}' at (${x},${y})`)
          head[id] = { x, y }
          break
        }
        default:
          throw new Error(`Unknown symbol '${ch}' at (${x},${y})`)
      }
      row.push(cell)
    }
    board.push(row)
  }

  if (!head.P1 || !head.P2) {
    throw new Error("Grid must contain both '1' (P1 head) and '2' (P2 head)")
  }

  const under = options.headCellUnder ?? {}
  if (under.P1) board[head.P1.y][head.P1.x].territory = under.P1
  if (under.P2) board[head.P2.y][head.P2.x].territory = under.P2

  const trail = options.trail ?? {}
  // Слой trail под головой в сетке не виден, поэтому размечаем его по спискам следа.
  for (const id of ['P1', 'P2'] as const) {
    for (const p of trail[id] ?? []) board[p.y][p.x].trail = id
  }
  const direction = options.direction ?? {}
  const alive = options.alive ?? {}

  return {
    board,
    players: {
      P1: {
        id: 'P1',
        head: head.P1,
        direction: direction.P1 ?? 'UP',
        trail: trail.P1 ?? [],
        alive: alive.P1 ?? true,
      },
      P2: {
        id: 'P2',
        head: head.P2,
        direction: direction.P2 ?? 'DOWN',
        trail: trail.P2 ?? [],
        alive: alive.P2 ?? true,
      },
    },
    round: options.round ?? 0,
    status: 'PLAYING',
  }
}

export function emptyGrid(): string[] {
  return Array.from({ length: BOARD_SIZE }, () => '.'.repeat(BOARD_SIZE))
}

/** Накладывает фрагмент на базовую сетку в позиции (x0, y0), не трогая остальное. */
export function mergeFragment(base: string[], fragment: string[], x0: number, y0: number): string[] {
  const rows = base.map((row) => row.split(''))
  for (let fy = 0; fy < fragment.length; fy++) {
    const line = fragment[fy]
    for (let fx = 0; fx < line.length; fx++) {
      const ch = line[fx]
      if (ch === ' ') continue
      rows[y0 + fy][x0 + fx] = ch
    }
  }
  return rows.map((r) => r.join(''))
}
