import type { PlayerId, Reason } from '../engine/types'
import { readJSON, writeJSON } from './storage'
import type { Speed } from '../game/config'
import type { Difficulty } from './settings'

export const STATS_KEY = 'ts_stats'
export const GAMES_KEY = 'ts_games'
export const MAX_GAMES = 200

/** Сводка по партиям человека. bestTerritory — лучший % территории на конец партии. */
export interface PlayerStats {
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
  bestTerritory: number
}

/** Одна партия для метрик плейтеста (PRD, раздел 28). winner: P1 — человек, P2 — бот. */
export interface GameRecord {
  startedAt: string
  rounds: number
  winner: PlayerId | 'DRAW'
  reason: Reason
  blueCells: number
  redCells: number
  /** Сколько раз человек замкнул след за партию. */
  captures: number
  /** Нажал PLAY AGAIN сразу после этой партии. */
  rematch: boolean
  difficulty: Difficulty
  speed: Speed
}

const EMPTY_STATS: PlayerStats = { gamesPlayed: 0, wins: 0, losses: 0, draws: 0, bestTerritory: 0 }

export function loadStats(): PlayerStats {
  const raw = readJSON<Partial<PlayerStats> | null>(STATS_KEY, null)
  if (!raw || typeof raw !== 'object') return { ...EMPTY_STATS }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return {
    gamesPlayed: num(raw.gamesPlayed),
    wins: num(raw.wins),
    losses: num(raw.losses),
    draws: num(raw.draws),
    bestTerritory: num(raw.bestTerritory),
  }
}

export function loadGames(): GameRecord[] {
  const raw = readJSON<unknown>(GAMES_KEY, [])
  return Array.isArray(raw) ? (raw as GameRecord[]) : []
}

export function recordGame(record: Omit<GameRecord, 'rematch'>, humanPercent: number): void {
  const stats = loadStats()
  stats.gamesPlayed++
  if (record.winner === 'P1') stats.wins++
  else if (record.winner === 'P2') stats.losses++
  else stats.draws++
  stats.bestTerritory = Math.max(stats.bestTerritory, humanPercent)
  writeJSON(STATS_KEY, stats)

  const games = [...loadGames(), { ...record, rematch: false }].slice(-MAX_GAMES)
  writeJSON(GAMES_KEY, games)
}

export function markLastGameRematch(): void {
  const games = loadGames()
  if (games.length === 0) return
  games[games.length - 1] = { ...games[games.length - 1], rematch: true }
  writeJSON(GAMES_KEY, games)
}

export function formatStatsLine(stats: PlayerStats): string {
  return `Played ${stats.gamesPlayed} · Won ${stats.wins} · Best ${stats.bestTerritory}%`
}

/** JSON, который тестеры присылают после плейтеста. */
export function exportStats(): string {
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), stats: loadStats(), games: loadGames() },
    null,
    2
  )
}
