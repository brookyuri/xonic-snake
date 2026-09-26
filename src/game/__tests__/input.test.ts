import { describe, it, expect } from 'vitest'
import { enqueueDirection, straightOrClockwise, takeHumanMove } from '../input'
import { createInitialState } from '../../engine/state'
import { emptyGrid, stateFromGrid } from '../../engine/__tests__/testHelpers'
import type { Direction } from '../../engine/types'

function press(current: Direction, ...keys: Direction[]): Direction[] {
  return keys.reduce<Direction[]>((q, k) => enqueueDirection(q, current, k), [])
}

describe('input queue (5.1.1)', () => {
  it('rule example: going UP, RIGHT then DOWN are both kept', () => {
    expect(press('UP', 'RIGHT', 'DOWN')).toEqual(['RIGHT', 'DOWN'])
  })

  it('ignores a press equal to the current direction or the last queued one', () => {
    expect(press('UP', 'UP')).toEqual([])
    expect(press('UP', 'RIGHT', 'RIGHT')).toEqual(['RIGHT'])
  })

  it('ignores a reversal of the current direction or of the last queued one', () => {
    expect(press('UP', 'DOWN')).toEqual([])
    expect(press('UP', 'RIGHT', 'LEFT')).toEqual(['RIGHT'])
  })

  it('keeps at most two presses', () => {
    expect(press('UP', 'RIGHT', 'DOWN', 'LEFT')).toEqual(['RIGHT', 'DOWN'])
  })

  it('does not mutate the queue', () => {
    const queue: Direction[] = ['RIGHT']
    enqueueDirection(queue, 'UP', 'DOWN')
    expect(queue).toEqual(['RIGHT'])
  })
})

describe('move selection (5.1)', () => {
  function atTopEdge(x: number) {
    const grid = emptyGrid()
    grid[0] = '.'.repeat(x) + '1' + '.'.repeat(14 - x)
    grid[7] = '.......2.......'
    return stateFromGrid(grid, { direction: { P1: 'UP', P2: 'DOWN' } })
  }

  it('goes straight when nothing is queued', () => {
    expect(takeHumanMove(createInitialState(), 'P1', [])).toEqual({ move: 'UP', queue: [] })
  })

  it('turns clockwise at a wall: UP into the top edge → RIGHT', () => {
    expect(straightOrClockwise(atTopEdge(7), 'P1')).toBe('RIGHT')
  })

  it('in the top-right corner clockwise skips the wall and the reversal → LEFT', () => {
    expect(straightOrClockwise(atTopEdge(14), 'P1')).toBe('LEFT')
  })

  it('takes one queued direction per tick', () => {
    expect(takeHumanMove(createInitialState(), 'P1', ['RIGHT', 'DOWN'])).toEqual({
      move: 'RIGHT',
      queue: ['DOWN'],
    })
  })

  it('a queued move into the wall is consumed and replaced by the wall rule', () => {
    const state = atTopEdge(0)
    state.players.P1.direction = 'RIGHT'
    // Нажато UP у верхней стены: ход недопустим → едем прямо (RIGHT).
    expect(takeHumanMove(state, 'P1', ['UP'])).toEqual({ move: 'RIGHT', queue: [] })
  })
})
