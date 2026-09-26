import { describe, it, expect } from 'vitest'
import { describeRound, eventLines } from '../roundText'
import type { GameEvent } from '../../engine/types'

const cells = (n: number) => Array.from({ length: n }, (_, x) => ({ x, y: 0 }))

describe('describeRound', () => {
  it('is empty when nothing notable happened', () => {
    expect(describeRound([{ type: 'MOVED', player: 'P2', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }])).toEqual([])
  })

  it('describes captures from the human point of view', () => {
    const events: GameEvent[] = [
      { type: 'CAPTURED', player: 'P1', cells: cells(4), stolenFromEnemy: 2 },
      { type: 'CAPTURED', player: 'P2', cells: cells(6), stolenFromEnemy: 0 },
    ]
    expect(describeRound(events)).toEqual(['You captured 4 cells (2 from RED)', 'RED captured 6 cells'])
  })

  it('reports RED leaving home but not the human', () => {
    const events: GameEvent[] = [
      { type: 'TRAIL_STARTED', player: 'P1' },
      { type: 'TRAIL_STARTED', player: 'P2' },
    ]
    expect(describeRound(events)).toEqual(['RED left home'])
  })

  it('uses the singular for one cell', () => {
    expect(describeRound([{ type: 'CAPTURED', player: 'P2', cells: cells(1), stolenFromEnemy: 1 }])).toEqual([
      'RED captured 1 cell (1 from you)',
    ])
  })
})

describe('eventLines', () => {
  it('shows at most one event', () => {
    expect(eventLines(['RED left home', 'RED captured 6 cells'], false)).toEqual(['RED captured 6 cells'])
  })

  it('puts the danger warning first, then one event', () => {
    expect(eventLines(['RED left home'], true)).toEqual(['Your trail is in danger', 'RED left home'])
    expect(eventLines([], true)).toEqual(['Your trail is in danger'])
    expect(eventLines([], false)).toEqual([])
  })
})
