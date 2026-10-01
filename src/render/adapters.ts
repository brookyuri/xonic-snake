import { SOLO_DIFFICULTY, difficultyOf, type Ball, type SoloEvent, type SoloState } from '../engine/solo'
import type { Cell, Direction, GameEvent, GameState, Player, PlayerId, Pos } from '../engine/types'
import type { BallView, BoardVariant, RenderSnapshot, SnakeView } from './types'

const samePos = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y

/**
 * Откуда голова пришла за последний тик. Берётся из события MOVED, только если оно ведёт
 * в текущую клетку головы: после возрождения или нового уровня события старые — тогда
 * голова стоит на месте (без интерполяции через всё поле).
 */
function snakeView(player: Player, moved: { from: Pos; to: Pos } | undefined): SnakeView {
  const prevHead = moved && samePos(moved.to, player.head) ? moved.from : player.head
  return {
    id: player.id,
    trail: player.trail,
    head: player.head,
    prevHead,
    direction: player.direction,
    alive: player.alive,
  }
}

/** Кадр Duel: обе змейки (BLUE, затем RED — RED рисуется сверху, как в 1986). */
export function snapshotFromDuel(state: GameState, events: readonly GameEvent[] = []): RenderSnapshot {
  const moved = (id: PlayerId) => {
    const e = events.find((ev) => ev.type === 'MOVED' && ev.player === id)
    return e?.type === 'MOVED' ? e : undefined
  }
  return {
    variant: 'duel',
    cols: state.board[0].length,
    rows: state.board.length,
    board: state.board,
    snakes: [snakeView(state.players.P1, moved('P1')), snakeView(state.players.P2, moved('P2'))],
    balls: [],
  }
}

/** Шарики: prev из BALLS_MOVED того же тика (по индексу и только если шарик там, куда пришёл). */
function ballViews(balls: readonly Ball[], events: readonly SoloEvent[]): BallView[] {
  const e = events.find((ev) => ev.type === 'BALLS_MOVED')
  const moves = e?.type === 'BALLS_MOVED' ? e.balls : []
  return balls.map((b, i) => {
    const m = moves[i]
    return { pos: b.pos, prev: m && samePos(m.to, b.pos) ? m.from : b.pos }
  })
}

/** Кадр Solo: одна змейка и шарики. */
export function snapshotFromSolo(state: SoloState, events: readonly SoloEvent[] = []): RenderSnapshot {
  const e = events.find((ev) => ev.type === 'MOVED')
  return {
    variant: 'solo',
    cols: state.board[0].length,
    rows: state.board.length,
    board: state.board,
    snakes: [snakeView(state.player, e?.type === 'MOVED' ? e : undefined)],
    balls: ballViews(state.balls, events),
    // Easy: шарики ходят через тик (SOLO_RULES v0.3, раздел 13).
    ballSpan: SOLO_DIFFICULTY[difficultyOf(state)].ballStepEvery,
  }
}

/** Неподвижная схема (HOW TO PLAY): клетки, головы и шарики без движения. */
export function staticSnapshot(
  variant: BoardVariant,
  board: readonly (readonly Cell[])[],
  heads: readonly { id: PlayerId; pos: Pos; direction: Direction }[],
  balls: readonly Pos[] = []
): RenderSnapshot {
  return {
    variant,
    cols: board[0].length,
    rows: board.length,
    board,
    snakes: heads.map(({ id, pos, direction }) => ({
      id,
      trail: [],
      head: pos,
      prevHead: pos,
      direction,
      alive: true,
    })),
    balls: balls.map((pos) => ({ pos, prev: pos })),
  }
}
