import { describe, it, expect } from 'vitest'
import { describeSoloTick, levelIntro, progressLabel, soloEndReason } from '../soloText'
import { loadSettings } from '../settings'
import type { SoloEvent } from '../../engine/solo'

const cells = (n: number) => Array.from({ length: n }, (_, x) => ({ x, y: 1 }))

describe('Solo event line', () => {
  it('captures and hits', () => {
    const events: SoloEvent[] = [
      { type: 'CAPTURED', cells: cells(36), points: 36 },
      { type: 'LIFE_LOST', reason: 'BALL_HIT', at: { x: 1, y: 1 }, livesLeft: 2 },
    ]
    expect(describeSoloTick(events)).toEqual(['+36 cells', 'Ball hit!'])
    expect(describeSoloTick([{ type: 'CAPTURED', cells: cells(1), points: 1 }])).toEqual(['+1 cell'])
    expect(describeSoloTick([{ type: 'LIFE_LOST', reason: 'SELF_TRAIL', at: { x: 1, y: 1 }, livesLeft: 2 }])).toEqual([
      'Own trail!',
    ])
  })

  it('level intro and progress', () => {
    expect(levelIntro(2)).toBe('Level 2 — 3 balls')
    expect(progressLabel({ progress: 0.4259 })).toBe('42%/75%')
    // 74.9% не показывается как 75%.
    expect(progressLabel({ progress: 0.749 })).toBe('74%/75%')
  })

  it('end reason from the last life lost', () => {
    expect(soloEndReason([{ type: 'LIFE_LOST', reason: 'SELF_TRAIL', at: { x: 1, y: 1 }, livesLeft: 0 }])).toBe(
      'You crossed your own trail'
    )
    expect(soloEndReason([{ type: 'LIFE_LOST', reason: 'BALL_HIT', at: { x: 1, y: 1 }, livesLeft: 0 }])).toBe(
      'A ball hit your trail'
    )
  })
})

describe('settings: mode', () => {
  it('defaults to duel; keeps a stored solo; drops junk', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
    ;(globalThis as { localStorage?: unknown }).localStorage = storage
    expect(loadSettings().mode).toBe('duel')
    data.set('ts_settings', JSON.stringify({ difficulty: 'normal', speed: 'fast', mode: 'solo' }))
    expect(loadSettings()).toEqual({ mode: 'solo', difficulty: 'normal', speed: 'fast' })
    data.set('ts_settings', JSON.stringify({ mode: 'arcade' }))
    expect(loadSettings().mode).toBe('duel')
    delete (globalThis as { localStorage?: unknown }).localStorage
  })
})
