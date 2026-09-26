import { BOARD_SIZE } from './constants'
import type { GameState, PlayerId, Pos } from './types'

const NEIGHBORS: Pos[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
]

/**
 * Раздел 7 GAME_RULES.md. Возвращает клетки, которые захватывает `player`:
 * его след + все компоненты связности не-препятствий, кроме исключённых.
 * Препятствия = территория player ∪ след player.
 */
export function computeCapture(state: GameState, player: PlayerId): Pos[] {
  const enemy: PlayerId = player === 'P1' ? 'P2' : 'P1'
  const { board } = state

  const isObstacle = (x: number, y: number) =>
    board[y][x].territory === player || board[y][x].trail === player

  const componentOf: number[][] = board.map((row) => row.map(() => -1))
  const components: Pos[][] = []

  for (let sy = 0; sy < BOARD_SIZE; sy++) {
    for (let sx = 0; sx < BOARD_SIZE; sx++) {
      if (componentOf[sy][sx] !== -1 || isObstacle(sx, sy)) continue
      const id = components.length
      const cells: Pos[] = []
      const queue: Pos[] = [{ x: sx, y: sy }]
      componentOf[sy][sx] = id
      while (queue.length > 0) {
        const cur = queue.pop()!
        cells.push(cur)
        for (const d of NEIGHBORS) {
          const nx = cur.x + d.x
          const ny = cur.y + d.y
          if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue
          if (componentOf[ny][nx] !== -1 || isObstacle(nx, ny)) continue
          componentOf[ny][nx] = id
          queue.push({ x: nx, y: ny })
        }
      }
      components.push(cells)
    }
  }

  const excluded = new Set<number>()
  const enemyHead = state.players[enemy].head
  const headComponent = componentOf[enemyHead.y][enemyHead.x]
  if (headComponent !== -1) {
    excluded.add(headComponent)
  } else {
    const maxSize = Math.max(0, ...components.map((c) => c.length))
    components.forEach((c, i) => {
      if (c.length === maxSize) excluded.add(i)
    })
  }

  const captured: Pos[] = state.players[player].trail.map((p) => ({ ...p }))
  components.forEach((cells, i) => {
    if (!excluded.has(i)) captured.push(...cells)
  })
  return captured
}
