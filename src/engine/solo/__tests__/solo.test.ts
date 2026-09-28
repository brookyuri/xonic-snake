import { describe, it, expect } from 'vitest'
import { mulberry32 } from '../../../bot/rng'
import type { Direction, Pos } from '../../types'
import { MAX_LIVES, SOLO_START } from '../config'
import { moveBall } from '../balls'
import { assertSoloInvariants } from '../invariants'
import { continueSolo, getLegalMoves, resolveSoloTick } from '../resolve'
import { createSoloState } from '../state'
import type { SoloEvent, SoloState } from '../types'
import { frameGrid, play, put, soloFromGrid } from './soloHelpers'

const ofType = <T extends SoloEvent['type']>(events: SoloEvent[], type: T) =>
  events.filter((e): e is Extract<SoloEvent, { type: T }> => e.type === type)

const landCount = (s: SoloState) => s.board.flat().filter((c) => c.territory === 'P1').length
const trailCount = (s: SoloState) => s.board.flat().filter((c) => c.trail === 'P1').length
const chebyshev = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

// Змейка вышла снизу из (9,19) вверх: след (9,18)…(9,16), голова (9,16), идёт UP.
const UP_TRAIL = put(frameGrid(), 9, 16, ['1', 't', 't'])

describe('ST01 — level start', () => {
  it('frame of 76 cells, 2 balls inside, far from the start, snake at (9,19) RIGHT', () => {
    const s = createSoloState({ seed: 42 })
    assertSoloInvariants(s)
    expect(landCount(s)).toBe(76)
    expect(s.progress).toBe(0)
    expect(s.balls).toHaveLength(2)
    expect(s.player.head).toEqual({ x: 9, y: 19 })
    expect(s.player.direction).toBe('RIGHT')
    expect(s.player.trail).toEqual([])
    expect(s.lives).toBe(3)
    expect(s.level).toBe(1)
    expect(s.status).toBe('PLAYING')
  })

  it('holds for many seeds and levels: inner field, distance ≥ 6, no shared cells', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const level of [1, 4, 9]) {
        const s = createSoloState({ seed, level })
        assertSoloInvariants(s)
        expect(s.balls).toHaveLength(level + 1)
        const keys = new Set(s.balls.map((b) => `${b.pos.x},${b.pos.y}`))
        expect(keys.size).toBe(s.balls.length)
        for (const b of s.balls) {
          expect(b.pos.x).toBeGreaterThanOrEqual(1)
          expect(b.pos.x).toBeLessThanOrEqual(18)
          expect(b.pos.y).toBeGreaterThanOrEqual(1)
          expect(b.pos.y).toBeLessThanOrEqual(18)
          expect(chebyshev(b.pos, SOLO_START.head)).toBeGreaterThanOrEqual(6)
          expect(Math.abs(b.vel.dx)).toBe(1)
          expect(Math.abs(b.vel.dy)).toBe(1)
        }
      }
    }
  })
})

describe('ST02 — bounces (rules 4.1–4.3)', () => {
  const board = createSoloState({ seed: 1 }).board

  it('4.1: wall on the x side flips dx', () => {
    expect(moveBall(board, { pos: { x: 1, y: 5 }, vel: { dx: -1, dy: 1 } })).toEqual({
      pos: { x: 2, y: 6 },
      vel: { dx: 1, dy: 1 },
    })
  })

  it('4.2: wall on the y side flips dy', () => {
    expect(moveBall(board, { pos: { x: 5, y: 1 }, vel: { dx: 1, dy: -1 } })).toEqual({
      pos: { x: 6, y: 2 },
      vel: { dx: 1, dy: 1 },
    })
  })

  it('4.1 + 4.2 in the frame corner: both flip', () => {
    expect(moveBall(board, { pos: { x: 1, y: 1 }, vel: { dx: -1, dy: -1 } })).toEqual({
      pos: { x: 2, y: 2 },
      vel: { dx: 1, dy: 1 },
    })
  })

  it('4.3: only the diagonal cell is land — the ball bounces straight back', () => {
    // Земля одной клеткой в (6,6); шарик в (5,5) летит (+1,+1).
    const s = soloFromGrid(put(put(put(UP_TRAIL, 6, 6, ['#']), 5, 5, ['o']), 15, 3, ['o']), {
      vel: [
        [1, 1],
        [1, 1],
      ],
    })
    const { state, events } = play(s, 'UP')
    const moved = ofType(events, 'BALLS_MOVED')[0].balls
    expect(moved[1]).toEqual({ from: { x: 5, y: 5 }, to: { x: 4, y: 4 } })
    expect(state.balls[1].vel).toEqual({ dx: -1, dy: -1 })
  })

  it('bounces off captured land inside the field, not only the frame', () => {
    // Земля — вертикальная стенка x = 8; шарик у неё летит влево-вниз.
    const s = soloFromGrid(put(put(put(UP_TRAIL, 8, 3, ['#', '#', '#']), 9, 4, ['o']), 15, 12, ['o']), {
      vel: [
        [-1, 1],
        [1, 1],
      ],
    })
    const { state } = play(s, 'UP')
    expect(state.balls[0]).toEqual({ pos: { x: 10, y: 5 }, vel: { dx: 1, dy: 1 } })
  })
})

