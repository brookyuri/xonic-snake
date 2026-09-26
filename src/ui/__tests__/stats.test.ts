import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  exportStats,
  recordAbandoned,
  formatStatsLine,
  loadGames,
  loadStats,
  markLastGameRematch,
  MAX_GAMES,
  recordGame,
} from '../stats'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

const game = (winner: 'P1' | 'P2' | 'DRAW') => ({
  startedAt: '2026-09-26T12:00:00.000Z',
  rounds: 30,
  winner,
  reason: 'TRAIL_CUT' as const,
  blueCells: 20,
  redCells: 15,
  captures: 3,
  difficulty: 'easy' as const,
  speed: 'normal' as const,
})

afterEach(() => vi.unstubAllGlobals())

describe('stats', () => {
  it('works with no storage at all', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(() => recordGame(game('P1'), 10)).not.toThrow()
    expect(loadStats()).toEqual({ gamesPlayed: 0, wins: 0, losses: 0, draws: 0, bestTerritory: 0, abandoned: 0 })
    expect(loadGames()).toEqual([])
  })

  it('works when storage throws (private mode, quota)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
    })
    expect(() => recordGame(game('P1'), 10)).not.toThrow()
    expect(() => markLastGameRematch()).not.toThrow()
    expect(JSON.parse(exportStats()).games).toEqual([])
  })

  it('accumulates results, best territory and the rematch flag', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    recordGame(game('P1'), 12)
    recordGame(game('P2'), 34)
    markLastGameRematch()
    recordGame(game('DRAW'), 20)

    expect(loadStats()).toEqual({ gamesPlayed: 3, wins: 1, losses: 1, draws: 1, bestTerritory: 34, abandoned: 0 })
    expect(loadGames().map((g) => g.rematch)).toEqual([false, true, false])
    expect(formatStatsLine(loadStats())).toBe('Played 3 · Won 1 · Best 34%')
  })

  it('keeps only the last 200 games', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    for (let i = 0; i < MAX_GAMES + 5; i++) recordGame({ ...game('P1'), rounds: i }, 5)
    const games = loadGames()
    expect(games).toHaveLength(MAX_GAMES)
    expect(games[0].rounds).toBe(5)
  })

  it('ignores corrupted stored data', () => {
    const storage = memoryStorage()
    storage.setItem('ts_stats', '"oops"')
    storage.setItem('ts_games', '{not json')
    vi.stubGlobal('localStorage', storage)
    expect(loadStats().gamesPlayed).toBe(0)
    expect(loadGames()).toEqual([])
  })

  it('exports valid JSON with stats and games', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    recordGame(game('P1'), 12)
    const exported = JSON.parse(exportStats())
    expect(exported.stats.gamesPlayed).toBe(1)
    expect(exported.games[0]).toMatchObject({
      winner: 'P1',
      reason: 'TRAIL_CUT',
      rematch: false,
      difficulty: 'easy',
      speed: 'normal',
    })
    expect(typeof exported.exportedAt).toBe('string')
  })

  it('abandoned games are logged but count as neither win nor loss', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    recordGame(game('P1'), 12)
    const { winner: _w, reason: _r, ...partial } = game('P2')
    recordAbandoned({ ...partial, rounds: 17, blueCells: 11, redCells: 14 })
    expect(loadStats()).toEqual({ gamesPlayed: 1, wins: 1, losses: 0, draws: 0, bestTerritory: 12, abandoned: 1 })
    expect(loadGames()[1]).toMatchObject({
      reason: 'ABANDONED',
      winner: null,
      rounds: 17,
      blueCells: 11,
      redCells: 14,
      rematch: false,
    })
  })
})
