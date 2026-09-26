import { describe, it, expect } from 'vitest'
import { createInitialState } from '../state'
import { resolveRound } from '../resolve'
import { assertInvariants } from '../invariants'
import { MAX_ROUNDS } from '../constants'
import type { Reason } from '../types'
import { randomBot } from '../../bot/randomBot'
import { mulberry32 } from '../../bot/rng'

const GAMES = 2000
const SEED = 20260926

describe('stress: randomBot vs randomBot', () => {
  it(`plays ${GAMES} games without invariant violations`, () => {
    const rng = mulberry32(SEED)
    const reasons: Partial<Record<Reason, number>> = {}
    let totalRounds = 0
    let captures = 0
    let capturedCells = 0

    for (let game = 0; game < GAMES; game++) {
      let state = createInitialState()
      let rounds = 0
      while (state.status === 'PLAYING') {
        const moveP1 = randomBot(state, 'P1', rng)
        const moveP2 = randomBot(state, 'P2', rng)
        const result = resolveRound(state, moveP1, moveP2)
        rounds++
        try {
          assertInvariants(result.state)
        } catch (error) {
          throw new Error(
            `game ${game}, round ${rounds}, moves ${moveP1}/${moveP2}: ${(error as Error).message}\n` +
              JSON.stringify(state)
          )
        }
        for (const event of result.events) {
          if (event.type === 'CAPTURED') {
            captures++
            capturedCells += event.cells.length
          }
        }
        state = result.state
        // I8: игра заканчивается не позже раунда 100
        expect(rounds).toBeLessThanOrEqual(MAX_ROUNDS)
      }
      const reason = state.result!.reason
      reasons[reason] = (reasons[reason] ?? 0) + 1
      totalRounds += rounds
    }

    const distribution = Object.entries(reasons)
      .sort((a, b) => b[1] - a[1])
      .map(([r, n]) => `${r} ${n} (${((n / GAMES) * 100).toFixed(1)}%)`)
      .join(', ')
    console.log(
      [
        `stress: ${GAMES} games, seed ${SEED}`,
        `reasons: ${distribution}`,
        `avg length: ${(totalRounds / GAMES).toFixed(1)} rounds`,
        `avg capture: ${(capturedCells / Math.max(1, captures)).toFixed(2)} cells over ${captures} captures`,
      ].join('\n')
    )
  })
})