describe('ST03 — dead end', () => {
  it('a ball boxed in by land stays put for the tick', () => {
    const g = put(UP_TRAIL, 4, 4, ['###', '#o#', '###'])
    const s = soloFromGrid(put(g, 15, 3, ['o']), {
      vel: [
        [1, 1],
        [1, 1],
      ],
    })
    const { state, events } = play(s, 'UP')
    const box = s.balls.findIndex((b) => b.pos.x === 5 && b.pos.y === 5)
    expect(state.balls[box].pos).toEqual({ x: 5, y: 5 })
    expect(ofType(events, 'BALLS_MOVED')[0].balls[box]).toEqual({ from: { x: 5, y: 5 }, to: { x: 5, y: 5 } })
    // Рядом только земля — на следующем тике снова стоит.
    expect(play(state, 'UP').state.balls[box].pos).toEqual({ x: 5, y: 5 })
  })
})

describe('ST04 — a ball enters the trail', () => {
  it('BALL_HIT: trail removed, land kept; continueSolo respawns by 2.1', () => {
    // Захваченный блок 3×3 у левого верхнего угла — должен остаться.
    let g = put(UP_TRAIL, 1, 1, ['###', '###', '###'])
    g = put(g, 10, 18, ['o']) // летит (−1,−1) в клетку следа (9,17)
    g = put(g, 15, 3, ['o'])
    const s = soloFromGrid(g, {
      vel: [
        [1, 1],
        [-1, -1],
      ],
    })
    const land = landCount(s)
    const { state, events } = play(s, 'UP')
    expect(ofType(events, 'LIFE_LOST')).toEqual([{ type: 'LIFE_LOST', reason: 'BALL_HIT', at: { x: 9, y: 17 }, livesLeft: 2 }])
    expect(state.status).toBe('LIFE_LOST')
    expect(state.lives).toBe(2)
    expect(trailCount(state)).toBe(0)
    expect(state.player.trail).toEqual([])
    expect(landCount(state)).toBe(land)
    // На тике потери жизни round не растёт (раздел 7).
    expect(state.round).toBe(s.round)
    // Шарики остаются где были (после своего шага в этом тике).
    expect(state.balls.map((b) => b.pos)).toEqual([
      { x: 16, y: 4 },
      { x: 9, y: 17 },
    ])
    // Дальше — снова PLAYING с тем же полем. Шарики (16,4) и (9,17): до (9,19) — 2,
    // до (0,9) — 9, до (10,0) — 6, до (19,10) — 6 → возрождение слева.
    const next = continueSolo(state)
    assertSoloInvariants(next)
    expect(next.status).toBe('PLAYING')
    expect(next.board).toEqual(state.board)
    expect(next.player.head).toEqual({ x: 0, y: 9 })
    expect(next.player.direction).toBe('DOWN')
  })
})

