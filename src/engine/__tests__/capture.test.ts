import { describe, it, expect } from 'vitest'
import type { GameEvent, Pos } from '../types'
import {
  emptyGrid,
  mergeFragment,
  play,
  startGrid,
  stateFromGrid,
  territorySize,
} from './testHelpers'

const p = (x: number, y: number): Pos => ({ x, y })

function capturedBy(events: GameEvent[], player: 'P1' | 'P2') {
  return events.find(
    (e): e is Extract<GameEvent, { type: 'CAPTURED' }> =>
      e.type === 'CAPTURED' && e.player === player
  )
}

function rowsOf(grid: string[]) {
  return grid.map((r) => r.split(''))
}

// Петля BLUE вокруг кармана (5,9),(5,10): выход из (6,11) вверх, возврат RIGHT в (6,11).
const POCKET_LOOP_TRAIL = [
  p(6, 10), p(6, 9), p(6, 8), p(5, 8), p(4, 8), p(4, 9), p(4, 10), p(4, 11), p(5, 11),
]

function pocketLoopGrid(pocket: string): string[] {
  const grid = startGrid()
  grid[8] = '....bbb........'
  grid[9] = `....b${pocket[0]}b........`
  grid[10] = `....b${pocket[1]}b........`
  grid[11] = '....b1BBB......'
  grid[12] = '......BBB......'
  return grid
}

describe('T04 — simple capture', () => {
  it('captures the trail plus the enclosed cell (8,10)', () => {
    const grid = mergeFragment(
      startGrid(),
      ['......', '..bbb.', '..b.b.', '.BBB1.', '.BBB..', '.BBB..'],
      5,
      8
    )
    const state = stateFromGrid(grid, {
      direction: { P1: 'DOWN', P2: 'DOWN' },
      headCellUnder: { P2: 'P2' },
      trail: { P1: [p(7, 10), p(7, 9), p(8, 9), p(9, 9), p(9, 10), p(9, 11)] },
    })

    const { state: next, events } = play(state, 'LEFT', 'DOWN')

    const expected = mergeFragment(
      startGrid(),
      ['......', '..BBB.', '..BBB.', '.BBBB.', '.BBB..', '.BBB..'],
      5,
      8
    )
    for (let y = 8; y <= 13; y++) {
      for (let x = 5; x <= 10; x++) {
        const want = expected[y][x] === 'B' ? 'P1' : 'NONE'
        expect(next.board[y][x].territory, `(${x},${y})`).toBe(want)
      }
    }
    expect(capturedBy(events, 'P1')?.cells).toHaveLength(7)
    expect(territorySize(next, 'P1')).toBe(16)
    expect(next.players.P1.trail).toEqual([])
    expect(next.status).toBe('PLAYING')
  })
})

describe('T05 — pocket against the wall is captured', () => {
  it('captures the pocket touching the bottom wall but not column x = 0', () => {
    const grid = emptyGrid()
    grid[1] = '......RRR......'
    grid[2] = '......R2R......'
    grid[3] = '......RRR......'
    grid[11] = '.bbbb1.........'
    grid[12] = '.bbbbBBBBB.....'
    grid[13] = '.bb..BBBBB.....'
    grid[14] = '.bb..BBBBB.....'

    const state = stateFromGrid(grid, {
      direction: { P1: 'RIGHT', P2: 'DOWN' },
      headCellUnder: { P2: 'P2' },
      trail: {
        P1: [
          p(4, 12), p(3, 12), p(2, 12),
          p(2, 13), p(2, 14),
          p(1, 14),
          p(1, 13), p(1, 12), p(1, 11),
          p(2, 11), p(3, 11), p(4, 11), p(5, 11),
        ],
      },
    })
    expect(territorySize(state, 'P1')).toBe(15)

    const { state: next, events } = play(state, 'DOWN', 'DOWN')

    for (const cell of [p(3, 13), p(4, 13), p(3, 14), p(4, 14)]) {
      expect(next.board[cell.y][cell.x].territory, `pocket (${cell.x},${cell.y})`).toBe('P1')
    }
    for (let y = 10; y <= 14; y++) {
      expect(next.board[y][0].territory, `(0,${y})`).toBe('NONE')
    }
    expect(next.board[10][3].territory).toBe('NONE')
    expect(next.board[11][6].territory).toBe('NONE')
    expect(capturedBy(events, 'P1')?.cells).toHaveLength(17)
    expect(territorySize(next, 'P1')).toBe(32)
  })
})

