import { BOARD_SIZE } from './constants'
import type { GameState, PlayerId } from './types'

const PLAYER_IDS: PlayerId[] = ['P1', 'P2']

function fail(id: string, message: string): never {
  throw new Error(`Invariant ${id} violated: ${message}`)
}

/** Раздел 13 GAME_RULES.md, I1–I7. Бросает Error с номером нарушенного инварианта. */
export function assertInvariants(state: GameState): void {
  const { board, players } = state
  const playing = state.status === 'PLAYING'
  const territory: Record<PlayerId, number> = { P1: 0, P2: 0 }
  const boardTrailCount: Record<PlayerId, number> = { P1: 0, P2: 0 }

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = board[y][x]
      if (cell.territory !== 'NONE') territory[cell.territory]++
      if (cell.trail !== 'NONE') boardTrailCount[cell.trail]++
    }
  }

  for (const id of PLAYER_IDS) {
    const trail = players[id].trail

    // I1: trail-слой доски ⇔ player.trail
    for (const p of trail) {
      if (board[p.y][p.x].trail !== id) {
        fail('I1', `${id}.trail contains (${p.x},${p.y}) but board.trail there is ${board[p.y][p.x].trail}`)
      }
    }
    if (boardTrailCount[id] !== trail.length) {
      fail('I1', `board has ${boardTrailCount[id]} ${id} trail cells, ${id}.trail has ${trail.length}`)
    }

    // I2: след игрока не лежит на его территории
    for (const p of trail) {
      if (board[p.y][p.x].territory === id) {
        fail('I2', `${id} trail cell (${p.x},${p.y}) is ${id}'s own territory`)
      }
    }

    // I5: соседние клетки следа — 4-соседи
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1]
      const b = trail[i]
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) {
        fail('I5', `${id} trail (${a.x},${a.y}) -> (${b.x},${b.y}) are not 4-neighbors`)
      }
    }
  }

  // I3: следы не пересекаются (пока игра идёт)
  if (playing) {
    const p1 = new Set(players.P1.trail.map((p) => p.y * BOARD_SIZE + p.x))
    for (const p of players.P2.trail) {
      if (p1.has(p.y * BOARD_SIZE + p.x)) fail('I3', `trails intersect at (${p.x},${p.y})`)
    }
  }

  // I4: голова живого игрока — дома с пустым следом или на последней клетке следа.
  // Только пока игра идёт: после окончания на шагах 3–5 шаг 6 не выполнялся.
  if (playing) {
    for (const id of PLAYER_IDS) {
      const { head, trail, alive } = players[id]
      if (!alive) continue
      const home = board[head.y][head.x].territory === id
      if (home && trail.length > 0) {
        fail('I4', `${id} is home at (${head.x},${head.y}) but has a trail of ${trail.length}`)
      }
      if (!home) {
        const last = trail[trail.length - 1]
        if (!last || last.x !== head.x || last.y !== head.y) {
          fail('I4', `${id} head (${head.x},${head.y}) is outside home and not the last trail cell`)
        }
      }
    }
  }

  // I6
  if (territory.P1 + territory.P2 > BOARD_SIZE * BOARD_SIZE) {
    fail('I6', `territory sum ${territory.P1 + territory.P2} exceeds ${BOARD_SIZE * BOARD_SIZE}`)
  }

  // I7
  if (playing) {
    for (const id of PLAYER_IDS) {
      if (territory[id] <= 0) fail('I7', `${id} has no territory while PLAYING`)
    }
    if (state.round >= state.maxRounds) {
      fail('I7', `round ${state.round} >= maxRounds ${state.maxRounds} while PLAYING`)
    }
  }
}
