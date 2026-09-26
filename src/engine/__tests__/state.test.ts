import { describe, it, expect } from 'vitest'
import { createInitialState } from '../state'
import { BOARD_SIZE } from '../constants'

describe('createInitialState', () => {
  it('matches GAME_RULES.md section 3 start position', () => {
    const state = createInitialState()

    expect(state.round).toBe(0)
    expect(state.status).toBe('PLAYING')

    expect(state.players.P1.head).toEqual({ x: 7, y: 12 })
    expect(state.players.P1.direction).toBe('UP')
    expect(state.players.P1.trail).toEqual([])
    expect(state.players.P1.alive).toBe(true)

    expect(state.players.P2.head).toEqual({ x: 7, y: 2 })
    expect(state.players.P2.direction).toBe('DOWN')
    expect(state.players.P2.trail).toEqual([])
    expect(state.players.P2.alive).toBe(true)

    for (let y = 11; y <= 13; y++) {
      for (let x = 6; x <= 8; x++) {
        expect(state.board[y][x].territory).toBe('P1')
        expect(state.board[y][x].trail).toBe('NONE')
      }
    }
    for (let y = 1; y <= 3; y++) {
      for (let x = 6; x <= 8; x++) {
        expect(state.board[y][x].territory).toBe('P2')
        expect(state.board[y][x].trail).toBe('NONE')
      }
    }
  })

  it('is vertically symmetric between P1 and P2', () => {
    const state = createInitialState()
    const mirrorY = (y: number) => BOARD_SIZE - 1 - y

    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const cell = state.board[y][x]
        const mirrored = state.board[mirrorY(y)][x]
        if (cell.territory === 'P1') expect(mirrored.territory).toBe('P2')
        if (cell.territory === 'P2') expect(mirrored.territory).toBe('P1')
        if (cell.territory === 'NONE') expect(mirrored.territory).toBe('NONE')
      }
    }

    expect(state.players.P1.head).toEqual({
      x: state.players.P2.head.x,
      y: mirrorY(state.players.P2.head.y),
    })
    expect(state.players.P1.direction).toBe('UP')
    expect(state.players.P2.direction).toBe('DOWN')
  })
})
