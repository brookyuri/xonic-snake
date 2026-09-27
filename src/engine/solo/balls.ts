import type { Cell, Pos } from '../types'
import type { Ball } from './types'

/** Для шарика препятствие — земля или край поля. След препятствием не является. */
export function isWall(board: readonly (readonly Cell[])[], x: number, y: number): boolean {
  const size = board.length
  if (x < 0 || y < 0 || x >= size || y >= size) return true
  return board[y][x].territory !== 'NONE'
}

/**
 * Один шаг шарика (SOLO_RULES.md раздел 4). Отскоки проверяются по исходной скорости:
 * 1) сосед по x — стена → dx = −dx; 2) сосед по y — стена → dy = −dy;
 * 3) ни то, ни другое, но стена по диагонали (угол) → разворот обеих компонент;
 * 4) если целевая клетка после разворотов свободна — шаг, иначе шарик стоит (тупик).
 */
export function moveBall(board: readonly (readonly Cell[])[], ball: Ball): Ball {
  const { x, y } = ball.pos
  let { dx, dy } = ball.vel
  const blockedX = isWall(board, x + dx, y)
  const blockedY = isWall(board, x, y + dy)
  if (blockedX) dx = -dx as typeof dx
  if (blockedY) dy = -dy as typeof dy
  if (!blockedX && !blockedY && isWall(board, x + dx, y + dy)) {
    dx = -dx as typeof dx
    dy = -dy as typeof dy
  }
  const target: Pos = { x: x + dx, y: y + dy }
  const pos = isWall(board, target.x, target.y) ? { x, y } : target
  return { pos, vel: { dx, dy } }
}