describe('ST14 — respawn point (2.1)', () => {
  /** Состояние сразу после потери жизни с шариками в заданных клетках. */
  function lostWithBalls(...balls: Pos[]): SoloState {
    // Шарики задаются напрямую: два шарика могут стоять в одной клетке (раздел 4).
    const s = soloFromGrid(put(frameGrid(), 9, 19, ['1']), { vel: [], headOn: 'land' })
    return { ...s, balls: balls.map((pos) => ({ pos, vel: { dx: 1, dy: 1 } })), status: 'LIFE_LOST', lives: 2 }
  }
  const respawn = (s: SoloState) => {
    const next = continueSolo(s)
    assertSoloInvariants(next)
    return { head: next.player.head, direction: next.player.direction, trail: next.player.trail }
  }

  it('a ball at the bottom edge: the farthest middle of a side, not (9,19)', () => {
    // До (9,19): 2; до (0,9): 9; до (10,0): 17; до (19,10): 9.
    expect(respawn(lostWithBalls({ x: 9, y: 17 }, { x: 10, y: 17 }))).toEqual({
      head: { x: 10, y: 0 },
      direction: 'LEFT',
      trail: [],
    })
  })

  it('each side can win, with its own direction along the frame', () => {
    expect(respawn(lostWithBalls({ x: 17, y: 2 }, { x: 16, y: 3 })).head).toEqual({ x: 9, y: 19 })
    // (9,17) и (18,15): до (9,19) — 2, (0,9) — 9, (10,0) — 15, (19,10) — 5.
    expect(respawn(lostWithBalls({ x: 9, y: 17 }, { x: 18, y: 15 }))).toMatchObject({ head: { x: 10, y: 0 }, direction: 'LEFT' })
    expect(respawn(lostWithBalls({ x: 17, y: 9 }, { x: 16, y: 10 }))).toMatchObject({ head: { x: 0, y: 9 }, direction: 'DOWN' })
    expect(respawn(lostWithBalls({ x: 2, y: 9 }, { x: 3, y: 10 }))).toMatchObject({ head: { x: 19, y: 10 }, direction: 'UP' })
  })

  it('equal distances: the first in the listed order wins', () => {
    // Шарик в (9,9): до (9,19) — 10, до (0,9) — 9, до (10,0) — 9, до (19,10) — 10 → первая из равных — (9,19).
    expect(respawn(lostWithBalls({ x: 9, y: 9 }, { x: 9, y: 9 }))).toMatchObject({ head: { x: 9, y: 19 }, direction: 'RIGHT' })
    // Шарик в (5,5): до (9,19) — 14, до (0,9) — 5, до (10,0) — 5, до (19,10) — 14 → снова (9,19), не (19,10).
    expect(respawn(lostWithBalls({ x: 5, y: 5 }, { x: 5, y: 5 })).head).toEqual({ x: 9, y: 19 })
    // Шарик в (14,14): (9,19) — 5, (0,9) — 14, (10,0) — 14, (19,10) — 5 → (0,9), не (10,0).
    expect(respawn(lostWithBalls({ x: 14, y: 14 }, { x: 14, y: 14 })).head).toEqual({ x: 0, y: 9 })
  })

  it('a new level still starts at (9,19) RIGHT', () => {
    const s = createSoloState({ seed: 11, level: 3 })
    expect(s.player.head).toEqual({ x: 9, y: 19 })
    expect(s.player.direction).toBe('RIGHT')
  })
})

describe('ST05 — the head drives into a ball', () => {
  it('BALL_HIT on step 4, the balls have not moved yet', () => {
    const s = soloFromGrid(put(put(UP_TRAIL, 9, 15, ['o']), 15, 3, ['o']), {
      vel: [
        [1, 1],
        [1, 1],
      ],
    })
    const { state, events } = play(s, 'UP')
    expect(ofType(events, 'LIFE_LOST')[0]).toMatchObject({ reason: 'BALL_HIT', at: { x: 9, y: 15 } })
    expect(ofType(events, 'BALLS_MOVED')).toEqual([])
    expect(state.balls).toEqual(s.balls)
  })
})

describe('ST06 — head and ball pass through each other', () => {
  it('BALL_HIT through step 8 on the old head cell', () => {
    // Голова (9,16) → (9,15); шарик (10,15) → (9,16).
    const s = soloFromGrid(put(put(UP_TRAIL, 10, 15, ['o']), 15, 3, ['o']), {
      vel: [
        [1, 1],
        [-1, 1],
      ],
    })
    const { events } = play(s, 'UP')
    expect(ofType(events, 'LIFE_LOST')).toEqual([{ type: 'LIFE_LOST', reason: 'BALL_HIT', at: { x: 9, y: 16 }, livesLeft: 2 }])
    expect(ofType(events, 'BALLS_MOVED')).toHaveLength(1)
  })
})

