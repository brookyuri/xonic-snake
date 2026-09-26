export type PlayerId = 'P1' | 'P2'

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

export interface Pos {
  x: number
  y: number
}

export type Owner = 'NONE' | PlayerId

export interface Cell {
  territory: Owner
  trail: Owner
}

export interface Player {
  id: PlayerId
  head: Pos
  direction: Direction
  trail: Pos[]
  alive: boolean
}

export type Status = 'PLAYING' | 'FINISHED'

export type Reason =
  | 'TRAIL_CUT'
  | 'SELF_TRAIL'
  | 'ENGULFED'
  | 'HEAD_ON'
  | 'MUTUAL'
  | 'NO_TERRITORY'
  | 'ROUND_LIMIT'

/** Почему решилось лобовое столкновение (только при reason = HEAD_ON). */
export type HeadOnDetail = 'DEFENDER_HOME' | 'BIGGER_TERRITORY' | 'EQUAL'

export interface GameResult {
  winner: PlayerId | 'DRAW'
  reason: Reason
}

export interface GameState {
  board: Cell[][]
  players: Record<PlayerId, Player>
  round: number
  /** Лимит матча: при round == maxRounds партия заканчивается по ROUND_LIMIT. */
  maxRounds: number
  status: Status
  result?: GameResult
}

export type GameEvent =
  | { type: 'MOVED'; player: PlayerId; from: Pos; to: Pos }
  | { type: 'TRAIL_STARTED'; player: PlayerId }
  | { type: 'CAPTURED'; player: PlayerId; cells: Pos[]; stolenFromEnemy: number }
  /** at — клетка, которую показывает экран конца игры (удар, поглощённый след, голова). */
  | { type: 'DIED'; player: PlayerId; reason: Reason; at: Pos }
  | { type: 'GAME_OVER'; winner: PlayerId | 'DRAW'; reason: Reason; detail?: HeadOnDetail }
