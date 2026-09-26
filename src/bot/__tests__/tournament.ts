import { createInitialState } from '../../engine/state'
import { resolveRound } from '../../engine/resolve'
import { assertInvariants } from '../../engine/invariants'
import { MAX_ROUNDS } from '../../engine/constants'
import type { GameState, PlayerId, Reason } from '../../engine/types'
import { mulberry32 } from '../rng'
import type { Bot } from '../types'

export interface MatchStats {
  name: string
  games: number
  wins: number
  losses: number
  draws: number
  reasons: Partial<Record<Reason, number>>
  totalRounds: number
  captures: number
  capturedCells: number
  winnerTerritory: number
  decisive: number
}

function territorySize(state: GameState, player: PlayerId): number {
  let count = 0
  for (const row of state.board) for (const cell of row) if (cell.territory === player) count++
  return count
}

/** Бот A против бота B; стороны чередуются — A играет за P1 в чётных партиях. */
export function playMatch(name: string, a: Bot, b: Bot, games: number, seed: number): MatchStats {
  const rng = mulberry32(seed)
  const stats: MatchStats = {
    name,
    games,
    wins: 0,
    losses: 0,
    draws: 0,
    reasons: {},
    totalRounds: 0,
    captures: 0,
    capturedCells: 0,
    winnerTerritory: 0,
    decisive: 0,
  }

  for (let game = 0; game < games; game++) {
    const aSide: PlayerId = game % 2 === 0 ? 'P1' : 'P2'
    const bots: Record<PlayerId, Bot> = aSide === 'P1' ? { P1: a, P2: b } : { P1: b, P2: a }
    let state = createInitialState()
    let rounds = 0

    while (state.status === 'PLAYING') {
      const moveP1 = bots.P1(state, 'P1', rng)
      const moveP2 = bots.P2(state, 'P2', rng)
      const result = resolveRound(state, moveP1, moveP2)
      assertInvariants(result.state)
      for (const e of result.events) {
        if (e.type === 'CAPTURED') {
          stats.captures++
          stats.capturedCells += e.cells.length
        }
      }
      state = result.state
      rounds++
      if (rounds > MAX_ROUNDS) throw new Error(`${name}: game ${game} exceeded ${MAX_ROUNDS} rounds`)
    }

    const { winner, reason } = state.result!
    stats.reasons[reason] = (stats.reasons[reason] ?? 0) + 1
    stats.totalRounds += rounds
    if (winner === 'DRAW') stats.draws++
    else {
      if (winner === aSide) stats.wins++
      else stats.losses++
      stats.decisive++
      stats.winnerTerritory += territorySize(state, winner)
    }
  }
  return stats
}

export const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`

export function report(s: MatchStats): string {
  const reasons = Object.entries(s.reasons)
    .sort((x, y) => y[1] - x[1])
    .map(([r, n]) => `${r} ${pct(n, s.games)}`)
    .join(', ')
  return [
    `| ${s.name} | ${s.games} | ${pct(s.wins, s.games)} | ${pct(s.losses, s.games)} | ${pct(s.draws, s.games)}` +
      ` | ${(s.totalRounds / s.games).toFixed(1)} | ${(s.capturedCells / Math.max(1, s.captures)).toFixed(2)}` +
      ` | ${(s.winnerTerritory / Math.max(1, s.decisive)).toFixed(1)} |`,
    `  reasons: ${reasons}`,
  ].join('\n')
}
