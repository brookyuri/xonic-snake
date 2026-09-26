import { BOARD_SIZE, DIRECTION_DELTA, MAX_ROUNDS } from './constants'
import { getLegalMoves } from './moves'
import { computeCapture } from './capture'
import type {
  Direction,
  GameEvent,
  GameState,
  Player,
  PlayerId,
  Pos,
  Reason,
} from './types'

const OTHER: Record<PlayerId, PlayerId> = { P1: 'P2', P2: 'P1' }
const PLAYER_IDS = ['P1', 'P2'] as const

function clonePlayer(player: Player): Player {
  return {
    ...player,
    head: { ...player.head },
    trail: player.trail.map((p) => ({ ...p })),
  }
}

function cloneState(state: GameState): GameState {
  return {
    board: state.board.map((row) => row.map((cell) => ({ ...cell }))),
    players: {
      P1: clonePlayer(state.players.P1),
      P2: clonePlayer(state.players.P2),
    },
    round: state.round,
    status: state.status,
    result: state.result ? { ...state.result } : undefined,
  }
}

function samePos(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y
}

function territorySize(state: GameState, player: PlayerId): number {
  let count = 0
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.territory === player) count++
    }
  }
  return count
}

export function resolveRound(
  state: GameState,
  moveP1: Direction,
  moveP2: Direction
): { state: GameState; events: GameEvent[] } {
  if (state.status !== 'PLAYING') {
    throw new Error('Game already finished')
  }

  // Шаг 1: валидация
  if (!getLegalMoves(state, 'P1').includes(moveP1)) {
    throw new Error(`Illegal move for P1: ${moveP1}`)
  }
  if (!getLegalMoves(state, 'P2').includes(moveP2)) {
    throw new Error(`Illegal move for P2: ${moveP2}`)
  }

  const events: GameEvent[] = []
  const working = cloneState(state)
  const moves: Record<PlayerId, Direction> = { P1: moveP1, P2: moveP2 }

  const oldHead: Record<PlayerId, Pos> = {
    P1: { ...state.players.P1.head },
    P2: { ...state.players.P2.head },
  }

  // Шаг 2: движение
  const newHead: Record<PlayerId, Pos> = { P1: oldHead.P1, P2: oldHead.P2 }
  for (const id of PLAYER_IDS) {
    const delta = DIRECTION_DELTA[moves[id]]
    const to = { x: oldHead[id].x + delta.x, y: oldHead[id].y + delta.y }
    newHead[id] = to
    working.players[id].head = to
    working.players[id].direction = moves[id]
    events.push({ type: 'MOVED', player: id, from: oldHead[id], to })
  }

  const finish = (result: { winner: PlayerId | 'DRAW'; reason: Reason }) => {
    working.status = 'FINISHED'
    working.result = result
    events.push({ type: 'GAME_OVER', winner: result.winner, reason: result.reason })
    return { state: working, events }
  }

  // Шаг 3: лоб в лоб
  const sameCell = samePos(newHead.P1, newHead.P2)
  const swapped = samePos(newHead.P1, oldHead.P2) && samePos(newHead.P2, oldHead.P1)
  if (sameCell || swapped) {
    const isHome = (id: PlayerId) =>
      state.board[newHead[id].y][newHead[id].x].territory === id
    const p1Home = isHome('P1')
    const p2Home = isHome('P2')

    let winner: PlayerId | 'DRAW'
    if (p1Home && !p2Home) winner = 'P1'
    else if (p2Home && !p1Home) winner = 'P2'
    else {
      const t1 = territorySize(state, 'P1')
      const t2 = territorySize(state, 'P2')
      winner = t1 === t2 ? 'DRAW' : t1 > t2 ? 'P1' : 'P2'
    }

    if (winner === 'DRAW') {
      working.players.P1.alive = false
      working.players.P2.alive = false
      events.push({ type: 'DIED', player: 'P1', reason: 'HEAD_ON', at: newHead.P1 })
      events.push({ type: 'DIED', player: 'P2', reason: 'HEAD_ON', at: newHead.P2 })
    } else {
      const loser = OTHER[winner]
      working.players[loser].alive = false
      events.push({ type: 'DIED', player: loser, reason: 'HEAD_ON', at: newHead[loser] })
    }
    return finish({ winner, reason: 'HEAD_ON' })
  }

  // Шаг 4: удары по следам (используем следы S0 — исходный state, ещё не мутирован)
  // at — клетка удара: куда встала голова, наступившая на след.
  const death: Record<PlayerId, { reason: Reason; at: Pos } | null> = { P1: null, P2: null }
  for (const id of PLAYER_IDS) {
    const at = newHead[id]
    const cell = state.board[at.y][at.x]
    if (cell.trail === OTHER[id]) {
      if (death[OTHER[id]] === null) death[OTHER[id]] = { reason: 'TRAIL_CUT', at }
    } else if (cell.trail === id) {
      if (death[id] === null) death[id] = { reason: 'SELF_TRAIL', at }
    }
  }

  if (death.P1 || death.P2) {
    const p1Died = death.P1 !== null
    const p2Died = death.P2 !== null
    for (const id of PLAYER_IDS) {
      const d = death[id]
      if (!d) continue
      working.players[id].alive = false
      events.push({ type: 'DIED', player: id, reason: d.reason, at: d.at })
    }
    if (p1Died && p2Died) {
      return finish({ winner: 'DRAW', reason: 'MUTUAL' })
    }
    const loser: PlayerId = p1Died ? 'P1' : 'P2'
    return finish({ winner: OTHER[loser], reason: death[loser]!.reason })
  }

  // Шаг 5: захваты (оба вычисляются от состояния после шага 2, до применения любого захвата)
  const capturedCells: Record<PlayerId, Pos[]> = { P1: [], P2: [] }
  for (const id of PLAYER_IDS) {
    const onOwnTerritory = state.board[newHead[id].y][newHead[id].x].territory === id
    if (onOwnTerritory && state.players[id].trail.length > 0) {
      capturedCells[id] = computeCapture(working, id)
    }
  }

  const key = (p: Pos) => p.y * BOARD_SIZE + p.x
  const claimedBy: Record<PlayerId, Set<number>> = {
    P1: new Set(capturedCells.P1.map(key)),
    P2: new Set(capturedCells.P2.map(key)),
  }
  const bothClaim = (pos: Pos) => claimedBy.P1.has(key(pos)) && claimedBy.P2.has(key(pos))

  // Для каждого поглощённого — первая клетка его следа, попавшая в захват.
  const engulfedAt: Record<PlayerId, Pos | null> = { P1: null, P2: null }
  for (const id of PLAYER_IDS) {
    if (capturedCells[id].length === 0) continue
    const enemy = OTHER[id]
    const applied: Pos[] = []
    let stolenFromEnemy = 0
    for (const pos of capturedCells[id]) {
      const cell = working.board[pos.y][pos.x]
      // Оба захватчика очищают свои следы, поэтому слой trail чистится и на пересечении.
      cell.trail = 'NONE'
      // Пересечение не вызывает ENGULFED и не попадает в CAPTURED (шаг 5, v0.4).
      if (bothClaim(pos)) continue
      const before = state.board[pos.y][pos.x]
      if (before.trail === enemy && !engulfedAt[enemy]) engulfedAt[enemy] = pos
      if (before.territory === enemy) stolenFromEnemy++
      cell.territory = id
      applied.push(pos)
    }
    working.players[id].trail = []
    events.push({ type: 'CAPTURED', player: id, cells: applied, stolenFromEnemy })
  }

  if (engulfedAt.P1 || engulfedAt.P2) {
    for (const id of PLAYER_IDS) {
      const at = engulfedAt[id]
      if (!at) continue
      // След погибшего от ENGULFED снимается целиком (шаг 5, v0.4).
      for (const pos of working.players[id].trail) {
        working.board[pos.y][pos.x].trail = 'NONE'
      }
      working.players[id].trail = []
      working.players[id].alive = false
      events.push({ type: 'DIED', player: id, reason: 'ENGULFED', at })
    }
    if (engulfedAt.P1 && engulfedAt.P2) {
      return finish({ winner: 'DRAW', reason: 'MUTUAL' })
    }
    const loser: PlayerId = engulfedAt.P1 ? 'P1' : 'P2'
    return finish({ winner: OTHER[loser], reason: 'ENGULFED' })
  }

  // Шаг 6: обновление следов
  for (const id of PLAYER_IDS) {
    const head = working.players[id].head
    const onOwnTerritory = working.board[head.y][head.x].territory === id
    if (!onOwnTerritory) {
      if (working.players[id].trail.length === 0) {
        events.push({ type: 'TRAIL_STARTED', player: id })
      }
      working.players[id].trail.push({ ...head })
      working.board[head.y][head.x].trail = id
    }
  }

  // Шаг 7: конец раунда
  const finalTerritory: Record<PlayerId, number> = {
    P1: territorySize(working, 'P1'),
    P2: territorySize(working, 'P2'),
  }
  const noTerritory = PLAYER_IDS.filter((id) => finalTerritory[id] === 0)
  for (const loser of noTerritory) {
    working.players[loser].alive = false
    events.push({ type: 'DIED', player: loser, reason: 'NO_TERRITORY', at: working.players[loser].head })
  }
  if (noTerritory.length === 2) {
    return finish({ winner: 'DRAW', reason: 'NO_TERRITORY' })
  }
  if (noTerritory.length === 1) {
    return finish({ winner: OTHER[noTerritory[0]], reason: 'NO_TERRITORY' })
  }

  working.round += 1

  if (working.round >= MAX_ROUNDS) {
    if (finalTerritory.P1 === finalTerritory.P2) {
      return finish({ winner: 'DRAW', reason: 'ROUND_LIMIT' })
    }
    const winner: PlayerId = finalTerritory.P1 > finalTerritory.P2 ? 'P1' : 'P2'
    return finish({ winner, reason: 'ROUND_LIMIT' })
  }

  return { state: working, events }
}
