import { describe, it, expect } from 'vitest'
import { createInitialState } from '../state'
import { resolveRound } from '../resolve'
import { assertInvariants } from '../invariants'
import { MAX_ROUNDS } from '../constants'
import type { Reason } from '../types'
import { randomBot } from '../../bot/randomBot'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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
        const moveP1 = randomBot(state, rng, 'P1')
        const moveP2 = randomBot(state, rng, 'P2')
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
