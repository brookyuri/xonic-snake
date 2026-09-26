import { describe, it, expect } from 'vitest'
import { createInitialState } from '../state'
import { getLegalMoves } from '../moves'
import { resolveRound } from '../resolve'
import { stateFromGrid, emptyGrid } from './testHelpers'

describe('T02 — reversal is illegal', () => {
  it('excludes the opposite of the current direction', () => {
    const state = createInitialState()
    expect(state.players.P1.direction).toBe('UP')
    expect(getLegalMoves(state, 'P1')).not.toContain('DOWN')
  })

  it('resolveRound throws on an illegal reversal', () => {
    const state = createInitialState()
    expect(() => resolveRound(state, 'DOWN', 'DOWN')).toThrow()
  })
})

describe('T03 — wall blocks movement', () => {
  it('excludes moves that leave the board, keeps reversal excluded too', () => {
    const grid = emptyGrid()
    const rows = grid.map((r) => r.split(''))
    rows[14][3] = '1' // P1 head at (3,14), bottom row
    rows[2][7] = '2' // P2 head at default start
    const state = stateFromGrid(
      rows.map((r) => r.join('')),
      { direction: { P1: 'LEFT', P2: 'DOWN' } }
    )

    expect(getLegalMoves(state, 'P1')).toEqual(['UP', 'LEFT'])
  })
})