describe('T13 — capturing enemy territory', () => {
  it('takes enclosed RED cells and reports stolenFromEnemy', () => {
    const state = stateFromGrid(pocketLoopGrid('RR'), {
      direction: { P1: 'RIGHT', P2: 'DOWN' },
      headCellUnder: { P2: 'P2' },
      trail: { P1: POCKET_LOOP_TRAIL },
    })
    expect(territorySize(state, 'P2')).toBe(11)

    const { state: next, events } = play(state, 'RIGHT', 'DOWN')

    expect(next.board[9][5].territory).toBe('P1')
    expect(next.board[10][5].territory).toBe('P1')
    expect(territorySize(next, 'P2')).toBe(9)
    expect(territorySize(next, 'P1')).toBe(9 + 11)
    expect(capturedBy(events, 'P1')?.stolenFromEnemy).toBe(2)
  })
})

describe('T14 — the component holding the enemy head is not captured', () => {
  it('leaves the head component alone and takes every other cut-off component', () => {
    const grid = startGrid()
    grid[1] = '...............'
    grid[2] = '...............'
    grid[3] = '...............'
    grid[5] = '....bbb........'
    grid[6] = '....bRb........'
    grid[7] = '....b2b........'
    grid[8] = '....bRb........'
    grid[9] = '....bBb........'
    grid[10] = '....b.b........'
    grid[11] = '....b1BBB......'
    grid[12] = '......BBB......'

    const state = stateFromGrid(grid, {
      direction: { P1: 'RIGHT', P2: 'DOWN' },
      headCellUnder: { P2: 'P2' },
      trail: {
        P1: [
          p(6, 10), p(6, 9), p(6, 8), p(6, 7), p(6, 6), p(6, 5),
          p(5, 5), p(4, 5),
          p(4, 6), p(4, 7), p(4, 8), p(4, 9), p(4, 10), p(4, 11),
          p(5, 11),
        ],
      },
    })

    const { state: next } = play(state, 'RIGHT', 'DOWN')

    expect(next.players.P2.head).toEqual(p(5, 8))
    for (const cell of [p(5, 6), p(5, 7), p(5, 8)]) {
      expect(next.board[cell.y][cell.x].territory).toBe('P2')
    }
    expect(next.board[10][5].territory).toBe('P1')
    // Правило 7.3 буквально: всё, что вне компоненты головы, захватывается —
    // включая внешнюю часть поля (риск 12.1).
    expect(next.board[0][0].territory).toBe('P1')
    expect(territorySize(next, 'P2')).toBe(3)
  })
})

describe('T15 — enemy head on my territory excludes the largest component', () => {
  it('captures only the small pocket', () => {
    const grid = pocketLoopGrid('..')
    grid[12] = '......BBB2R....'
    grid[2] = '......RRR......'

    const state = stateFromGrid(grid, {
      direction: { P1: 'RIGHT', P2: 'DOWN' },
      headCellUnder: { P2: 'P2' },
      trail: { P1: POCKET_LOOP_TRAIL },
    })

    const { state: next, events } = play(state, 'RIGHT', 'LEFT')

    expect(next.players.P2.head).toEqual(p(8, 12))
    expect(capturedBy(events, 'P1')?.cells).toHaveLength(POCKET_LOOP_TRAIL.length + 2)
    expect(next.board[9][5].territory).toBe('P1')
    expect(next.board[10][5].territory).toBe('P1')
    expect(next.board[0][0].territory).toBe('NONE')
    expect(next.board[12][10].territory).toBe('P2')
    expect(next.players.P2.trail).toEqual([p(8, 12)])
  })
})

// Карман (5,12),(5,13) слева от дома BLUE; BLUE замыкает его ходом UP в (6,13).
const LEFT_POCKET_TRAIL = [p(5, 11), p(4, 11), p(4, 12), p(4, 13), p(4, 14), p(5, 14), p(6, 14)]

function leftPocketGrid(row12: string, row13: string): string[] {
  const grid = emptyGrid()
  grid[1] = '......RRR......'
  grid[2] = '......RRR......'
  grid[3] = '......RRR......'
  grid[11] = '....bbBBB......'
  grid[12] = row12
  grid[13] = row13
  grid[14] = '....bb1........'
  return grid
}

function markBlueTerritory(state: ReturnType<typeof stateFromGrid>, cells: Pos[]) {
  for (const c of cells) state.board[c.y][c.x].territory = 'P1'
}

