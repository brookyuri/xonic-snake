import { describe, it, expect } from 'vitest'
import { createInitialState } from '../../engine/state'
import { resolveRound } from '../../engine/resolve'
import { getLegalMoves } from '../../engine/moves'
import { continueSolo, createSoloState, resolveSoloTick, type SoloState } from '../../engine/solo'
import type { GameState } from '../../engine/types'
import { snapshotFromDuel, snapshotFromSolo, staticSnapshot } from '../adapters'
import { frameGrid, put, soloFromGrid } from '../../engine/solo/__tests__/soloHelpers'

/** Duel: оба игрока идут прямо, если можно, иначе — первый допустимый ход. */
function stepDuel(state: GameState) {
  const pick = (id: 'P1' | 'P2') => {
    const legal = getLegalMoves(state, id)
    return legal.includes(state.players[id].direction) ? state.players[id].direction : legal[0]
  }
  return resolveRound(state, pick('P1'), pick('P2'))
}

describe('snapshotFromDuel', () => {
  it('start: 15×15, BLUE then RED, at home, not moving, no balls', () => {
    const state = createInitialState()
    const snap = snapshotFromDuel(state)
    expect(snap.variant).toBe('duel')
    expect(snap.cols).toBe(15)
    expect(snap.rows).toBe(15)
    expect(snap.board).toBe(state.board)
    expect(snap.snakes.map((s) => s.id)).toEqual(['P1', 'P2'])
    for (const s of snap.snakes) {
      expect(s.trail).toEqual([])
      expect(s.prevHead).toEqual(s.head)
    }
    expect(snap.balls).toEqual([])
  })

  it('after a tick: prevHead is where MOVED came from, trail in order', () => {
    let state = createInitialState()
    let events = stepDuel(state).events
    for (let i = 0; i < 3; i++) {
      const before = state
      const r = stepDuel(state)
      state = r.state
      events = r.events
      const snap = snapshotFromDuel(state, events)
      for (const s of snap.snakes) {
        expect(s.prevHead).toEqual(before.players[s.id].head)
        expect(s.head).toEqual(state.players[s.id].head)
        expect(s.trail).toBe(state.players[s.id].trail)
        expect(s.direction).toBe(state.players[s.id].direction)
      }
    }
  })

  it('stale MOVED (does not lead to the head) is ignored — no interpolation across the board', () => {
    const state = createInitialState()
    const head = state.players.P1.head
    const snap = snapshotFromDuel(state, [
      { type: 'MOVED', player: 'P1', from: { x: 0, y: 0 }, to: { x: head.x + 5, y: head.y } },
    ])
    expect(snap.snakes[0].prevHead).toEqual(head)
  })
})

describe('snapshotFromSolo', () => {
  it('level start: 20×20, snake at (9,19), balls not moving', () => {
    const state = createSoloState({ seed: 7 })
    const snap = snapshotFromSolo(state)
    expect(snap.variant).toBe('solo')
    expect(snap.cols).toBe(20)
    expect(snap.snakes).toHaveLength(1)
    expect(snap.snakes[0].head).toEqual({ x: 9, y: 19 })
    expect(snap.snakes[0].prevHead).toEqual({ x: 9, y: 19 })
    expect(snap.balls.map((b) => b.pos)).toEqual(state.balls.map((b) => b.pos))
    for (const b of snap.balls) expect(b.prev).toEqual(b.pos)
  })

  it('after a tick: head and balls come from their previous cells', () => {
    const state = createSoloState({ seed: 7 })
    const r = resolveSoloTick(state, 'UP')
    const snap = snapshotFromSolo(r.state, r.events)
    expect(snap.snakes[0].prevHead).toEqual({ x: 9, y: 19 })
    expect(snap.snakes[0].head).toEqual({ x: 9, y: 18 })
    expect(snap.snakes[0].trail).toEqual([{ x: 9, y: 18 }])
    snap.balls.forEach((b, i) => {
      expect(b.prev).toEqual(state.balls[i].pos)
      expect(b.pos).toEqual(r.state.balls[i].pos)
    })
  })

  it('respawn after a lost life: the old MOVED does not drag the head across the board', () => {
    // Голова (9,17) идёт вверх, шарик (10,17) летит вниз-влево в след (9,18) — удар.
    const state: SoloState = soloFromGrid(put(frameGrid(), 9, 17, ['1o', 't ']), { vel: [[-1, 1]], direction: 'UP' })
    const r = resolveSoloTick(state, 'UP')
    expect(r.state.status).toBe('LIFE_LOST')
    const respawned = continueSolo(r.state)
    const snap = snapshotFromSolo(respawned, r.events)
    expect(snap.snakes[0].prevHead).toEqual(respawned.player.head)
    expect(snap.snakes[0].trail).toEqual([])
  })
})

describe('staticSnapshot', () => {
  it('diagram: heads and balls without movement', () => {
    const board = [[{ territory: 'P1', trail: 'NONE' }, { territory: 'NONE', trail: 'NONE' }]] as const
    const snap = staticSnapshot('solo', board, [{ id: 'P1', pos: { x: 0, y: 0 }, direction: 'RIGHT' }], [{ x: 1, y: 0 }])
    expect(snap.cols).toBe(2)
    expect(snap.rows).toBe(1)
    expect(snap.snakes[0]).toMatchObject({ head: { x: 0, y: 0 }, prevHead: { x: 0, y: 0 }, trail: [] })
    expect(snap.balls).toEqual([{ pos: { x: 1, y: 0 }, prev: { x: 1, y: 0 } }])
  })
})
