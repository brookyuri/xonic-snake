import type { Cell, Player } from './types'

/**
 * Обновление следа (GAME_RULES.md шаг 6, SOLO_RULES.md шаг 6): голова не на своей
 * земле → клетка головы добавляется в след и на доску. Мутирует рабочие копии board
 * и player. Возвращает true, если след только что начался (событие TRAIL_STARTED).
 */
export function extendTrail(board: Cell[][], player: Player): boolean {
  const { head } = player
  if (board[head.y][head.x].territory === player.id) return false
  const started = player.trail.length === 0
  player.trail.push({ ...head })
  board[head.y][head.x].trail = player.id
  return started
}
