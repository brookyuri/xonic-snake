import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  exportStats,
  formatSoloStatsLine,
  loadGames,
  loadAllSoloStats,
  loadSoloStats,
  loadStats,
  markLastGameRematch,
  recordGame,
  recordSoloAbandoned,
  recordSoloGame,
  unrecordAbandoned,
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

const solo = (score: number, level: number) => ({
  startedAt: '2026-09-27T12:00:00.000Z',
  rounds: 120,
  level,
  score,
  captures: 4,
  speed: 'fast' as const,
})

afterEach(() => vi.unstubAllGlobals())

describe('Solo stats (ts_solo)', () => {
  it('counts games, best score and best level; reports NEW BEST', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    expect(recordSoloGame(solo(300, 1))).toEqual({ previousBest: 0, newBest: true })
    expect(recordSoloGame(solo(120, 3))).toEqual({ previousBest: 300, newBest: false })
    expect(recordSoloGame(solo(300, 2))).toEqual({ previousBest: 300, newBest: false })
    expect(loadSoloStats()).toEqual({ gamesPlayed: 3, bestScore: 300, bestLevel: 3 })
    expect(formatSoloStatsLine(loadSoloStats())).toBe('Played 3 · Best 300 · Level 3')
    // Duel-сводка не тронута.
    expect(loadStats().gamesPlayed).toBe(0)
  })

  it('a zero score is not a new best', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    expect(recordSoloGame(solo(0, 1)).newBest).toBe(false)
  })

  it('writes solo records to ts_games with mode, level, score, reason, rematch', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    recordSoloGame(solo(450, 2))
    markLastGameRematch()
    const id = recordSoloAbandoned(solo(30, 1))
    const games = loadGames()
    expect(games[0]).toMatchObject({ mode: 'solo', level: 2, score: 450, reason: 'GAME_OVER', rounds: 120, speed: 'fast', rematch: true })
    expect(games[1]).toMatchObject({ mode: 'solo', reason: 'ABANDONED', rematch: false, id })
    // Брошенная не входит в ts_solo.
    expect(loadSoloStats().gamesPlayed).toBe(1)
    // bfcache: запись снимается, счётчик Duel не трогается.
    unrecordAbandoned(id)
    expect(loadGames()).toHaveLength(1)
    expect(loadStats().abandoned).toBe(0)
  })

  it('migrates old Duel records on read: mode "duel", nothing lost', () => {
    const storage = memoryStorage()
    const old = {
      id: 'a1',
      startedAt: '2026-09-20T10:00:00.000Z',
      rounds: 88,
      winner: 'P2',
      reason: 'TRAIL_CUT',
      blueCells: 20,
      redCells: 31,
      captures: 2,
      rematch: true,
      difficulty: 'normal',
      speed: 'slow',
    }
    storage.setItem('ts_games', JSON.stringify([old]))
    vi.stubGlobal('localStorage', storage)
    expect(loadGames()).toEqual([{ ...old, mode: 'duel' }])
    // Новая запись дописывается, старая сохраняется целиком.
    recordSoloGame(solo(10, 1))
    const games = loadGames()
    expect(games[0]).toEqual({ ...old, mode: 'duel' })
    expect(games[1].mode).toBe('solo')
  })

  it('new Duel records carry mode "duel"', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    recordGame(
      {
        startedAt: 'x',
        rounds: 3,
        winner: 'P1',
        reason: 'TRAIL_CUT',
        blueCells: 9,
        redCells: 9,
        captures: 0,
        difficulty: 'easy',
        speed: 'normal',
      },
      4
    )
    expect(loadGames()[0].mode).toBe('duel')
  })

  it('export has both parts', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    recordSoloGame(solo(77, 1))
    const exported = JSON.parse(exportStats())
    expect(exported.stats).toMatchObject({ gamesPlayed: 0 })
    // С v0.3 — обе сложности (партия без difficulty — Normal).
    expect(exported.solo).toEqual({
      easy: { gamesPlayed: 0, bestScore: 0, bestLevel: 0 },
      normal: { gamesPlayed: 1, bestScore: 77, bestLevel: 1 },
    })
    expect(exported.games[0]).toMatchObject({ mode: 'solo', score: 77 })
  })

  it('survives junk in ts_solo', () => {
    const storage = memoryStorage()
    storage.setItem('ts_solo', '{"bestScore":"lots"}')
    vi.stubGlobal('localStorage', storage)
    expect(loadSoloStats()).toEqual({ gamesPlayed: 0, bestScore: 0, bestLevel: 0 })
  })
})

describe('Solo stats by difficulty (SOLO_RULES v0.3, section 13)', () => {
  it('records are separate: NEW BEST compares with the record of its own difficulty', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    expect(recordSoloGame({ ...solo(500, 3), difficulty: 'normal' })).toEqual({ previousBest: 0, newBest: true })
    expect(recordSoloGame({ ...solo(200, 2), difficulty: 'easy' })).toEqual({ previousBest: 0, newBest: true })
    expect(recordSoloGame({ ...solo(300, 2), difficulty: 'easy' })).toEqual({ previousBest: 200, newBest: true })
    expect(recordSoloGame({ ...solo(400, 4), difficulty: 'normal' })).toEqual({ previousBest: 500, newBest: false })
    expect(loadSoloStats('easy')).toEqual({ gamesPlayed: 2, bestScore: 300, bestLevel: 2 })
    expect(loadSoloStats('normal')).toEqual({ gamesPlayed: 2, bestScore: 500, bestLevel: 4 })
    expect(loadGames().map((g) => (g.mode === 'solo' ? g.difficulty : null))).toEqual(['normal', 'easy', 'easy', 'normal'])
  })

  it('migrates the pre-v0.3 summary into Normal without losing anything', () => {
    const storage = memoryStorage()
    storage.setItem('ts_solo', JSON.stringify({ gamesPlayed: 12, bestScore: 1450, bestLevel: 3 }))
    storage.setItem('ts_games', JSON.stringify([{ mode: 'solo', id: 's1', startedAt: '2026-09-28T10:00:00.000Z', rounds: 300, level: 3, score: 1450, reason: 'GAME_OVER', captures: 9, rematch: false, speed: 'normal' }]))
    vi.stubGlobal('localStorage', storage)
    expect(loadAllSoloStats()).toEqual({
      easy: { gamesPlayed: 0, bestScore: 0, bestLevel: 0 },
      normal: { gamesPlayed: 12, bestScore: 1450, bestLevel: 3 },
    })
    expect(loadGames()[0]).toMatchObject({ id: 's1', score: 1450, difficulty: 'normal' })
    // Первая партия на Easy не трогает рекорды Normal.
    expect(recordSoloGame({ ...solo(100, 1), difficulty: 'easy' })).toEqual({ previousBest: 0, newBest: true })
    expect(loadSoloStats('normal')).toEqual({ gamesPlayed: 12, bestScore: 1450, bestLevel: 3 })
  })
})
