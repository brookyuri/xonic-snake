import { describe, it, expect } from 'vitest'
import { describeSoloTick, levelIntro, progressLabel, soloEndReason } from '../soloText'
import { loadSettings, modeDifficulty, withModeDifficulty } from '../settings'
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
    // Настройки до v0.3 — без soloDifficulty: такой игрок играл Solo на Normal, так и остаётся.
    expect(loadSettings()).toEqual({ mode: 'solo', difficulty: 'normal', soloDifficulty: 'normal', speed: 'fast', theme: '2026' })
    data.set('ts_settings', JSON.stringify({ mode: 'arcade' }))
    expect(loadSettings().mode).toBe('duel')
    delete (globalThis as { localStorage?: unknown }).localStorage
  })
})

describe('settings: theme', () => {
  it('defaults to 2026 (also for settings saved before themes existed); keeps 1986; drops junk', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
    ;(globalThis as { localStorage?: unknown }).localStorage = storage
    expect(loadSettings().theme).toBe('2026')
    data.set('ts_settings', JSON.stringify({ mode: 'solo', difficulty: 'easy', speed: 'normal' }))
    expect(loadSettings().theme).toBe('2026')
    data.set('ts_settings', JSON.stringify({ mode: 'solo', theme: '1986' }))
    expect(loadSettings().theme).toBe('1986')
    data.set('ts_settings', JSON.stringify({ theme: 'neon' }))
    expect(loadSettings().theme).toBe('2026')
    delete (globalThis as { localStorage?: unknown }).localStorage
  })
})

describe('settings: difficulty per mode (SOLO_RULES v0.3, section 13)', () => {
  it('a new player gets Easy in both modes; each mode keeps its own difficulty', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
    ;(globalThis as { localStorage?: unknown }).localStorage = storage
    const fresh = loadSettings()
    expect(fresh.difficulty).toBe('easy')
    expect(fresh.soloDifficulty).toBe('easy')

    const duelNormal = withModeDifficulty({ ...fresh, mode: 'duel' }, 'normal')
    expect(duelNormal).toMatchObject({ difficulty: 'normal', soloDifficulty: 'easy' })
    expect(modeDifficulty(duelNormal)).toBe('normal')
    expect(modeDifficulty({ ...duelNormal, mode: 'solo' })).toBe('easy')

    data.set('ts_settings', JSON.stringify({ ...duelNormal, mode: 'solo', soloDifficulty: 'normal', difficulty: 'easy' }))
    expect(loadSettings()).toMatchObject({ difficulty: 'easy', soloDifficulty: 'normal' })
    data.set('ts_settings', JSON.stringify({ mode: 'solo', soloDifficulty: 'hard' }))
    expect(loadSettings().soloDifficulty).toBe('normal')
    delete (globalThis as { localStorage?: unknown }).localStorage
  })
})

describe('levelIntro by difficulty', () => {
  it('Easy has one ball fewer (SOLO_RULES v0.3, section 13)', () => {
    expect(levelIntro(1, 'easy')).toBe('Level 1 — 1 ball')
    expect(levelIntro(2, 'easy')).toBe('Level 2 — 2 balls')
    expect(levelIntro(2, 'normal')).toBe('Level 2 — 3 balls')
  })
})
