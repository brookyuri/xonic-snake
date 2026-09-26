import type { GameEvent, GameState, PlayerId, Pos } from '../engine/types'

export interface EndSummary {
  title: string
  reason: string
  /** Клетки, которые подсвечиваются на поле (удар, поглощённый след, столкновение). */
  highlight: Pos[]
}

function cellsOf(state: GameState, player: PlayerId): number {
  let n = 0
  for (const row of state.board) for (const cell of row) if (cell.territory === player) n++
  return n
}

function onOwnTerritory(state: GameState, player: PlayerId): boolean {
  const { head } = state.players[player]
  return state.board[head.y][head.x].territory === player
}

/** Итог партии с точки зрения человека (P1 = "You"). */
export function describeEnd(state: GameState, events: GameEvent[]): EndSummary {
  const { winner, reason } = state.result!
  const title = winner === 'DRAW' ? 'DRAW' : winner === 'P1' ? 'YOU WIN' : 'RED WINS'
  const loser: PlayerId | null = winner === 'DRAW' ? null : winner === 'P1' ? 'P2' : 'P1'

  const highlight: Pos[] = []
  for (const e of events) {
    if (e.type !== 'DIED') continue
    if (!highlight.some((p) => p.x === e.at.x && p.y === e.at.y)) highlight.push(e.at)
  }

  let text: string
  switch (reason) {
    case 'TRAIL_CUT':
      text = loser === 'P1' ? 'RED cut your trail' : "You cut RED's trail"
      break
    case 'SELF_TRAIL':
      text = loser === 'P1' ? 'You crossed your own trail' : 'RED crossed its own trail'
      break
    case 'HEAD_ON':
      // На шаге 3 доска не меняется, поэтому «дома ли голова» читается из итогового состояния.
      if (winner === 'DRAW') text = 'Head-on draw'
      else if (onOwnTerritory(state, winner) && !onOwnTerritory(state, loser!))
        text = winner === 'P2' ? 'Head-on! RED was at home' : 'Head-on! You were at home'
      else text = 'Head-on! Bigger territory wins'
      break
    case 'ENGULFED':
      text = loser === 'P1' ? 'RED enclosed your trail' : "You enclosed RED's trail"
      break
    case 'MUTUAL':
      text = 'Both trails cut — draw'
      break
    case 'NO_TERRITORY':
      text =
        loser === 'P1'
          ? 'Your territory was taken'
          : loser === 'P2'
            ? "RED's territory was taken"
            : 'Both territories were taken — draw'
      break
    case 'ROUND_LIMIT':
      text = `Time's up — ${cellsOf(state, 'P1')} vs ${cellsOf(state, 'P2')} cells`
      break
  }

  return { title, reason: text, highlight }
}
