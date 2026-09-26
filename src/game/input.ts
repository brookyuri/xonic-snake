import { OPPOSITE_DIRECTION } from '../engine/constants'
import { getLegalMoves } from '../engine/moves'
import type { Direction, GameState, PlayerId } from '../engine/types'

/** Раздел 5.1.1: в очереди не больше двух направлений. */
export const MAX_QUEUE = 2

const CLOCKWISE: Direction[] = ['UP', 'RIGHT', 'DOWN', 'LEFT']

/**
 * Добавить нажатие в очередь (5.1.1). Нажатие игнорируется, если равно последнему
 * направлению в очереди (или текущему, если очередь пуста), противоположно ему,
 * или очередь уже полна. Возвращает новую очередь; вход не мутируется.
 */
export function enqueueDirection(
  queue: readonly Direction[],
  current: Direction,
  pressed: Direction
): Direction[] {
  if (queue.length >= MAX_QUEUE) return [...queue]
  const last = queue.length > 0 ? queue[queue.length - 1] : current
  if (pressed === last || pressed === OPPOSITE_DIRECTION[last]) return [...queue]
  return [...queue, pressed]
}

/** Последнее направление, которое змейка получит: хвост очереди или текущее. */
export function lastQueuedDirection(queue: readonly Direction[], current: Direction): Direction {
  return queue.length > 0 ? queue[queue.length - 1] : current
}

/**
 * Ход без нажатия (5.1): текущее направление, а при упоре в стену — первый
 * допустимый по часовой стрелке от него (UP → RIGHT → DOWN → LEFT).
 */
export function straightOrClockwise(state: GameState, player: PlayerId): Direction {
  const legal = getLegalMoves(state, player)
  const current = state.players[player].direction
  const start = CLOCKWISE.indexOf(current)
  for (let i = 0; i < CLOCKWISE.length; i++) {
    const dir = CLOCKWISE[(start + i) % CLOCKWISE.length]
    if (legal.includes(dir)) return dir
  }
  // По 5.2 у игрока всегда есть допустимый ход — сюда не попадаем.
  throw new Error(`No legal move for ${player}`)
}

/**
 * Ход человека на тике: одно направление из очереди (каждый тик забирает одно),
 * иначе движение прямо / по часовой у стены. Нажатие в стену отбрасывается, ход —
 * по правилу 5.1, следующий элемент очереди остаётся на следующий тик (5.1.1).
 */
export function takeHumanMove(
  state: GameState,
  player: PlayerId,
  queue: readonly Direction[]
): { move: Direction; queue: Direction[] } {
  const [next, ...rest] = queue
  if (next && getLegalMoves(state, player).includes(next)) return { move: next, queue: rest }
  return { move: straightOrClockwise(state, player), queue: rest }
}
