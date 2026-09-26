import { getLegalMoves } from '../engine/moves'
import { resolveRound } from '../engine/resolve'
import type { Direction, GameState, PlayerId } from '../engine/types'
import {
  distanceHome,
  distanceToTrail,
  movesAvoidingOwnTrail,
  opponentOf,
  potentialCapture,
} from './analysis'
import { pick } from './rng'
import type { Bot } from './types'

/** Веса оценки позиции. Подбирались бенчмарком (src/bot/__tests__/benchmark.test.ts). */
export const NORMAL_CONFIG = {
  /** Оценка выигранной партии; проигрыш — −WIN. Должна перекрывать любую позиционную сумму. */
  WIN: 10_000,
  /** Ничья: лучше поражения, но хуже любой живой позиции — бот не размениваться на ничью. */
  DRAW_SCORE: -1_000,
  /** За каждую клетку разницы территорий (мои − противника). Базовая «валюта» оценки. */
  TERRITORY: 1,
  /** За клетку, которую я получу, замкнув след прямо сейчас. < TERRITORY, чтобы замыкать было выгоднее, чем держать. */
  POTENTIAL: 0.8,
  /** Дисконт потенциала за каждый шаг до дома сверх первого: тянет бота обратно, ограничивает размер петли. */
  POTENTIAL_DECAY: 0.85,
  /** Штраф, если противник успевает к моему следу не позже, чем я домой (ходы одновременные, «сначала удар»). */
  DANGER: 200,
  /** Штраф, если я успеваю домой ровно на один ход раньше — одна ошибка и след перерезан. */
  DANGER_NEAR: 25,
  /** Бонус за каждый ход запаса в гонке к следу противника (attackRace > 0). */
  ATTACK: 8,
  /** Потолок attackRace в бонусе — иначе бесконечный путь домой у противника даёт бесконечную оценку. */
  ATTACK_CAP: 5,
  /** Штраф за клетку собственного следа: регулятор жадности. */
  TRAIL_LENGTH: 0.05,
  /** Штраф за позицию, где любой мой ход ведёт на мой же след. */
  DEAD_END: 500,
  /** Доля худшего ответа противника в оценке хода; остальное — средний ответ. */
  MINMAX_WEIGHT: 0.7,
}

export type NormalConfig = typeof NORMAL_CONFIG

export interface Breakdown {
  /** ±WIN / DRAW_SCORE для законченной партии, иначе 0. */
  outcome: number
  territory: number
  potential: number
  danger: number
  attack: number
  greed: number
  deadEnd: number
  total: number
}

export interface ReplyEvaluation {
  reply: Direction
  breakdown: Breakdown
}

export interface MoveEvaluation {
  move: Direction
  score: number
  min: number
  mean: number
  replies: ReplyEvaluation[]
}

function territorySize(state: GameState, player: PlayerId): number {
  let count = 0
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.territory === player) count++
    }
  }
  return count
}

/** Оценка позиции с точки зрения `me` после раунда; разбита по компонентам. */
export function evaluate(
  state: GameState,
  me: PlayerId,
  config: NormalConfig = NORMAL_CONFIG
): Breakdown {
  const b: Breakdown = {
    outcome: 0,
    territory: 0,
    potential: 0,
    danger: 0,
    attack: 0,
    greed: 0,
    deadEnd: 0,
    total: 0,
  }
  const opp = opponentOf(me)

  if (state.status === 'FINISHED') {
    const winner = state.result!.winner
    b.outcome = winner === 'DRAW' ? config.DRAW_SCORE : winner === me ? config.WIN : -config.WIN
    b.total = b.outcome
    return b
  }

  b.territory = config.TERRITORY * (territorySize(state, me) - territorySize(state, opp))

  const myTrail = state.players[me].trail.length
  if (myTrail > 0) {
    const home = distanceHome(state, me)
    if (home !== Infinity) {
      const decay = Math.pow(config.POTENTIAL_DECAY, Math.max(0, home - 1))
      b.potential = config.POTENTIAL * potentialCapture(state, me) * decay
    }
    // Ничья по дистанции — противник успевает: ходы одновременные, удар раньше захвата.
    const race = distanceToTrail(state, opp, me) - home
    if (home === Infinity || race <= 0) b.danger = -config.DANGER
    else if (race === 1) b.danger = -config.DANGER_NEAR
    b.greed = -config.TRAIL_LENGTH * myTrail
  }

  if (state.players[opp].trail.length > 0) {
    const attackRace = distanceHome(state, opp) - distanceToTrail(state, me, opp)
    if (attackRace > 0) b.attack = config.ATTACK * Math.min(attackRace, config.ATTACK_CAP)
  }

  if (movesAvoidingOwnTrail(state, me).length === 0) b.deadEnd = -config.DEAD_END

  b.total = b.territory + b.potential + b.danger + b.attack + b.greed + b.deadEnd
  return b
}

/** Maximin на один раунд: каждый мой ход против каждого ответа противника. */
export function explainMove(
  state: GameState,
  player: PlayerId,
  config: NormalConfig = NORMAL_CONFIG
): MoveEvaluation[] {
  const opp = opponentOf(player)
  const replies = getLegalMoves(state, opp)

  return getLegalMoves(state, player)
    .map((move) => {
      const evaluated = replies.map((reply) => {
        const [moveP1, moveP2] = player === 'P1' ? [move, reply] : [reply, move]
        const next = resolveRound(state, moveP1, moveP2).state
        return { reply, breakdown: evaluate(next, player, config) }
      })
      const totals = evaluated.map((r) => r.breakdown.total)
      const min = Math.min(...totals)
      const mean = totals.reduce((a, t) => a + t, 0) / totals.length
      const score = config.MINMAX_WEIGHT * min + (1 - config.MINMAX_WEIGHT) * mean
      return { move, score, min, mean, replies: evaluated }
    })
    .sort((a, b) => b.score - a.score)
}

/** Бот уровня Normal. Видит только state; при равных оценках выбирает через rng. */
export const normalBot: Bot = (state, player, rng = Math.random) => {
  const moves = explainMove(state, player)
  const best = moves[0].score
  const tied = moves.filter((m) => best - m.score < 1e-9).map((m) => m.move)
  return pick(tied, rng)
}
