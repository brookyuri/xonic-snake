import { describe, it, expect } from 'vitest'
import { easyBot } from '../easyBot'
import { EASY_CONFIG, NORMAL_CONFIG } from '../normalBot'
import { safeBot } from '../safeBot'
import { mulberry32 } from '../rng'
import { createInitialState } from '../../engine/state'
import { getLegalMoves } from '../../engine/moves'
import { resolveRound } from '../../engine/resolve'
import { emptyGrid, startGrid, stateFromGrid } from '../../engine/__tests__/testHelpers'
import type { Pos } from '../../engine/types'

const p = (x: number, y: number): Pos => ({ x, y })

describe('EASY_CONFIG', () => {
  it('is normal with lower caution and half the attack', () => {
    expect(EASY_CONFIG.MINMAX_WEIGHT).toBe(0.4)
    expect(EASY_CONFIG.ATTACK).toBe(NORMAL_CONFIG.ATTACK / 2)
    expect(EASY_CONFIG.REACTION_TICKS).toBe(2)
    expect(EASY_CONFIG.MISTAKE_RATE).toBe(0.2)
  })
})

describe('easyBot', () => {
  it('between reaction ticks it keeps going straight', () => {
    const state = createInitialState()
    state.round = 1
    for (let seed = 1; seed <= 20; seed++) expect(easyBot(state, 'P2', mulberry32(seed))).toBe('DOWN')
  })

  it('between reaction ticks it still thinks when straight is a wall', () => {
    const grid = emptyGrid()
    grid[0] = '.......2.......'
    grid[12] = '......B1B......'
    const state = stateFromGrid(grid, { round: 1, direction: { P1: 'UP', P2: 'UP' }, headCellUnder: { P1: 'P1' } })
    for (let seed = 1; seed <= 20; seed++) expect(['LEFT', 'RIGHT']).toContain(easyBot(state, 'P2', mulberry32(seed)))
  })

  it('between reaction ticks it never drives straight into its own trail', () => {
    // Крючок RED: прямо (DOWN) — его же след.
    const grid = startGrid()
    grid[2] = '......RRR......'
    grid[6] = '.......rr......'
    grid[5] = '.......2r......'
    const state = stateFromGrid(grid, {
      round: 1,
      direction: { P1: 'UP', P2: 'LEFT' },
      headCellUnder: { P1: 'P1' },
      trail: { P2: [p(7, 6), p(8, 6), p(8, 5), p(7, 5)] },
    })
    // Условно едем DOWN: прямо — (7,6), свой след; RIGHT — тоже след; безопасен только LEFT.
    state.players.P2.direction = 'DOWN'
    for (let seed = 1; seed <= 20; seed++) expect(easyBot(state, 'P2', mulberry32(seed))).toBe('LEFT')
  })

  it('only ever returns legal moves', () => {
    const rng = mulberry32(3)
    for (let game = 0; game < 20; game++) {
      let state = createInitialState()
      while (state.status === 'PLAYING') {
        const move = easyBot(state, 'P2', rng)
        expect(getLegalMoves(state, 'P2')).toContain(move)
        state = resolveRound(state, safeBot(state, 'P1', rng), move).state
      }
    }
  })
})
