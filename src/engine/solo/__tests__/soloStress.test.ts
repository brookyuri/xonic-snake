import { describe, it, expect } from 'vitest'
import { mulberry32 } from '../../../bot/rng'
import { DIRECTION_DELTA } from '../../constants'
import type { Direction } from '../../types'
import { SOLO_BOARD_SIZE } from '../config'
import { assertSoloInvariants } from '../invariants'
import { continueSolo, getLegalMoves, resolveSoloTick } from '../resolve'
import { createSoloState } from '../state'
import type { LifeLostReason, SoloState } from '../types'

const GAMES = 2000
const SEED = 20260927
const MAX_TICKS = 3000
const HOMING = 0.3
const N = SOLO_BOARD_SIZE

/** Соседи каждой клетки плоского поля N×N — считаются один раз. */
const NEIGHBORS: number[][] = Array.from({ length: N * N }, (_, k) => {
  const x = k % N
  const y = (k - x) / N
  return Object.values(DIRECTION_DELTA)
    .map((d) => ({ x: x + d.x, y: y + d.y }))
    .filter((p) => p.x >= 0 && p.y >= 0 && p.x < N && p.y < N)
    .map((p) => p.y * N + p.x)
})
const dist = new Int16Array(N * N)
const queue = new Int16Array(N * N)

/** Расстояние до ближайшей своей земли в обход своего следа (BFS от всей земли сразу). */
function distanceToLand(state: SoloState): Int16Array {
  dist.fill(-1)
  let tail = 0
  for (let y = 0; y < N; y++) {
    const row = state.board[y]
    for (let x = 0; x < N; x++) {
      if (row[x].territory === 'P1') {
        dist[y * N + x] = 0
        queue[tail++] = y * N + x
      }
    }
  }
  for (let head = 0; head < tail; head++) {
    const cur = queue[head]
    for (const k of NEIGHBORS[cur]) {
      if (dist[k] !== -1) continue
      const x = k % N
      if (state.board[(k - x) / N][x].trail === 'P1') continue
      dist[k] = dist[cur] + 1
      queue[tail++] = k
    }
  }
  return dist
}

/**
 * «Случайная змейка»: случайный допустимый ход не на свой след; с вероятностью 0.3 —
 * ход, который ближе всего к своей земле.
 */
function randomSnake(state: SoloState, rng: () => number): Direction {
  const { head } = state.player
  const options: Direction[] = []
  const targets: number[] = []
  const legal = getLegalMoves(state, 'P1')
  for (const d of legal) {
    const x = head.x + DIRECTION_DELTA[d].x
    const y = head.y + DIRECTION_DELTA[d].y
    if (state.board[y][x].trail === 'P1') continue
    options.push(d)
    targets.push(y * N + x)
  }
  if (options.length === 0) return legal[Math.floor(rng() * legal.length)]
  if (rng() < HOMING) {
    const d = distanceToLand(state)
    let best = Infinity
    for (const t of targets) if (d[t] !== -1 && d[t] < best) best = d[t]
    const nearest = options.filter((_, i) => (d[targets[i]] === -1 ? Infinity : d[targets[i]]) === best)
    return nearest[Math.floor(rng() * nearest.length)]
  }
  return options[Math.floor(rng() * options.length)]
}

describe('stress: random snake in Solo', () => {
  it(`plays ${GAMES} games without invariant violations`, () => {
    const rng = mulberry32(SEED)
    const lifeLost: Record<LifeLostReason, number> = { SELF_TRAIL: 0, BALL_HIT: 0 }
    let levelsReached = 0
    let passedLevel1 = 0
    let captures = 0
    let capturedCells = 0
    let totalTicks = 0
    let hitLimit = 0
    let maxLevel = 1
    // Жизнь потеряна в первые 5 тиков после возрождения (после отсчёта).
    const QUICK = 5
    let quickLosses = 0

    for (let game = 0; game < GAMES; game++) {
      let state = createSoloState({ seed: SEED + game })
      let ticks = 0
      let sinceRespawn = Infinity
      while (state.status !== 'GAME_OVER' && ticks < MAX_TICKS) {
        if (state.status !== 'PLAYING') {
          sinceRespawn = state.status === 'LIFE_LOST' ? 0 : Infinity
          state = continueSolo(state)
          assertSoloInvariants(state)
        }
        const move = randomSnake(state, rng)
        const result = resolveSoloTick(state, move)
        ticks++
        sinceRespawn++
        try {
          assertSoloInvariants(result.state, state)
        } catch (error) {
          throw new Error(`game ${game}, tick ${ticks}, move ${move}: ${(error as Error).message}\n${JSON.stringify(state)}`)
        }
        for (const e of result.events) {
          if (e.type === 'LIFE_LOST') {
            lifeLost[e.reason]++
            if (sinceRespawn <= QUICK) quickLosses++
          }
          if (e.type === 'CAPTURED') {
            captures++
            capturedCells += e.cells.length
          }
          if (e.type === 'LEVEL_COMPLETE' && e.level === 1) passedLevel1++
        }
        state = result.state
      }
      if (ticks >= MAX_TICKS) hitLimit++
      levelsReached += state.level
      maxLevel = Math.max(maxLevel, state.level)
      totalTicks += ticks
    }

    const lost = lifeLost.SELF_TRAIL + lifeLost.BALL_HIT
    const pct = (n: number, of: number) => `${((n / Math.max(1, of)) * 100).toFixed(1)}%`
    console.log(
      [
        `solo stress: ${GAMES} games, seed ${SEED}, limit ${MAX_TICKS} ticks`,
        `lives lost: ${lost} — BALL_HIT ${lifeLost.BALL_HIT} (${pct(lifeLost.BALL_HIT, lost)}), SELF_TRAIL ${lifeLost.SELF_TRAIL} (${pct(lifeLost.SELF_TRAIL, lost)})`,
        `avg level reached: ${(levelsReached / GAMES).toFixed(2)} (max ${maxLevel})`,
        `passed level 1: ${passedLevel1} (${pct(passedLevel1, GAMES)})`,
        `avg capture: ${(capturedCells / Math.max(1, captures)).toFixed(2)} cells over ${captures} captures`,
        `avg length: ${(totalTicks / GAMES).toFixed(1)} ticks; hit the limit: ${hitLimit}`,
        `lives lost within ${QUICK} ticks after a respawn: ${quickLosses} (${pct(quickLosses, lost)} of lost lives)`,
      ].join('\n')
    )
    expect(levelsReached).toBeGreaterThanOrEqual(GAMES)
  })
})
