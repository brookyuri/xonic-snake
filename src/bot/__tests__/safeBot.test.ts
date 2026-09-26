import { describe, it, expect } from 'vitest'
import { safeBot } from '../safeBot'
import { mulberry32 } from '../rng'
import { emptyGrid, startGrid, stateFromGrid } from '../../engine/__tests__/testHelpers'
import type { Direction, Pos } from '../../engine/types'

const p = (x: number, y: number): Pos => ({ x, y })

function movesOver(seeds: number, fn: (rng: () => number) => Direction): Set<Direction> {
  const seen = new Set<Direction>()
  for (let s = 1; s <= seeds; s++) seen.add(fn(mulberry32(s)))
  return seen
}

describe('safeBot', () => {
  it('never steps onto its own trail when it has another move', () => {
    const grid = startGrid()
    grid[12] = '......BBB......'
    grid[9] = '.......bb......'
    grid[10] = '.......b1......'
    const state = stateFromGrid(grid, {
      direction: { P1: 'DOWN', P2: 'DOWN' },
      headCellUnder: { P2: 'P2' },
      trail: { P1: [p(7, 10), p(7, 9), p(8, 9), p(8, 10)] },
    })
    const seen = movesOver(50, (rng) => safeBot(state, 'P1', rng))
    expect(seen).not.toContain('LEFT')
    expect(seen).toEqual(new Set(['DOWN', 'RIGHT']))
  })

  it('avoids a dead-end pocket when an alternative exists', () => {
    // Голова (1,1), direction UP: LEFT — свой след, UP ведёт в тупик (1,0), RIGHT открыт.
    const grid = emptyGrid()
    grid[0] = 'b.b............'
    grid[1] = 'b1.............'
    grid[2] = 'bbb............'
    grid[5] = '.......2.......'
    grid[12] = '......BBB......'
    const state = stateFromGrid(grid, { direction: { P1: 'UP', P2: 'DOWN' } })
    const seen = movesOver(50, (rng) => safeBot(state, 'P1', rng))
    expect(seen).toEqual(new Set(['RIGHT']))
  })
})