describe('ST07 — own trail', () => {
  it('SELF_TRAIL', () => {
    // Крючок: (9,18) (9,17) (9,16) (10,16) (10,17), голова (10,17) идёт DOWN, поворот LEFT → (9,17).
    const g = put(put(frameGrid(), 9, 16, ['tt', 't1', 't.']), 15, 3, ['o'])
    const s = soloFromGrid(put(g, 3, 3, ['o']), {
      vel: [
        [1, 1],
        [1, 1],
      ],
      direction: 'DOWN',
      trail: [
        { x: 9, y: 18 },
        { x: 9, y: 17 },
        { x: 9, y: 16 },
        { x: 10, y: 16 },
        { x: 10, y: 17 },
      ],
    })
    const { state, events } = play(s, 'LEFT')
    expect(ofType(events, 'LIFE_LOST')).toEqual([{ type: 'LIFE_LOST', reason: 'SELF_TRAIL', at: { x: 9, y: 17 }, livesLeft: 2 }])
    expect(trailCount(state)).toBe(0)
  })
})

/** Вертикальный след x = 9 от низа до y = 1, голова (9,1) идёт UP в рамку. */
function splitBoard(balls: Pos[]): SoloState {
  const col = Array.from({ length: 18 }, (_, i) => (i === 0 ? '1' : 't'))
  let g = put(frameGrid(), 9, 1, col)
  for (const b of balls) g = put(g, b.x, b.y, ['o'])
  return soloFromGrid(g, { vel: balls.map(() => [1, 1] as [1, 1]) })
}

describe('ST08 — capture skips areas with balls', () => {
  it('the ball-free side is captured, the side with balls is not', () => {
    const s = splitBoard([
      { x: 3, y: 5 },
      { x: 5, y: 12 },
    ])
    const { state, events } = play(s, 'UP')
    const captured = ofType(events, 'CAPTURED')[0]
    // след 18 + правая половина 9×18
    expect(captured.cells).toHaveLength(18 + 162)
    expect(captured.points).toBe(180)
    expect(state.score).toBe(180)
    expect(state.board[5][14].territory).toBe('P1')
    expect(state.board[5][3].territory).toBe('NONE')
    expect(state.progress).toBeCloseTo(180 / 324)
    expect(state.player.trail).toEqual([])
    expect(state.status).toBe('PLAYING')
  })
})

describe('ST09 — balls in every area', () => {
  it('only the trail is captured', () => {
    const s = splitBoard([
      { x: 3, y: 5 },
      { x: 14, y: 5 },
    ])
    const { state, events } = play(s, 'UP')
    expect(ofType(events, 'CAPTURED')[0].cells).toHaveLength(18)
    expect(state.progress).toBeCloseTo(18 / 324)
  })
})

describe('ST10 — level complete', () => {
  // Верх поля (y 1..9) уже земля: 162 клетки. След x = 9 от y = 18 до y = 10, голова (9,10) → UP.
  // Захват: след 9 + правый нижний блок 9×9 = 90 → 252 / 324 = 77.7%.
  function nearlyDone(lives: number): SoloState {
    let g = frameGrid()
    for (let y = 1; y <= 9; y++) g = put(g, 1, y, ['#'.repeat(18)])
    g = put(g, 9, 10, ['1', ...Array(8).fill('t')])
    g = put(g, 3, 14, ['o'])
    g = put(g, 5, 12, ['o'])
    return soloFromGrid(g, {
      vel: [
        [1, 1],
        [1, 1],
      ],
      lives,
    })
  }

  it('bonus by formula, +1 life, then a new level with 3 balls', () => {
    const { state, events } = play(nearlyDone(3), 'UP')
    expect(ofType(events, 'CAPTURED')[0].points).toBe(90)
    // 77% → 2 полных процента сверх 75: 100×1 + 50×1×2
    expect(ofType(events, 'LEVEL_COMPLETE')).toEqual([{ type: 'LEVEL_COMPLETE', level: 1, bonus: 200 }])
    expect(state.status).toBe('LEVEL_COMPLETE')
    expect(state.score).toBe(290)
    expect(state.lives).toBe(4)

    const next = continueSolo(state)
    assertSoloInvariants(next)
    expect(next.level).toBe(2)
    expect(next.balls).toHaveLength(3)
    expect(next.lives).toBe(4)
    expect(next.score).toBe(290)
    expect(next.progress).toBe(0)
    expect(landCount(next)).toBe(76)
    expect(next.player.head).toEqual({ x: 9, y: 19 })
    expect(next.round).toBe(0)
  })

  it('lives never go above 5', () => {
    expect(play(nearlyDone(MAX_LIVES), 'UP').state.lives).toBe(MAX_LIVES)
  })
})

