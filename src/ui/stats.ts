import type { PlayerId, Reason } from '../engine/types'
import { readJSON, writeJSON } from './storage'
import type { Speed } from '../game/config'
import type { Difficulty } from './settings'

export const STATS_KEY = 'ts_stats'
export const SOLO_KEY = 'ts_solo'
export const GAMES_KEY = 'ts_games'
export const MAX_GAMES = 200

/**
 * Сводка по партиям человека. bestTerritory — лучший % территории на конец партии.
 * abandoned — брошенные партии; в gamesPlayed/wins/losses/draws они не входят.
 */
export interface PlayerStats {
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
  bestTerritory: number
  abandoned: number
}

/** Партия брошена: RESTART / MENU с паузы или уход со страницы во время матча. */
export const ABANDONED = 'ABANDONED'

/** Одна партия Duel для метрик плейтеста (PRD, раздел 28). winner: P1 — человек, P2 — бот. */
export interface DuelGameRecord {
  mode: 'duel'
  /** Уникальный id записи — чтобы снять брошенную партию, если вкладка вернулась из bfcache. */
  id: string
  startedAt: string
  rounds: number
  /** null — партия брошена. */
  winner: PlayerId | 'DRAW' | null
  reason: Reason | typeof ABANDONED
  blueCells: number
  redCells: number
  /** Сколько раз человек замкнул след за партию. */
  captures: number
  /** Нажал PLAY AGAIN сразу после этой партии. */
  rematch: boolean
  difficulty: Difficulty
  speed: Speed
}

/** Одна партия Solo. level — уровень, на котором она закончилась; rounds — тики за всю партию. */
export interface SoloGameRecord {
  mode: 'solo'
  id: string
  startedAt: string
  rounds: number
  level: number
  score: number
  reason: 'GAME_OVER' | typeof ABANDONED
  captures: number
  rematch: boolean
  speed: Speed
}

export type GameRecord = DuelGameRecord | SoloGameRecord

/** Сводка Solo (ts_solo). */
export interface SoloStats {
  gamesPlayed: number
  bestScore: number
  bestLevel: number
}

const EMPTY_STATS: PlayerStats = { gamesPlayed: 0, wins: 0, losses: 0, draws: 0, bestTerritory: 0, abandoned: 0 }

export function loadStats(): PlayerStats {
  const raw = readJSON<Partial<PlayerStats> | null>(STATS_KEY, null)
  if (!raw || typeof raw !== 'object') return { ...EMPTY_STATS }
  return {
    gamesPlayed: num(raw.gamesPlayed),
    wins: num(raw.wins),
    losses: num(raw.losses),
    draws: num(raw.draws),
    bestTerritory: num(raw.bestTerritory),
    abandoned: num(raw.abandoned),
  }
}

/**
 * Все партии. Записи Duel, сохранённые до появления Solo, не знают своего режима —
 * при чтении им дописывается mode: "duel" (остальные поля не меняются).
 */
export function loadGames(): GameRecord[] {
  const raw = readJSON<unknown>(GAMES_KEY, [])
  if (!Array.isArray(raw)) return []
  return raw
    .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object')
    .map((g) => (g.mode === 'solo' ? (g as unknown as SoloGameRecord) : ({ ...g, mode: 'duel' } as unknown as DuelGameRecord)))
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function loadSoloStats(): SoloStats {
  const raw = readJSON<Partial<SoloStats> | null>(SOLO_KEY, null)
  if (!raw || typeof raw !== 'object') return { gamesPlayed: 0, bestScore: 0, bestLevel: 0 }
  return { gamesPlayed: num(raw.gamesPlayed), bestScore: num(raw.bestScore), bestLevel: num(raw.bestLevel) }
}

function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

type NewRecord = Omit<DuelGameRecord, 'rematch' | 'id'> | Omit<SoloGameRecord, 'rematch' | 'id'>

function appendGame(record: NewRecord): string {
  const id = newId()
  const games = [...loadGames(), { ...record, id, rematch: false }].slice(-MAX_GAMES)
  writeJSON(GAMES_KEY, games)
  return id
}

type DuelFields = Omit<DuelGameRecord, 'mode' | 'rematch' | 'winner' | 'reason' | 'id'>

type FinishedRecord = DuelFields & {
  winner: PlayerId | 'DRAW'
  reason: Reason
}

export function recordGame(record: FinishedRecord, humanPercent: number): void {
  const stats = loadStats()
  stats.gamesPlayed++
  if (record.winner === 'P1') stats.wins++
  else if (record.winner === 'P2') stats.losses++
  else stats.draws++
  stats.bestTerritory = Math.max(stats.bestTerritory, humanPercent)
  writeJSON(STATS_KEY, stats)
  appendGame({ ...record, mode: 'duel' })
}

/**
 * Брошенная партия: в ts_games с reason ABANDONED, в сводке — только счётчик abandoned.
 * Возвращает id записи.
 */
export function recordAbandoned(record: DuelFields): string {
  const stats = loadStats()
  stats.abandoned++
  writeJSON(STATS_KEY, stats)
  return appendGame({ ...record, mode: 'duel', winner: null, reason: ABANDONED })
}

type SoloFields = Omit<SoloGameRecord, 'mode' | 'rematch' | 'reason' | 'id'>

/**
 * Партия Solo закончилась (GAME_OVER). Возвращает лучший результат до этой партии и
 * побит ли он — для «NEW BEST!» на экране конца.
 */
export function recordSoloGame(record: SoloFields): { previousBest: number; newBest: boolean } {
  const stats = loadSoloStats()
  const previousBest = stats.bestScore
  stats.gamesPlayed++
  stats.bestScore = Math.max(stats.bestScore, record.score)
  stats.bestLevel = Math.max(stats.bestLevel, record.level)
  writeJSON(SOLO_KEY, stats)
  appendGame({ ...record, mode: 'solo', reason: 'GAME_OVER' })
  return { previousBest, newBest: record.score > previousBest }
}

/** Брошенная партия Solo: только в ts_games, в сводку ts_solo не входит. Возвращает id. */
export function recordSoloAbandoned(record: SoloFields): string {
  return appendGame({ ...record, mode: 'solo', reason: ABANDONED })
}

/** Снять запись брошенной партии (вкладка вернулась из bfcache — партия продолжается). */
export function unrecordAbandoned(id: string): void {
  const games = loadGames()
  const removed = games.find((g) => g.id === id && g.reason === ABANDONED)
  if (!removed) return
  writeJSON(GAMES_KEY, games.filter((g) => g !== removed))
  if (removed.mode === 'solo') return
  const stats = loadStats()
  stats.abandoned = Math.max(0, stats.abandoned - 1)
  writeJSON(STATS_KEY, stats)
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

export function formatSoloStatsLine(stats: SoloStats): string {
  return `Played ${stats.gamesPlayed} · Best ${stats.bestScore} · Level ${stats.bestLevel}`
}

/** JSON, который тестеры присылают после плейтеста: сводки Duel (stats) и Solo (solo), все партии. */
export function exportStats(): string {
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), stats: loadStats(), solo: loadSoloStats(), games: loadGames() },
    null,
    2
  )
}
