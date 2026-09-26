import { describe, it, expect } from 'vitest'
import { describeEnd } from '../endText'
import { resolveRound } from '../../engine/resolve'
import { emptyGrid, mergeFragment, stateFromGrid } from '../../engine/__tests__/testHelpers'

describe('describeEnd', () => {
  it('RED cutting the human trail', () => {
    const grid = mergeFragment(emptyGrid(), ['.bbbb1.', '..2....'], 3, 6)
    const state = stateFromGrid(grid, {
      direction: { P1: 'RIGHT', P2: 'UP' },
      trail: { P1: [{ x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 8, y: 6 }] },
    })
    const { state: end, events } = resolveRound(state, 'UP', 'UP')
    expect(describeEnd(end, events)).toEqual({
      title: 'RED WINS',
      reason: 'RED cut your trail',
      highlight: [{ x: 5, y: 6 }],
    })
  })

  it('head-on where RED defends its home', () => {
    const grid = emptyGrid()
    grid[5] = '.....1R2.......'
    const state = stateFromGrid(grid, { direction: { P1: 'UP', P2: 'UP' } })
    const { state: end, events } = resolveRound(state, 'RIGHT', 'LEFT')
    expect(describeEnd(end, events).reason).toBe('Head-on! RED was at home')
  })

  it('head-on decided by territory, and a head-on draw', () => {
    const red = '......RRRRR....'
    const blue = '......BBBBB....'
    const grid = emptyGrid()
    grid[1] = red
    grid[10] = blue
    grid[11] = blue
    grid[5] = '.....12........'
    const bigger = stateFromGrid(grid, { direction: { P1: 'DOWN', P2: 'DOWN' } })
    const won = resolveRound(bigger, 'RIGHT', 'LEFT')
    expect(describeEnd(won.state, won.events)).toMatchObject({
      title: 'YOU WIN',
      reason: 'Head-on! Bigger territory wins',
    })

    grid[11] = '...............'
    const equal = stateFromGrid(grid, { direction: { P1: 'DOWN', P2: 'DOWN' } })
    const drawn = resolveRound(equal, 'RIGHT', 'LEFT')
    expect(describeEnd(drawn.state, drawn.events)).toMatchObject({ title: 'DRAW', reason: 'Head-on draw' })
  })

  it('round limit reports both cell counts', () => {
    const grid = emptyGrid()
    grid[4] = '.BBBBB...RRRRR.'
    grid[5] = '.BB1BB...RR2RR.'
    const state = stateFromGrid(grid, {
      round: 99,
      direction: { P1: 'RIGHT', P2: 'RIGHT' },
      headCellUnder: { P1: 'P1', P2: 'P2' },
    })
    const { state: end, events } = resolveRound(state, 'RIGHT', 'RIGHT')
    expect(describeEnd(end, events)).toEqual({
      title: 'DRAW',
      reason: "Time's up — 10 vs 10 cells",
      highlight: [],
    })
  })
})
