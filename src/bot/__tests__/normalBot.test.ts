import { describe, it, expect } from 'vitest'
import { normalBot, explainMove } from '../normalBot'
import { mulberry32 } from '../rng'
import { mergeFragment, startGrid, stateFromGrid } from '../../engine/__tests__/testHelpers'
import type { Pos } from '../../engine/types'

const p = (x: number, y: number): Pos => ({ x, y })

describe('normalBot', () => {
  it('cuts an adjacent enemy trail (attack)', () => {
    // BLUE вышел вверх: след (7,10),(7,9). RED стоит рядом на (6,10).
    const grid = startGrid()
    grid[2] = '......RRR......'
    grid[12] = '......BBB......'
    grid[10] = '......2b.......'
    grid[9] = '.......1.......'
    const state = stateFromGrid(grid, {
      direction: { P1: 'UP', P2: 'UP' },
      trail: { P1: [p(7, 10), p(7, 9)], P2: [p(6, 10)] },
    })
    expect(normalBot(state, 'P2', mulberry32(1))).toBe('RIGHT')
    expect(explainMove(state, 'P2')[0].min).toBe(10_000)
  })

  it('closes the T04 loop instead of extending it (capture)', () => {
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
    expect(normalBot(state, 'P1', mulberry32(1))).toBe('LEFT')
  })

  it('returns home when the enemy can reach the trail first (threat)', () => {
    // BLUE: выход (8,11)→(9,11)→(9,12), домой — LEFT в (8,12). RED в двух шагах от следа.
    const grid = startGrid()
    grid[12] = '......BBB1.....'
    grid[11] = '......BBBb.....'
    grid[10] = '..........2....'
    grid[2] = '......RRR......'
    const state = stateFromGrid(grid, {
      direction: { P1: 'DOWN', P2: 'DOWN' },
      trail: { P1: [p(9, 11), p(9, 12)], P2: [p(10, 10)] },
    })
    expect(normalBot(state, 'P1', mulberry32(1))).toBe('LEFT')
  })

  it('never reads the opponent move: same state gives the same choice for a fixed rng', () => {
    const state = startGrid()
    const s = stateFromGrid(state, { headCellUnder: { P1: 'P1', P2: 'P2' } })
    expect(normalBot(s, 'P2', mulberry32(7))).toBe(normalBot(s, 'P2', mulberry32(7)))
  })
})
