import type { Cell, GameState, PlayerId, Pos } from './types'

const NEIGHBORS: Pos[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
]

export interface CaptureOptions {
  /**
   * Duel (GAME_RULES.md, 7.3): если ни одна из excludedCells не лежит в компоненте
   * (голова врага стоит на земле игрока), исключается самая большая компонента,
   * при равенстве — все самые большие. Solo это правило не использует.
   */
  excludeLargestIfNoneFound?: boolean
}

/**
 * Алгоритм захвата (GAME_RULES.md раздел 7, SOLO_RULES.md раздел 6).
 * Препятствия = земля player ∪ след player. Остальные клетки — компоненты
 * связности (4-соседство). Компонента исключается, если содержит любую из
 * excludedCells. Захват = клетки следа + все неисключённые компоненты.
 * Размер поля берётся из board (Duel 15×15, Solo 20×20).
 */
export function computeCapture(
  board: readonly (readonly Cell[])[],
  player: PlayerId,
  excludedCells: readonly Pos[],
  opts: CaptureOptions = {}
): Pos[] {
  const height = board.length
  const width = height > 0 ? board[0].length : 0

  const isObstacle = (x: number, y: number) =>
    board[y][x].territory === player || board[y][x].trail === player

  const componentOf: number[][] = board.map((row) => row.map(() => -1))
  const components: Pos[][] = []
  const trail: Pos[] = []

  for (let sy = 0; sy < height; sy++) {
    for (let sx = 0; sx < width; sx++) {
      if (board[sy][sx].trail === player) trail.push({ x: sx, y: sy })
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
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          if (componentOf[ny][nx] !== -1 || isObstacle(nx, ny)) continue
          componentOf[ny][nx] = id
          queue.push({ x: nx, y: ny })
        }
      }
      components.push(cells)
    }
  }

  const excluded = new Set<number>()
  for (const p of excludedCells) {
    const id = componentOf[p.y]?.[p.x] ?? -1
    if (id !== -1) excluded.add(id)
  }
  if (excluded.size === 0 && opts.excludeLargestIfNoneFound) {
    const maxSize = Math.max(0, ...components.map((c) => c.length))
    components.forEach((c, i) => {
      if (c.length === maxSize) excluded.add(i)
    })
  }

  const captured: Pos[] = trail
  components.forEach((cells, i) => {
    if (!excluded.has(i)) captured.push(...cells)
  })
  return captured
}

/**
 * Захват в Duel: исключается компонента с головой врага, а если голова врага на
 * земле игрока — самая большая (раздел 7.3).
 */
export function computeDuelCapture(state: GameState, player: PlayerId): Pos[] {
  const enemy: PlayerId = player === 'P1' ? 'P2' : 'P1'
  return computeCapture(state.board, player, [state.players[enemy].head], { excludeLargestIfNoneFound: true })
}
