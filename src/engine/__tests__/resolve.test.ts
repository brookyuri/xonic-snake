import { describe, it, expect } from 'vitest'
import { createInitialState } from '../state'
import { resolveRound } from '../resolve'
import { BOARD_SIZE } from '../constants'
import type { GameState, PlayerId } from '../types'
import { stateFromGrid, emptyGrid, mergeFragment } from './testHelpers'

function territorySize(state: GameState, player: PlayerId): number {
  let count = 0
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.territory === player) count++
    }
  }
  return count
}

describe('T01 — exit home and start trail', () => {
  it('stays trail-less while on own territory, starts trail once outside', () => {
    let state = createInitialState()

    let res = resolveRound(state, 'UP', 'DOWN')
    state = res.state
    expect(state.players.P1.head).toEqual({ x: 7, y: 11 })
    expect(state.players.P1.trail).toEqual([])
    expect(state.board[11][7].trail).toBe('NONE')
    expect(res.events).not.toContainEqual({ type: 'TRAIL_STARTED', player: 'P1' })

    res = resolveRound(state, 'UP', 'DOWN')
    state = res.state
    expect(state.players.P1.head).toEqual({ x: 7, y: 10 })
    expect(state.players.P1.trail).toEqual([{ x: 7, y: 10 }])
    expect(state.board[10][7].trail).toBe('P1')
    expect(res.events).toContainEqual({ type: 'TRAIL_STARTED', player: 'P1' })
  })
})

describe('T06 — trail cut', () => {
  it('kills the trail owner when the opponent steps on it', () => {
    const grid = mergeFragment(emptyGrid(), ['.bbbb1.', '..2....'], 3, 6)
    const state = stateFromGrid(grid, {
      direction: { P1: 'RIGHT', P2: 'UP' },
      trail: { P1: [{ x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }] },
    })

    const { state: next } = resolveRound(state, 'UP', 'UP')

    expect(next.status).toBe('FINISHED')
    expect(next.result).toEqual({ winner: 'P2', reason: 'TRAIL_CUT' })
    expect(next.players.P1.alive).toBe(false)
  })
})

describe('T07 — trail cut happens before capture ("strike first")', () => {
  it('kills the returning player instead of applying their capture', () => {
    const grid = [
      '...............',
      '......RRR......',
      '......RRR......',
      '......RRR......',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '......BBB......',
      '......BBBb.....',
      '......BBB1.....',
      '.........2.....',
    ]
    const state = stateFromGrid(grid, {
      direction: { P1: 'DOWN', P2: 'UP' },
      trail: { P1: [{ x: 9, y: 12 }, { x: 9, y: 13 }], P2: [{ x: 9, y: 14 }] },
    })
    state.board[13][9].trail = 'P1'
    state.board[14][9].trail = 'P2'

    const before = territorySize(state, 'P1')
    const { state: next } = resolveRound(state, 'LEFT', 'UP')

    expect(next.status).toBe('FINISHED')
    expect(next.result).toEqual({ winner: 'P2', reason: 'TRAIL_CUT' })
    expect(next.players.P1.alive).toBe(false)
    expect(territorySize(next, 'P1')).toBe(before)
  })
})

describe('T08 — mutual trail cut', () => {
  it('is a DRAW with reason MUTUAL', () => {
    const grid = emptyGrid()
    grid[4] = '......2r1......'
    grid[5] = '......b........'

    const state = stateFromGrid(grid, {
      direction: { P1: 'DOWN', P2: 'RIGHT' },
      trail: { P1: [{ x: 8, y: 4 }], P2: [{ x: 6, y: 4 }] },
    })

    const { state: next } = resolveRound(state, 'LEFT', 'DOWN')

    expect(next.status).toBe('FINISHED')
    expect(next.result).toEqual({ winner: 'DRAW', reason: 'MUTUAL' })
    expect(next.players.P1.alive).toBe(false)
    expect(next.players.P2.alive).toBe(false)
  })
})

describe('T09 — self trail', () => {
  it('kills a player who steps on their own earlier trail cell', () => {
    const grid = emptyGrid()
    grid[9] = '.......bb......'
    grid[10] = '.......b1......'
    grid[0] = '2..............'

    const state = stateFromGrid(grid, {
      direction: { P1: 'DOWN', P2: 'RIGHT' },
      trail: {
        P1: [
          { x: 7, y: 10 },
          { x: 7, y: 9 },
          { x: 8, y: 9 },
          { x: 8, y: 10 },
        ],
      },
    })

    const { state: next } = resolveRound(state, 'LEFT', 'RIGHT')

    expect(next.status).toBe('FINISHED')
    expect(next.result).toEqual({ winner: 'P2', reason: 'SELF_TRAIL' })
    expect(next.players.P1.alive).toBe(false)
  })
})

describe('T10 — head-on, single cell, defender at home', () => {
  it('the player standing on their own territory wins', () => {
    const grid = emptyGrid()
    grid[5] = '.....1R2.......'
    const state = stateFromGrid(grid, { direction: { P1: 'UP', P2: 'UP' } })

    const { state: next } = resolveRound(state, 'RIGHT', 'LEFT')

    expect(next.status).toBe('FINISHED')
    expect(next.result).toEqual({ winner: 'P2', reason: 'HEAD_ON' })
  })
})

const RED_ROW = '......RRRRR....'
const BLUE_ROW = '......BBBBB....'

