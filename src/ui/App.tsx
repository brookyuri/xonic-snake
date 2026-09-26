import { useCallback, useEffect, useRef, useState } from 'react'
import { createInitialState } from '../engine/state'
import { assertInvariants } from '../engine/invariants'
import { getLegalMoves } from '../engine/moves'
import { resolveRound } from '../engine/resolve'
import { BOARD_SIZE } from '../engine/constants'
import type { Direction, GameState, PlayerId } from '../engine/types'
import { randomBot } from '../bot/randomBot'
import { Board, FLASH_MS, type Flash } from './Board'
import { DPad } from './DPad'
import { GameOverScreen } from './GameOverScreen'

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  w: 'UP',
  s: 'DOWN',
  a: 'LEFT',
  d: 'RIGHT',
}

function territoryPercent(state: GameState, player: PlayerId): number {
  let count = 0
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.territory === player) count++
    }
  }
  return Math.round((count / (BOARD_SIZE * BOARD_SIZE)) * 100)
}

export function App() {
  const [state, setState] = useState<GameState>(createInitialState)
  const stateRef = useRef(state)
  const [flash, setFlash] = useState<Flash | null>(null)
  const flashId = useRef(0)

  const commit = useCallback((next: GameState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const handleMove = useCallback(
    (direction: Direction) => {
      const current = stateRef.current
      if (current.status !== 'PLAYING') return
      if (!getLegalMoves(current, 'P1').includes(direction)) return
      // Раздел 5.1: ход бота вычисляется от состояния до хода человека.
      const botMove = randomBot(current)
      const { state: next, events } = resolveRound(current, direction, botMove)
      if (import.meta.env.DEV) {
        try {
          assertInvariants(next)
        } catch (error) {
          console.error(error)
        }
      }
      commit(next)

      const captured = new Map<number, PlayerId>()
      for (const event of events) {
        if (event.type !== 'CAPTURED') continue
        for (const c of event.cells) captured.set(c.y * BOARD_SIZE + c.x, event.player)
      }
      if (captured.size > 0) {
        const id = ++flashId.current
        setFlash({ cells: captured, lit: true })
        // Два кадра: сначала рисуем яркую подсветку, затем отпускаем её — CSS transition гасит за 300ms.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (flashId.current === id) setFlash({ cells: captured, lit: false })
          })
        )
        setTimeout(() => {
          if (flashId.current === id) setFlash(null)
        }, FLASH_MS + 50)
      }
    },
    [commit]
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const direction = KEY_TO_DIRECTION[event.key]
      if (direction) {
        event.preventDefault()
        handleMove(direction)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleMove])

  const legalMoves = state.status === 'PLAYING' ? getLegalMoves(state, 'P1') : []
  const bluePercent = territoryPercent(state, 'P1')
  const redPercent = territoryPercent(state, 'P2')

  return (
    <div className="min-h-screen bg-neutral-950 flex justify-center">
      <div className="relative w-full max-w-[420px] px-4 py-4 flex flex-col gap-4">
        <div className="flex items-center justify-between text-sm font-semibold tracking-wide">
          <span className="text-cyan-300">BLUE {bluePercent}%</span>
          <span className="text-neutral-500">Round {state.round}</span>
          <span className="text-red-300">RED {redPercent}%</span>
        </div>

        <Board state={state} flash={flash} />

        <div className="flex justify-center pt-2">
          <DPad legalMoves={legalMoves} onMove={handleMove} />
        </div>

        {state.status === 'FINISHED' && state.result && (
          <GameOverScreen
            result={state.result}
            bluePercent={bluePercent}
            redPercent={redPercent}
            onPlayAgain={() => commit(createInitialState())}
          />
        )}
      </div>
    </div>
  )
}
