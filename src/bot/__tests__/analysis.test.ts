import { describe, it, expect } from 'vitest'
import { createInitialState } from '../../engine/state'
import {
  distanceHome,
  distanceToTrail,
  isDeadEnd,
  movesAvoidingOwnTrail,
  potentialCapture,
} from '../analysis'
import { emptyGrid, mergeFragment, startGrid, stateFromGrid } from '../../engine/__tests__/testHelpers'
import type { Pos } from '../../engine/types'

const p = (x: number, y: number): Pos => ({ x, y })

// BLUE вышел из (7,11) прямо вверх: след (7,10),(7,9), голова (7,9), direction UP.
function straightOutState() {
  const grid = startGrid()
  grid[12] = '......BBB......'
  grid[10] = '.......b.......'
  grid[9] = '.......1.......'
  return stateFromGrid(grid, {
    direction: { P1: 'UP', P2: 'DOWN' },
    headCellUnder: { P2: 'P2' },
    trail: { P1: [p(7, 10), p(7, 9)] },
  })
}

describe('distanceHome', () => {
  it('is 0 when the head is on own territory', () => {
    const state = createInitialState()
    expect(distanceHome(state, 'P1')).toBe(0)
    expect(distanceHome(state, 'P2')).toBe(0)
  })

  it('cannot reverse on the first step and cannot cross own trail', () => {
    // Прямо назад нельзя (разворот + свой след) → обход (6,9)→(6,10)→(6,11).
    expect(distanceHome(straightOutState(), 'P1')).toBe(3)
  })

  it('is Infinity when the head is walled in by its own trail', () => {
    const grid = emptyGrid()
    grid[0] = '1b.............'
    grid[1] = 'bb.............'
    grid[5] = '.......2.......'
    grid[12] = '......BBB......'
    const state = stateFromGrid(grid, {
      direction: { P1: 'LEFT', P2: 'DOWN' },
      trail: { P1: [p(0, 1), p(1, 1), p(1, 0), p(0, 0)] },
    })
    expect(distanceHome(state, 'P1')).toBe(Infinity)
  })
})

describe('distanceToTrail', () => {
  it('is Infinity when the victim has no trail', () => {
    expect(distanceToTrail(createInitialState(), 'P2', 'P1')).toBe(Infinity)
  })

  it('counts moves to the nearest trail cell', () => {
    const state = straightOutState()
    state.players.P2.head = p(3, 9)
    state.players.P2.direction = 'RIGHT'
    // (4,9),(5,9),(6,9) → (7,9)? (7,9) — след BLUE: 4 хода
    expect(distanceToTrail(state, 'P2', 'P1')).toBe(4)
  })

  it('respects the no-reversal rule on the first step', () => {
    const grid = emptyGrid()
    grid[5] = '....b2.........'
    grid[12] = '......BBB......'
    grid[13] = '.......1.......'
    const state = stateFromGrid(grid, {
      direction: { P1: 'UP', P2: 'RIGHT' },
      headCellUnder: { P1: 'P1' },
      trail: { P1: [p(4, 5)] },
    })
    // След прямо позади RED: назад нельзя → (5,4)→(4,4)→(4,5)
    expect(distanceToTrail(state, 'P2', 'P1')).toBe(3)
  })
})

describe('potentialCapture', () => {
  it('is 0 at home', () => {
    expect(potentialCapture(createInitialState(), 'P1')).toBe(0)
  })

  it('equals the T04 capture one step before closing', () => {
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
    expect(potentialCapture(state, 'P1')).toBe(7)
  })

  it('counts only the trail while the loop is still open', () => {
    expect(potentialCapture(straightOutState(), 'P1')).toBe(2)
  })
})

describe('movesAvoidingOwnTrail / isDeadEnd', () => {
  // Крючок: след (7,10),(7,9),(8,9),(8,10), голова (8,10), direction DOWN.
  function hookState() {
    const grid = startGrid()
    grid[12] = '......BBB......'
    grid[9] = '.......bb......'
    grid[10] = '.......b1......'
    return stateFromGrid(grid, {
      direction: { P1: 'DOWN', P2: 'DOWN' },
      headCellUnder: { P2: 'P2' },
      trail: { P1: [p(7, 10), p(7, 9), p(8, 9), p(8, 10)] },
    })
  }

  it('drops moves onto own trail', () => {
    expect(movesAvoidingOwnTrail(hookState(), 'P1')).toEqual(['DOWN', 'RIGHT'])
  })

  it('returning home is never a dead end', () => {
    expect(isDeadEnd(hookState(), 'P1', 'DOWN')).toBe(false)
  })

  it('detects a pocket with no exit except own trail', () => {
    // Голова (1,1) идёт UP в (1,0): соседи (0,0) и (2,0) — свой след, дальше некуда.
    const grid = emptyGrid()
    grid[0] = 'b.b............'
    grid[1] = 'b1b............'
    grid[2] = 'bbb............'
    grid[5] = '.......2.......'
    grid[12] = '......BBB......'
    // isDeadEnd смотрит только на слой trail доски, поэтому список следа не задаём.
    const state = stateFromGrid(grid, { direction: { P1: 'UP', P2: 'DOWN' } })
    expect(isDeadEnd(state, 'P1', 'UP')).toBe(true)
    expect(isDeadEnd(hookState(), 'P1', 'RIGHT')).toBe(false)
  })
})