describe('ST11 — last life', () => {
  it('GAME_OVER after LIFE_LOST', () => {
    const s = soloFromGrid(put(put(UP_TRAIL, 9, 15, ['o']), 15, 3, ['o']), {
      vel: [
        [1, 1],
        [1, 1],
      ],
      lives: 1,
      level: 1,
      score: 70,
    })
    const { state, events } = play(s, 'UP')
    expect(events.slice(-2)).toEqual([
      { type: 'LIFE_LOST', reason: 'BALL_HIT', at: { x: 9, y: 15 }, livesLeft: 0 },
      { type: 'GAME_OVER', level: 1, score: 70 },
    ])
    expect(state.status).toBe('GAME_OVER')
    expect(state.lives).toBe(0)
    expect(() => resolveSoloTick(state, 'RIGHT')).toThrow()
    expect(() => continueSolo(state)).toThrow()
  })
})

/** Случайная, но воспроизводимая партия: ходы из rng, после паузы — continueSolo. */
function randomGame(seed: number, moveSeed: number, ticks: number): { states: string[]; final: SoloState } {
  const rng = mulberry32(moveSeed)
  let s = createSoloState({ seed })
  const states: string[] = []
  for (let i = 0; i < ticks && s.status !== 'GAME_OVER'; i++) {
    if (s.status !== 'PLAYING') s = continueSolo(s)
    const legal = getLegalMoves(s, 'P1').filter((d) => s.board[s.player.head.y + dy(d)][s.player.head.x + dx(d)].trail === 'NONE')
    const options = legal.length ? legal : getLegalMoves(s, 'P1')
    s = play(s, options[Math.floor(rng() * options.length)]).state
    states.push(JSON.stringify(s))
  }
  return { states, final: s }
}
const dx = (d: Direction) => (d === 'LEFT' ? -1 : d === 'RIGHT' ? 1 : 0)
const dy = (d: Direction) => (d === 'UP' ? -1 : d === 'DOWN' ? 1 : 0)

describe('ST12 — determinism', () => {
  it('one seed + the same moves → the same game', () => {
    const a = randomGame(7, 99, 400)
    const b = randomGame(7, 99, 400)
    expect(a.states).toEqual(b.states)
  })

  it('another seed → other balls', () => {
    expect(createSoloState({ seed: 7 }).balls).not.toEqual(createSoloState({ seed: 8 }).balls)
  })
})

describe('Solo purity and legality', () => {
  it('resolveSoloTick does not mutate its input', () => {
    const s = createSoloState({ seed: 3 })
    const copy = JSON.parse(JSON.stringify(s))
    resolveSoloTick(s, 'UP')
    expect(s).toEqual(copy)
  })

  it('throws on an illegal move (reverse, wall)', () => {
    const s = createSoloState({ seed: 3 })
    expect(getLegalMoves(s, 'P1')).toEqual(['UP', 'RIGHT'])
    expect(() => resolveSoloTick(s, 'LEFT')).toThrow()
    expect(() => resolveSoloTick(s, 'DOWN')).toThrow()
  })

  it('riding along own land leaves no trail', () => {
    let s = createSoloState({ seed: 3 })
    for (let i = 0; i < 5; i++) s = play(s, 'RIGHT').state
    expect(s.player.head).toEqual({ x: 14, y: 19 })
    expect(s.player.trail).toEqual([])
    expect(s.round).toBe(5)
  })
})
