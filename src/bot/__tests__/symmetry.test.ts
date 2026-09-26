import { describe, it, expect } from 'vitest'
import { createInitialState } from '../../engine/state'
import { resolveRound } from '../../engine/resolve'
import { BOARD_SIZE } from '../../engine/constants'
import type { Direction, GameState, Owner, Player, PlayerId } from '../../engine/types'
import { explainMove } from '../normalBot'
import { safeBot } from '../safeBot'
import { mulberry32 } from '../rng'

const FLIP_DIR: Record<Direction, Direction> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'LEFT', RIGHT: 'RIGHT' }
const SWAP: Record<Owner, Owner> = { NONE: 'NONE', P1: 'P2', P2: 'P1' }
const flipY = (y: number) => BOARD_SIZE - 1 - y

/** Отражение по вертикали со сменой ролей: P1 становится P2 и наоборот. */
function mirror(state: GameState): GameState {
  const flipPlayer = (p: Player, id: PlayerId): Player => ({
    id,
    head: { x: p.head.x, y: flipY(p.head.y) },
    direction: FLIP_DIR[p.direction],
    trail: p.trail.map((c) => ({ x: c.x, y: flipY(c.y) })),
    alive: p.alive,
  })
  return {
    board: state.board
      .map((row) => row.map((c) => ({ territory: SWAP[c.territory], trail: SWAP[c.trail] })))
      .reverse(),
    players: { P1: flipPlayer(state.players.P2, 'P1'), P2: flipPlayer(state.players.P1, 'P2') },
    round: state.round,
    status: state.status,
  }
}

function scores(state: GameState, player: PlayerId, flip: boolean) {
  const out: Record<string, number> = {}
  for (const m of explainMove(state, player)) out[flip ? FLIP_DIR[m.move] : m.move] = m.score
  return out
}

describe('normalBot side symmetry', () => {
  it('a mirrored position gets mirrored move scores for P1 and P2', () => {
    const rng = mulberry32(42)
    let state = createInitialState()
    let checked = 0
    while (state.status === 'PLAYING' && state.round < 60) {
      for (const player of ['P1', 'P2'] as const) {
        const other: PlayerId = player === 'P1' ? 'P2' : 'P1'
        const direct = scores(state, player, false)
        const mirrored = scores(mirror(state), other, true)
        expect(Object.keys(mirrored).sort()).toEqual(Object.keys(direct).sort())
        for (const move of Object.keys(direct)) expect(mirrored[move]).toBeCloseTo(direct[move], 9)
        checked++
      }
      state = resolveRound(state, safeBot(state, 'P1', rng), safeBot(state, 'P2', rng)).state
    }
    expect(checked).toBeGreaterThan(20)
  })
})
