import { describe, it, expect } from 'vitest'
import { computeCapture } from '../capture'
import type { Cell } from '../types'

/** '#' земля P1, 't' след P1, '.' пусто. */
function board(rows: string[]): Cell[][] {
  return rows.map((row) =>
    [...row].map((ch) => ({ territory: ch === '#' ? 'P1' : 'NONE', trail: ch === 't' ? 'P1' : 'NONE' }) as Cell)
  )
}

// Контур из следа делит пустое место на три кармана: A (слева), B (в центре), C (справа).
const ROWS = [
  '#######',
  '#.t.t.#',
  '#.t.t.#',
  '#######',
]
const key = (p: { x: number; y: number }) => `${p.x},${p.y}`

describe('computeCapture(board, player, excludedCells)', () => {
  it('excludes every component that contains an excluded cell', () => {
    const got = computeCapture(board(ROWS), 'P1', [{ x: 1, y: 1 }, { x: 5, y: 2 }]).map(key).sort()
    // след (4) + центральный карман B (2)
    expect(got).toEqual(['2,1', '2,2', '3,1', '3,2', '4,1', '4,2'])
  })

  it('captures only the trail when every component is excluded', () => {
    const got = computeCapture(board(ROWS), 'P1', [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 }]).map(key).sort()
    expect(got).toEqual(['2,1', '2,2', '4,1', '4,2'])
  })

  it('takes every component when nothing is excluded and no fallback is asked for', () => {
    expect(computeCapture(board(ROWS), 'P1', [])).toHaveLength(10)
  })

  it('Duel fallback: excluded cell on own land drops the largest component', () => {
    const rows = ['######', '#.t..#', '#.t..#', '######']
    const got = computeCapture(board(rows), 'P1', [{ x: 0, y: 0 }], { excludeLargestIfNoneFound: true })
    expect(got.map(key).sort()).toEqual(['1,1', '1,2', '2,1', '2,2'])
  })
})
