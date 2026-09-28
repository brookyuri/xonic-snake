import { mulberry32 } from '../../bot/rng'
import type { Cell, Player } from '../types'
import {
  BALL_MIN_DISTANCE,
  ballsForLevel,
  INNER_CELLS,
  RESPAWN_POINTS,
  SOLO_BOARD_SIZE,
  SOLO_START,
  START_LIVES,
} from './config'
import type { Ball, SoloState, Unit } from './types'

const N = SOLO_BOARD_SIZE

export const isFrame = (x: number, y: number) => x === 0 || y === 0 || x === N - 1 || y === N - 1

/** Своя земля в начале уровня — рамка (76 клеток). */
export function frameBoard(): Cell[][] {
  return Array.from({ length: N }, (_, y) =>
    Array.from({ length: N }, (_, x): Cell => ({ territory: isFrame(x, y) ? 'P1' : 'NONE', trail: 'NONE' }))
  )
}

export function startPlayer(): Player {
  return { id: 'P1', head: { ...SOLO_START.head }, direction: SOLO_START.direction, trail: [], alive: true }
}

/**
 * Возрождение (раздел 2.1): из середин сторон рамки — та, у которой расстояние до
 * ближайшего шарика (по Чебышёву) максимально; при равенстве — первая по порядку.
 */
export function respawnPlayer(balls: readonly Ball[]): Player {
  let best = RESPAWN_POINTS[0]
  let bestDistance = -1
  for (const point of RESPAWN_POINTS) {
    const nearest = Math.min(
      ...balls.map((b) => Math.max(Math.abs(b.pos.x - point.head.x), Math.abs(b.pos.y - point.head.y)))
    )
    if (nearest > bestDistance) {
      best = point
      bestDistance = nearest
    }
  }
  return { id: 'P1', head: { ...best.head }, direction: best.direction, trail: [], alive: true }
}

/** Отдельное зерно на каждый уровень: уровень N одной партии всегда одинаков. */
function levelSeed(seed: number, level: number): number {
  return (seed ^ Math.imul(level, 0x9e3779b1)) >>> 0
}

/**
 * Шарики уровня: level + 1 штук на случайных клетках внутреннего поля, не ближе
 * BALL_MIN_DISTANCE (по Чебышёву) к старту змейки, не в одной клетке; направления —
 * случайные диагонали.
 */
export function spawnBalls(seed: number, level: number): Ball[] {
  const rng = mulberry32(levelSeed(seed, level))
  const start = SOLO_START.head
  const free: { x: number; y: number }[] = []
  for (let y = 1; y < N - 1; y++) {
    for (let x = 1; x < N - 1; x++) {
      if (Math.max(Math.abs(x - start.x), Math.abs(y - start.y)) >= BALL_MIN_DISTANCE) free.push({ x, y })
    }
  }
  const sign = (): Unit => (rng() < 0.5 ? -1 : 1)
  const balls: Ball[] = []
  for (let i = 0; i < ballsForLevel(level); i++) {
    const [pos] = free.splice(Math.floor(rng() * free.length), 1)
    balls.push({ pos, vel: { dx: sign(), dy: sign() } })
  }
  return balls
}

/** Сколько клеток внутреннего поля — земля. */
export function innerLand(board: readonly (readonly Cell[])[]): number {
  let n = 0
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) if (board[y][x].territory === 'P1') n++
  return n
}

export const progressOf = (board: readonly (readonly Cell[])[]) => innerLand(board) / INNER_CELLS

/** SOLO_RULES.md раздел 8: старт уровня (по умолчанию — уровень 1, 3 жизни, 0 очков). */
export function createSoloState(opts: { seed: number; level?: number; lives?: number; score?: number }): SoloState {
  const level = opts.level ?? 1
  return {
    board: frameBoard(),
    player: startPlayer(),
    balls: spawnBalls(opts.seed, level),
    level,
    lives: opts.lives ?? START_LIVES,
    score: opts.score ?? 0,
    progress: 0,
    round: 0,
    status: 'PLAYING',
    seed: opts.seed,
  }
}
