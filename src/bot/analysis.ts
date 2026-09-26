import { BOARD_SIZE, DIRECTION_DELTA, OPPOSITE_DIRECTION } from '../engine/constants'
import { computeCapture } from '../engine/capture'
import { getLegalMoves } from '../engine/moves'
import type { Direction, GameState, PlayerId, Pos } from '../engine/types'

const DIRECTIONS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT']

export function opponentOf(player: PlayerId): PlayerId {
  return player === 'P1' ? 'P2' : 'P1'
}

export function step(pos: Pos, direction: Direction): Pos {
  const d = DIRECTION_DELTA[direction]
  return { x: pos.x + d.x, y: pos.y + d.y }
}

function inBounds(p: Pos): boolean {
  return p.x >= 0 && p.x < BOARD_SIZE && p.y >= 0 && p.y < BOARD_SIZE
}

/**
 * BFS от головы игрока: число ходов до ближайшей клетки, где isTarget = true.
 * Первый шаг не может быть разворотом; клетки собственного следа непроходимы.
 */
function distanceFromHead(
  state: GameState,
  player: PlayerId,
  isTarget: (x: number, y: number) => boolean
): number {
  const { board } = state
  const { head, direction } = state.players[player]
  if (isTarget(head.x, head.y)) return 0

  const visited = new Uint8Array(BOARD_SIZE * BOARD_SIZE)
  visited[head.y * BOARD_SIZE + head.x] = 1
  let frontier: Pos[] = [head]
  let distance = 0

  while (frontier.length > 0) {
    distance++
    const next: Pos[] = []
    for (const cur of frontier) {
      for (const dir of DIRECTIONS) {
        if (distance === 1 && dir === OPPOSITE_DIRECTION[direction]) continue
        const p = step(cur, dir)
        if (!inBounds(p)) continue
        const key = p.y * BOARD_SIZE + p.x
        if (visited[key]) continue
        visited[key] = 1
        if (board[p.y][p.x].trail === player) continue
        if (isTarget(p.x, p.y)) return distance
        next.push(p)
      }
    }
    frontier = next
  }
  return Infinity
}

/** Ходов до любой клетки своей территории (0 — уже дома). Infinity, если пути нет. */
export function distanceHome(state: GameState, player: PlayerId): number {
  const { board } = state
  return distanceFromHead(state, player, (x, y) => board[y][x].territory === player)
}

/** Ходов от головы attacker до любой клетки следа victim. Infinity, если следа нет. */
export function distanceToTrail(state: GameState, attacker: PlayerId, victim: PlayerId): number {
  if (state.players[victim].trail.length === 0) return Infinity
  const { board } = state
  return distanceFromHead(state, attacker, (x, y) => board[y][x].trail === victim)
}

/**
 * Запас в гонке «противник к моему следу против меня домой», в ходах.
 * ≤ 0 — противник успевает: ходы одновременные, а удар по следу раньше захвата.
 * −Infinity, если пути домой нет; Infinity, если противнику не дойти до следа.
 */
export function trailRace(state: GameState, player: PlayerId, home = distanceHome(state, player)): number {
  if (home === Infinity) return -Infinity
  return distanceToTrail(state, opponentOf(player), player) - home
}

/** Мой след под угрозой — единое определение для бота и для подсказки в UI. */
export function isTrailInDanger(state: GameState, player: PlayerId): boolean {
  return state.players[player].trail.length > 0 && trailRace(state, player) <= 0
}

/** Сколько клеток игрок получит, если его след замкнётся прямо сейчас (раздел 7). */
export function potentialCapture(state: GameState, player: PlayerId): number {
  if (state.players[player].trail.length === 0) return 0
  return computeCapture(state, player).length
}

/** Легальные ходы, которые не ведут немедленно на собственный след. */
export function movesAvoidingOwnTrail(state: GameState, player: PlayerId): Direction[] {
  const { head } = state.players[player]
  return getLegalMoves(state, player).filter((dir) => {
    const t = step(head, dir)
    return state.board[t.y][t.x].trail !== player
  })
}

/**
 * Ход ведёт в тупик: после него у игрока не останется ни одного хода,
 * кроме шагов на собственный след. Возврат домой тупиком не бывает — след снимется.
 */
export function isDeadEnd(state: GameState, player: PlayerId, move: Direction): boolean {
  const { board } = state
  const { head } = state.players[player]
  const target = step(head, move)
  if (board[target.y][target.x].territory === player) return false

  for (const dir of DIRECTIONS) {
    if (dir === OPPOSITE_DIRECTION[move]) continue
    const p = step(target, dir)
    if (!inBounds(p)) continue
    if (board[p.y][p.x].trail !== player) return false
  }
  return true
}
