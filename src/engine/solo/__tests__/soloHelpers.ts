import type { Direction, Pos } from '../../types'
import { SOLO_BOARD_SIZE } from '../config'
import { assertSoloInvariants } from '../invariants'
import { resolveSoloTick } from '../resolve'
import { progressOf } from '../state'
import type { Ball, SoloState, Unit } from '../types'

const N = SOLO_BOARD_SIZE

/** Пустое поле уровня: рамка из земли, внутри пусто. */
export function frameGrid(): string[] {
  return Array.from({ length: N }, (_, y) => (y === 0 || y === N - 1 ? '#'.repeat(N) : `#${'.'.repeat(N - 2)}#`))
}

/** Наложить фрагмент на сетку, левый верхний угол фрагмента — (x, y). Пробел — «не трогать». */
export function put(grid: string[], x: number, y: number, fragment: string[]): string[] {
  const out = [...grid]
  fragment.forEach((line, dy) => {
    const row = [...out[y + dy]]
    ;[...line].forEach((ch, dx) => {
      if (ch !== ' ') row[x + dx] = ch
    })
    out[y + dy] = row.join('')
  })
  return out
}

/**
 * SoloState из ASCII-сетки 20×20: '#' земля, 't' след, '1' голова, 'o' шарик на
 * пустой клетке, '.' пусто. Скорости шариков — явно, в порядке обхода сетки (строка
 * за строкой). Голова на земле, если след пуст, иначе — конец следа. Порядок следа
 * восстанавливается от головы; если он неоднозначен — передайте trail явно.
 */
export function soloFromGrid(
  rows: string[],
  opts: {
    vel: [Unit, Unit][]
    direction?: Direction
    trail?: Pos[]
    level?: number
    lives?: number
    score?: number
    seed?: number
    headOn?: 'land' | 'trail'
  }
): SoloState {
  if (rows.length !== N || rows.some((r) => r.length !== N)) throw new Error(`grid must be ${N}×${N}`)
  let head: Pos | null = null
  const ballPos: Pos[] = []
  const trailCells: Pos[] = []
  const board = rows.map((row, y) =>
    [...row].map((ch, x) => {
      if (ch === '1') head = { x, y }
      if (ch === 'o') ballPos.push({ x, y })
      if (ch === 't') trailCells.push({ x, y })
      return { territory: ch === '#' ? ('P1' as const) : ('NONE' as const), trail: ch === 't' ? ('P1' as const) : ('NONE' as const) }
    })
  )
  if (!head) throw new Error('grid has no head')
  const h: Pos = head
  const headOn = opts.headOn ?? (trailCells.length > 0 ? 'trail' : 'land')
  if (headOn === 'land') board[h.y][h.x].territory = 'P1'
  else board[h.y][h.x].trail = 'P1'

  let trail: Pos[] = []
  if (headOn === 'trail') {
    if (opts.trail) trail = opts.trail
    else {
      const key = (p: Pos) => `${p.x},${p.y}`
      const left = new Set(trailCells.map(key))
      const order = [h]
      let cur = h
      for (;;) {
        const next = [
          { x: cur.x + 1, y: cur.y },
          { x: cur.x - 1, y: cur.y },
          { x: cur.x, y: cur.y + 1 },
          { x: cur.x, y: cur.y - 1 },
        ].filter((p) => left.has(key(p)))
        if (next.length === 0) break
        if (next.length > 1) throw new Error(`ambiguous trail at (${cur.x},${cur.y}); pass opts.trail`)
        left.delete(key(next[0]))
        order.push(next[0])
        cur = next[0]
      }
      if (left.size > 0) throw new Error('trail is not one chain; pass opts.trail')
      trail = order.reverse()
    }
  }
  if (ballPos.length !== opts.vel.length) throw new Error(`${ballPos.length} balls but ${opts.vel.length} velocities`)
  const balls: Ball[] = ballPos.map((pos, i) => ({ pos, vel: { dx: opts.vel[i][0], dy: opts.vel[i][1] } }))

  return {
    board,
    player: { id: 'P1', head: h, direction: opts.direction ?? 'UP', trail, alive: true },
    balls,
    level: opts.level ?? 1,
    lives: opts.lives ?? 3,
    score: opts.score ?? 0,
    progress: progressOf(board),
    round: 0,
    status: 'PLAYING',
    seed: opts.seed ?? 1,
  }
}

/** resolveSoloTick + assertSoloInvariants (раздел 9) после каждого тика. */
export function play(state: SoloState, move: Direction) {
  const result = resolveSoloTick(state, move)
  assertSoloInvariants(result.state, state)
  return result
}
