import { BOARD_SIZE, MAX_ROUNDS, START } from './constants'
import type { Cell, GameState, Player, PlayerId } from './types'

function createEmptyBoard(): Cell[][] {
  const board: Cell[][] = []
  for (let y = 0; y < BOARD_SIZE; y++) {
    const row: Cell[] = []
    for (let x = 0; x < BOARD_SIZE; x++) {
      row.push({ territory: 'NONE', trail: 'NONE' })
    }
    board.push(row)
  }
  return board
}

function createStartPlayer(id: PlayerId): Player {
  const start = START[id]
  return {
    id,
    head: { ...start.head },
    direction: start.direction,
    trail: [],
    alive: true,
  }
}

export function createInitialState(opts: { maxRounds?: number } = {}): GameState {
  const board = createEmptyBoard()

  for (const id of ['P1', 'P2'] as const) {
    const { xMin, xMax, yMin, yMax } = START[id].territory
    for (let y = yMin; y <= yMax; y++) {
      for (let x = xMin; x <= xMax; x++) {
        board[y][x].territory = id
      }
    }
  }

  return {
    board,
    players: {
      P1: createStartPlayer('P1'),
      P2: createStartPlayer('P2'),
    },
    round: 0,
    maxRounds: opts.maxRounds ?? MAX_ROUNDS,
    status: 'PLAYING',
  }
}