describe('T11 — head-on swap, bigger territory wins', () => {
  it('picks the player with more territory when neither arrives home', () => {
    const grid = emptyGrid()
    grid[1] = RED_ROW
    grid[2] = RED_ROW
    grid[3] = RED_ROW
    grid[10] = BLUE_ROW
    grid[11] = BLUE_ROW
    grid[12] = BLUE_ROW
    grid[13] = BLUE_ROW
    grid[5] = '.....12........'

    const state = stateFromGrid(grid, { direction: { P1: 'DOWN', P2: 'DOWN' } })
    expect(territorySize(state, 'P1')).toBe(20)
    expect(territorySize(state, 'P2')).toBe(15)

    const { state: next } = resolveRound(state, 'RIGHT', 'LEFT')

    expect(next.status).toBe('FINISHED')
    expect(next.result).toEqual({ winner: 'P1', reason: 'HEAD_ON' })
  })
})

describe('T12 — head-on swap, equal territory is a DRAW', () => {
  it('draws when territories are equal', () => {
    const grid = emptyGrid()
    grid[1] = RED_ROW
    grid[2] = RED_ROW
    grid[3] = RED_ROW
    grid[10] = BLUE_ROW
    grid[11] = BLUE_ROW
    grid[12] = BLUE_ROW
    grid[5] = '.....12........'

    const state = stateFromGrid(grid, { direction: { P1: 'DOWN', P2: 'DOWN' } })
    expect(territorySize(state, 'P1')).toBe(15)
    expect(territorySize(state, 'P2')).toBe(15)

    const { state: next } = resolveRound(state, 'RIGHT', 'LEFT')

    expect(next.status).toBe('FINISHED')
    expect(next.result).toEqual({ winner: 'DRAW', reason: 'HEAD_ON' })
  })
})

// BLUE territory: rows 4-11, cols 1-5 (40 cells). RED territory: rows 4-10
// always, row 11 only when includeRedRow11 (35 or 40 cells).
function roundLimitGrid(includeRedRow11: boolean): string[] {
  const grid = emptyGrid()
  const bothRow = '.BBBBB...RRRRR.'
  const blueOnlyRow = '.BBBBB.........'
  for (const y of [4, 5, 6, 8, 9, 10]) grid[y] = bothRow
  grid[7] = '.BB1BB...RRRRR.'
  grid[11] = includeRedRow11 ? bothRow : blueOnlyRow
  grid[0] = 'rrrrrrrrr2.....'
  return grid
}

describe('T20 — round limit, larger territory wins', () => {
  it('BLUE (40) beats RED (35) when round 100 is reached', () => {
    const grid = roundLimitGrid(false)
    const state = stateFromGrid(grid, {
      round: 99,
      direction: { P1: 'RIGHT', P2: 'RIGHT' },
      headCellUnder: { P1: 'P1' },
      trail: { P2: Array.from({ length: 10 }, (_, x) => ({ x, y: 0 })) },
    })
    state.board[0][9].trail = 'P2'

    expect(territorySize(state, 'P1')).toBe(40)
    expect(territorySize(state, 'P2')).toBe(35)

    const { state: next } = resolveRound(state, 'RIGHT', 'RIGHT')

    expect(next.round).toBe(100)
    expect(next.status).toBe('FINISHED')
    expect(next.result).toEqual({ winner: 'P1', reason: 'ROUND_LIMIT' })
  })
})

describe('T21 — round limit, equal territory is a DRAW', () => {
  it('draws when both have 40 cells at round 100', () => {
    const grid = roundLimitGrid(true)
    const state = stateFromGrid(grid, {
      round: 99,
      direction: { P1: 'RIGHT', P2: 'RIGHT' },
      headCellUnder: { P1: 'P1' },
      trail: { P2: Array.from({ length: 10 }, (_, x) => ({ x, y: 0 })) },
    })
    state.board[0][9].trail = 'P2'

    expect(territorySize(state, 'P1')).toBe(40)
    expect(territorySize(state, 'P2')).toBe(40)

    const { state: next } = resolveRound(state, 'RIGHT', 'RIGHT')

    expect(next.round).toBe(100)
    expect(next.status).toBe('FINISHED')
    expect(next.result).toEqual({ winner: 'DRAW', reason: 'ROUND_LIMIT' })
  })
})

describe('T22 — trail along own border captures only the trail cell', () => {
  it('captures a single cell without cutting anything off', () => {
    const grid = emptyGrid()
    grid[1] = '......RRR......'
    grid[2] = '......R2R......'
    grid[3] = '......RRR......'
    grid[11] = '......B1.......'
    grid[12] = '......BB.......'

    const state = stateFromGrid(grid, {
      direction: { P1: 'UP', P2: 'DOWN' },
      trail: { P1: [{ x: 7, y: 11 }] },
      headCellUnder: { P2: 'P2' },
    })

    expect(territorySize(state, 'P1')).toBe(3)

    const { state: next, events } = resolveRound(state, 'LEFT', 'LEFT')

    expect(next.status).toBe('PLAYING')
    expect(next.players.P1.trail).toEqual([])
    expect(territorySize(next, 'P1')).toBe(4)
    expect(next.board[11][7].territory).toBe('P1')
    expect(next.board[11][7].trail).toBe('NONE')
    expect(events).toContainEqual({
      type: 'CAPTURED',
      player: 'P1',
      cells: [{ x: 7, y: 11 }],
      stolenFromEnemy: 0,
    })
  })
})

describe('T24 — resolveRound does not mutate its input', () => {
  it('leaves the original state untouched', () => {
    const state = createInitialState()
    const snapshot = JSON.parse(JSON.stringify(state))

    resolveRound(state, 'UP', 'DOWN')

    expect(state).toEqual(snapshot)
  })
})

describe('board size sanity', () => {
  it('boards are BOARD_SIZE x BOARD_SIZE', () => {
    const state = createInitialState()
    expect(state.board.length).toBe(BOARD_SIZE)
    for (const row of state.board) expect(row.length).toBe(BOARD_SIZE)
  })
})
