import { computeCapture } from '../capture'
import { DIRECTION_DELTA } from '../constants'
import { legalMovesFrom } from '../moves'
import { extendTrail } from '../trail'
import type { Direction, Pos } from '../types'
import { moveBall } from './balls'
import { BALL_STEP_EVERY, LEVEL_TARGET, MAX_LIVES, SOLO_BOARD_SIZE, levelBonus } from './config'
import { createSoloState, innerLand, isFrame, progressOf, respawnPlayer } from './state'
import type { LifeLostReason, SoloEvent, SoloState } from './types'

/** Те же допустимые ходы, что в Duel (раздел 5.2), на поле 20×20. */
export function getLegalMoves(state: SoloState, _player: 'P1' = 'P1'): Direction[] {
  return legalMovesFrom(state.player.head, state.player.direction, SOLO_BOARD_SIZE)
}

/**
 * Рабочая копия для тика. Доска копируется по строкам при первой записи: за тик
 * обычно меняется 0–1 клетка из 400, а неизменённые строки остаются общими со входом
 * (вход не мутируется — он просто делит с результатом строки, которые никто не менял).
 */
function workingCopy(state: SoloState) {
  const board = state.board.slice()
  const copied = new Array<boolean>(board.length).fill(false)
  const w: SoloState = {
    ...state,
    board,
    player: { ...state.player, head: { ...state.player.head }, trail: state.player.trail.map((p) => ({ ...p })) },
    balls: state.balls.map((b) => ({ pos: { ...b.pos }, vel: { ...b.vel } })),
  }
  /** Строка y доски, которую можно менять. */
  const row = (y: number) => {
    if (!copied[y]) {
      board[y] = board[y].map((cell) => ({ territory: cell.territory, trail: cell.trail }))
      copied[y] = true
    }
    return board[y]
  }
  return { w, row }
}

const samePos = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y

/**
 * Разрешение тика Solo (SOLO_RULES.md раздел 5, порядок строго фиксирован).
 * Чистая функция: вход не мутируется.
 */
export function resolveSoloTick(state: SoloState, move: Direction): { state: SoloState; events: SoloEvent[] } {
  if (state.status !== 'PLAYING') throw new Error(`Solo tick while ${state.status}`)

  // 1. Валидация хода (как в Duel).
  if (!getLegalMoves(state).includes(move)) throw new Error(`Illegal move: ${move}`)

  const events: SoloEvent[] = []
  const { w, row } = workingCopy(state)
  const player = w.player

  // 2. Движение змейки.
  const from = { ...player.head }
  const delta = DIRECTION_DELTA[move]
  const to = { x: from.x + delta.x, y: from.y + delta.y }
  player.head = to
  player.direction = move
  events.push({ type: 'MOVED', from, to })

  const loseLife = (reason: LifeLostReason, at: Pos) => {
    // След удаляется, захваченная земля остаётся, шарики где были. Голова остаётся в
    // клетке удара: в точку возрождения (2.1) змейку ставит continueSolo.
    // round на тике потери жизни не увеличивается (раздел 7).
    for (const p of player.trail) row(p.y)[p.x].trail = 'NONE'
    player.trail = []
    w.lives -= 1
    events.push({ type: 'LIFE_LOST', reason, at: { ...at }, livesLeft: w.lives })
    if (w.lives <= 0) {
      w.lives = 0
      w.status = 'GAME_OVER'
      events.push({ type: 'GAME_OVER', level: w.level, score: w.score })
    } else {
      w.status = 'LIFE_LOST'
    }
    return { state: w, events }
  }

  // 3. Свой след.
  if (state.board[to.y][to.x].trail === 'P1') return loseLife('SELF_TRAIL', to)

  // 4. Голова (вне своей земли) — в клетку с шариком.
  const onLand = state.board[to.y][to.x].territory === 'P1'
  if (!onLand && state.balls.some((b) => samePos(b.pos, to))) return loseLife('BALL_HIT', to)

  // 5. Захват: исключаются компоненты с шариками (шарики ещё не двигались).
  if (onLand && player.trail.length > 0) {
    const cells = computeCapture(
      w.board,
      'P1',
      w.balls.map((b) => b.pos)
    )
    let inner = 0
    for (const c of cells) {
      const cell = row(c.y)[c.x]
      cell.territory = 'P1'
      cell.trail = 'NONE'
      if (!isFrame(c.x, c.y)) inner++
    }
    player.trail = []
    const points = inner * w.level
    w.score += points
    w.progress = progressOf(w.board)
    events.push({ type: 'CAPTURED', cells, points })
  }

  // 6. Обновление следа.
  row(player.head.y)
  if (extendTrail(w.board, player)) events.push({ type: 'TRAIL_STARTED' })

  // 7. Движение шариков — по доске после захвата.
  if (state.round % BALL_STEP_EVERY === 0) {
    const moved = w.balls.map((b) => moveBall(w.board, b))
    events.push({
      type: 'BALLS_MOVED',
      balls: w.balls.map((b, i) => ({ from: b.pos, to: moved[i].pos })),
    })
    w.balls = moved
  }

  // 8. Шарик в след (включая клетку головы).
  const hit = w.balls.find((b) => w.board[b.pos.y][b.pos.x].trail === 'P1')
  if (hit) return loseLife('BALL_HIT', hit.pos)

  // 9. Уровень.
  if (w.progress >= LEVEL_TARGET) {
    const bonus = levelBonus(w.level, innerLand(w.board))
    w.score += bonus
    w.lives = Math.min(w.lives + 1, MAX_LIVES)
    w.status = 'LEVEL_COMPLETE'
    events.push({ type: 'LEVEL_COMPLETE', level: w.level, bonus })
  }

  // 10.
  w.round += 1
  return { state: w, events }
}

/**
 * Продолжение после паузы в игре (раздел 8).
 * - LIFE_LOST → PLAYING: змейка в точке возрождения по 2.1, поле и шарики те же.
 * - LEVEL_COMPLETE → новый уровень: доска снова рамка, шариков на один больше,
 *   жизни и очки переносятся.
 */
export function continueSolo(state: SoloState): SoloState {
  if (state.status === 'LIFE_LOST') return { ...state, player: respawnPlayer(state.balls), status: 'PLAYING' }
  if (state.status === 'LEVEL_COMPLETE') {
    return createSoloState({ seed: state.seed, level: state.level + 1, lives: state.lives, score: state.score })
  }
  throw new Error(`Nothing to continue from ${state.status}`)
}
