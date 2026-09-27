import { INNER_CELLS, MAX_LIVES, SOLO_BOARD_SIZE, ballsForLevel } from './config'
import type { SoloState } from './types'

function fail(id: string, message: string): never {
  throw new Error(`Invariant ${id} violated: ${message}`)
}

/**
 * SOLO_RULES.md раздел 9, S1–S6. prev — состояние до тика: для S3 (прогресс внутри
 * уровня не убывает). Дополнительно — те же проверки следа, что I4/I5 в Duel.
 */
export function assertSoloInvariants(state: SoloState, prev?: SoloState): void {
  const { board, player, balls } = state
  const N = SOLO_BOARD_SIZE
  if (board.length !== N) fail('board', `board has ${board.length} rows, not ${N}`)
  for (let y = 0; y < N; y++) if (board[y].length !== N) fail('board', `row ${y} is not ${N} wide`)

  // S1: шарик никогда не стоит на земле.
  for (const b of balls) {
    if (b.pos.x < 0 || b.pos.y < 0 || b.pos.x >= N || b.pos.y >= N) fail('S1', `ball out of board at (${b.pos.x},${b.pos.y})`)
    if (board[b.pos.y][b.pos.x].territory !== 'NONE') fail('S1', `ball on land at (${b.pos.x},${b.pos.y})`)
    if (Math.abs(b.vel.dx) !== 1 || Math.abs(b.vel.dy) !== 1) fail('S1', `ball velocity is not diagonal`)
  }

  // Один проход по доске: следы (S2), земля внутреннего поля (S3), рамка (S6).
  // Проверяется после каждого тика в stress (1.4 млн раз), поэтому без вызовов в цикле.
  let boardTrail = 0
  let inner = 0
  const last = N - 1
  for (let y = 0; y < N; y++) {
    const row = board[y]
    const frameRow = y === 0 || y === last
    for (let x = 0; x < N; x++) {
      const cell = row[x]
      if (cell.trail !== 'NONE') boardTrail++
      if (frameRow || x === 0 || x === last) {
        if (cell.territory !== 'P1') fail('S6', `frame cell (${x},${y}) is not land`)
      } else if (cell.territory === 'P1') inner++
    }
  }

  // S2: слой trail совпадает с player.trail.
  for (const p of player.trail) {
    if (board[p.y][p.x].trail !== 'P1') fail('S2', `trail cell (${p.x},${p.y}) missing on the board`)
    if (board[p.y][p.x].territory === 'P1') fail('S2', `trail cell (${p.x},${p.y}) is land`)
  }
  if (boardTrail !== player.trail.length) fail('S2', `board has ${boardTrail} trail cells, player.trail ${player.trail.length}`)
  for (let i = 1; i < player.trail.length; i++) {
    const a = player.trail[i - 1]
    const b = player.trail[i]
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) fail('S2', `trail (${a.x},${a.y}) -> (${b.x},${b.y}) not adjacent`)
  }

  // S3: 0 ≤ progress ≤ 1, совпадает с доской; внутри уровня не убывает.
  if (state.progress < 0 || state.progress > 1) fail('S3', `progress ${state.progress}`)
  if (Math.abs(state.progress - inner / INNER_CELLS) > 1e-9) fail('S3', `progress ${state.progress} != board ${inner / INNER_CELLS}`)
  if (prev && prev.level === state.level && state.progress < prev.progress) {
    fail('S3', `progress went down ${prev.progress} -> ${state.progress}`)
  }

  // S4: 1 ≤ lives ≤ 5 пока PLAYING.
  if (state.status === 'PLAYING' && (state.lives < 1 || state.lives > MAX_LIVES)) fail('S4', `lives ${state.lives}`)
  if (state.lives < 0 || state.lives > MAX_LIVES) fail('S4', `lives ${state.lives}`)

  // S5: число шариков = level + 1.
  if (balls.length !== ballsForLevel(state.level)) fail('S5', `${balls.length} balls on level ${state.level}`)

  // Голова: на своей земле с пустым следом или на последней клетке следа (как I4 в Duel).
  if (state.status === 'PLAYING' || state.status === 'LEVEL_COMPLETE') {
    const { head } = player
    const home = board[head.y][head.x].territory === 'P1'
    const end = player.trail[player.trail.length - 1]
    if (home && player.trail.length > 0) fail('head', `home at (${head.x},${head.y}) with a trail`)
    if (!home && (!end || end.x !== head.x || end.y !== head.y)) fail('head', `head (${head.x},${head.y}) is not the trail end`)
  }
}