describe('T16 — engulfing the enemy trail', () => {
  it('kills RED when part of its trail is inside the captured area', () => {
    const state = stateFromGrid(leftPocketGrid('....brrrr2.....', '....bRBBB......'), {
      direction: { P1: 'RIGHT', P2: 'RIGHT' },
      trail: {
        P1: LEFT_POCKET_TRAIL,
        P2: [p(5, 12), p(6, 12), p(7, 12), p(8, 12), p(9, 12)],
      },
    })
    markBlueTerritory(state, [p(6, 12), p(7, 12), p(8, 12)])

    const { state: next, events } = play(state, 'UP', 'UP')

    expect(next.status).toBe('FINISHED')
    expect(next.result).toEqual({ winner: 'P1', reason: 'ENGULFED' })
    expect(next.players.P2.alive).toBe(false)
    expect(next.board[12][5].territory).toBe('P1')
    expect(next.board[13][5].territory).toBe('P1')
    expect(capturedBy(events, 'P1')?.stolenFromEnemy).toBe(1)
    const tail = events.slice(-2)
    expect(tail).toEqual([
      { type: 'DIED', player: 'P2', reason: 'ENGULFED', at: p(5, 12) },
      { type: 'GAME_OVER', winner: 'P1', reason: 'ENGULFED' },
    ])
  })
})

describe('T17 — simultaneous captures with an overlap', () => {
  it('keeps overlapping cells with the previous owner and applies the rest', () => {
    const state = stateFromGrid(leftPocketGrid('....brrrr2R....', '....bRBBB......'), {
      direction: { P1: 'RIGHT', P2: 'RIGHT' },
      trail: {
        P1: LEFT_POCKET_TRAIL,
        P2: [p(5, 12), p(6, 12), p(7, 12), p(8, 12), p(9, 12)],
      },
    })
    markBlueTerritory(state, [p(6, 12), p(7, 12), p(8, 12)])

    const { state: next, events } = play(state, 'UP', 'RIGHT')

    expect(next.status).toBe('PLAYING')
    expect(capturedBy(events, 'P1')).toBeDefined()
    expect(capturedBy(events, 'P2')).toBeDefined()
    // (5,12) — след RED внутри кармана BLUE, его захватывают оба
    expect(next.board[12][5]).toEqual({ territory: 'NONE', trail: 'NONE' })
    // остальное применяется
    expect(next.board[13][5].territory).toBe('P1')
    for (const x of [6, 7, 8, 9]) expect(next.board[12][x].territory).toBe('P2')
    expect(territorySize(next, 'P1')).toBe(9 - 3 + LEFT_POCKET_TRAIL.length + 1)
    expect(territorySize(next, 'P2')).toBe(14)
  })
})

describe('T18 — the cell under the enemy head never changes owner', () => {
  it('keeps RED home cell next to the closed contour', () => {
    const grid = pocketLoopGrid('..')
    const rows = rowsOf(grid)
    rows[9][3] = '2'
    rows[10][3] = 'R'
    rows[2][7] = 'R'
    const state = stateFromGrid(rows.map((r) => r.join('')), {
      direction: { P1: 'RIGHT', P2: 'DOWN' },
      headCellUnder: { P2: 'P2' },
      trail: { P1: POCKET_LOOP_TRAIL },
    })

    const { state: next, events } = play(state, 'RIGHT', 'DOWN')

    expect(capturedBy(events, 'P1')).toBeDefined()
    expect(next.players.P2.head).toEqual(p(3, 10))
    expect(next.board[10][3].territory).toBe('P2')
    expect(next.board[9][3].territory).toBe('P2')
  })
})

describe('T19 — territory reaches zero', () => {
  it('RED loses with NO_TERRITORY while alive and outside home', () => {
    const state = stateFromGrid(leftPocketGrid('....bRrrr2.....', '....bRBBB......'), {
      direction: { P1: 'RIGHT', P2: 'RIGHT' },
      trail: {
        P1: LEFT_POCKET_TRAIL,
        P2: [p(6, 12), p(7, 12), p(8, 12), p(9, 12)],
      },
    })
    // Убираем стартовый дом RED — у него только карман (5,12),(5,13).
    for (let y = 1; y <= 3; y++) for (let x = 6; x <= 8; x++) state.board[y][x].territory = 'NONE'
    markBlueTerritory(state, [p(6, 12), p(7, 12), p(8, 12)])
    expect(territorySize(state, 'P2')).toBe(2)

    const { state: next, events } = play(state, 'UP', 'UP')

    expect(territorySize(next, 'P2')).toBe(0)
    expect(next.status).toBe('FINISHED')
    expect(next.result).toEqual({ winner: 'P1', reason: 'NO_TERRITORY' })
    expect(events.slice(-2)).toEqual([
      { type: 'DIED', player: 'P2', reason: 'NO_TERRITORY', at: p(9, 11) },
      { type: 'GAME_OVER', winner: 'P1', reason: 'NO_TERRITORY' },
    ])
  })
})
