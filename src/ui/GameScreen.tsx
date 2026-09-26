import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { BOARD_SIZE } from '../engine/constants'
import { assertInvariants } from '../engine/invariants'
import type { Direction, GameState, PlayerId } from '../engine/types'
import { isTrailInDanger } from '../bot/analysis'
import { easyBotSteps } from '../bot/easyBot'
import { normalBotSteps } from '../bot/normalBot'
import { FINAL_SECONDS, formatClock, maxRoundsFor, SPEEDS, timeLeftMs } from '../game/config'
import { lastQueuedDirection } from '../game/input'
import { MatchController } from '../game/match'
import { Board, FLASH_MS, type Flash } from './Board'
import { DPad } from './DPad'
import { GameOverScreen } from './GameOverScreen'
import { PauseScreen } from './PauseScreen'
import { describeEnd } from './endText'
import { HeldFlag, MessageFeed } from './messageFeed'
import { DANGER_MESSAGE, describeRound } from './roundText'
import type { Settings } from './settings'
import { markLastGameRematch, recordAbandoned, recordGame } from './stats'
import { swipeDirection } from './swipe'
import { perfEnabled, recordTick } from './perf'

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  w: 'UP',
  s: 'DOWN',
  a: 'LEFT',
  d: 'RIGHT',
  W: 'UP',
  S: 'DOWN',
  A: 'LEFT',
  D: 'RIGHT',
}

/** Сколько бот может думать за один кусок между кадрами, мс. */
const BOT_SLICE_MS = 8

function territoryCells(state: GameState, player: PlayerId): number {
  let count = 0
  for (const row of state.board) for (const cell of row) if (cell.territory === player) count++
  return count
}

function territoryPercent(state: GameState, player: PlayerId): number {
  return Math.round((territoryCells(state, player) / (BOARD_SIZE * BOARD_SIZE)) * 100)
}

interface Props {
  settings: Settings
  onMenu: () => void
}

/** Экран игры. Каждый матч — отдельный Match с новым key: рестарт сбрасывает всё. */
export function GameScreen({ settings, onMenu }: Props) {
  const [matchId, setMatchId] = useState(0)
  const restart = useCallback((afterFinishedGame: boolean) => {
    if (afterFinishedGame) markLastGameRematch()
    setMatchId((id) => id + 1)
  }, [])
  return <Match key={matchId} settings={settings} onMenu={onMenu} onRestart={restart} />
}

interface MatchProps extends Props {
  onRestart: (afterFinishedGame: boolean) => void
}

function Match({ settings, onMenu, onRestart }: MatchProps) {
  const tickMs = SPEEDS[settings.speed]
  const [controller] = useState(
    () =>
      new MatchController({
        tickMs,
        maxRounds: maxRoundsFor(tickMs),
        bot: settings.difficulty === 'easy' ? easyBotSteps : normalBotSteps,
        strict: import.meta.env.DEV,
      })
  )
  const subscribe = useCallback((listener: () => void) => controller.subscribe(listener), [controller])
  const snap = useSyncExternalStore(subscribe, () => controller.snapshot)
  const { state, phase, events, ticks } = snap

  const [flash, setFlash] = useState<Flash | null>(null)
  const flashId = useRef(0)
  const feed = useRef(new MessageFeed())
  const danger = useRef(new HeldFlag())
  const match = useRef({ startedAt: new Date().toISOString(), captures: 0, recorded: false })

  // Цикл кадров: контроллер сам решает, пора ли тикать.
  useEffect(() => {
    let frame = requestAnimationFrame(function loop() {
      controller.frame()
      frame = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(frame)
  }, [controller])

  /**
   * Брошенная партия (RESTART / MENU с паузы, уход со страницы): пишется в ts_games
   * с reason ABANDONED. Отсчёт до первого тика и уже записанные партии не пишутся.
   */
  const abandon = useCallback(() => {
    const { ticks: played, state: current, phase: now } = controller.snapshot
    if (played === 0 || now === 'FINISHED' || match.current.recorded) return
    match.current.recorded = true
    recordAbandoned({
      startedAt: match.current.startedAt,
      rounds: played,
      blueCells: territoryCells(current, 'P1'),
      redCells: territoryCells(current, 'P2'),
      captures: match.current.captures,
      difficulty: settings.difficulty,
      speed: settings.speed,
    })
  }, [controller, settings])

  // Закрытие вкладки или уход со страницы во время матча.
  useEffect(() => {
    window.addEventListener('pagehide', abandon)
    return () => window.removeEventListener('pagehide', abandon)
  }, [abandon])

  // Автопауза при сворачивании вкладки (5.1.2).
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) controller.pause()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [controller])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_TO_DIRECTION[event.key]
      if (direction) {
        event.preventDefault()
        controller.steer(direction)
      } else if (event.key === ' ' || event.key === 'p' || event.key === 'P') {
        event.preventDefault()
        controller.togglePause()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [controller])

  // Ход бота на следующий тик считаем после отрисовки текущего — кусками по BOT_SLICE_MS,
  // чтобы между кадрами не было длинных задач. Не успели к тику — контроллер досчитает сам.
  useEffect(() => {
    if (phase !== 'RUNNING' && phase !== 'COUNTDOWN') return
    let id = setTimeout(function slice() {
      if (!controller.prepareBotMove(BOT_SLICE_MS)) id = setTimeout(slice, 0)
    }, 0)
    return () => clearTimeout(id)
  }, [controller, phase, ticks])

  // ?perf: сколько прошло от начала тика до коммита DOM.
  useLayoutEffect(() => {
    if (!perfEnabled || ticks === 0) return
    recordTick({
      tick: ticks,
      at: snap.lastTickAt,
      costMs: snap.lastTickCostMs,
      botMs: controller.lastBotMs,
      commitMs: performance.now() - snap.lastTickAt,
    })
  }, [ticks]) // eslint-disable-line react-hooks/exhaustive-deps

  // Всё, что происходит один раз за тик.
  useEffect(() => {
    if (ticks === 0) return
    if (import.meta.env.DEV) {
      try {
        assertInvariants(state)
      } catch (error) {
        console.error(error)
      }
    }
    feed.current.push(describeRound(events), performance.now())

    const captured = new Map<number, PlayerId>()
    for (const event of events) {
      if (event.type !== 'CAPTURED') continue
      if (event.player === 'P1') match.current.captures++
      for (const c of event.cells) captured.set(c.y * BOARD_SIZE + c.x, event.player)
    }
    if (captured.size > 0) {
      const id = ++flashId.current
      setFlash({ cells: captured, lit: true })
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (flashId.current === id) setFlash({ cells: captured, lit: false })
        })
      )
      setTimeout(() => {
        if (flashId.current === id) setFlash(null)
      }, FLASH_MS + 50)
    }

    if (state.status === 'FINISHED' && !match.current.recorded) {
      match.current.recorded = true
      recordGame(
        {
          startedAt: match.current.startedAt,
          rounds: ticks,
          winner: state.result!.winner,
          reason: state.result!.reason,
          blueCells: territoryCells(state, 'P1'),
          redCells: territoryCells(state, 'P2'),
          captures: match.current.captures,
          difficulty: settings.difficulty,
          speed: settings.speed,
        },
        territoryPercent(state, 'P1')
      )
    }
  }, [ticks]) // eslint-disable-line react-hooks/exhaustive-deps

  const running = phase === 'RUNNING'
  const now = performance.now()
  const rawDanger = useMemo(() => state.status === 'PLAYING' && isTrailInDanger(state, 'P1'), [state])
  const inDanger = danger.current.update(running && rawDanger, now)
  const messages = [...feed.current.visible(now), ...(inDanger ? [DANGER_MESSAGE] : [])]

  const end = phase === 'FINISHED' ? describeEnd(state, events) : null
  const bluePercent = territoryPercent(state, 'P1')
  const redPercent = territoryPercent(state, 'P2')
  const timeLeft = timeLeftMs(state, tickMs)
  const finalSeconds = timeLeft <= FINAL_SECONDS * 1000 && phase !== 'FINISHED'
  const heading = lastQueuedDirection(snap.queue, state.players.P1.direction)
  const canSteer = phase === 'RUNNING' || phase === 'COUNTDOWN'

  // Свайп по полю: одно направление на жест, после порога 24px.
  const swipe = useRef<{ id: number; x: number; y: number; fired: boolean } | null>(null)

  return (
    <div className="screen">
      <div className="relative mx-auto flex h-full w-full max-w-[480px] flex-col px-4">
        <header className="pt-3">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
            <span className="w-20 text-cyan-300">BLUE {bluePercent}%</span>
            <span
              data-testid="timer"
              className={`flex-1 text-center text-lg tabular-nums ${finalSeconds ? 'timer-final text-red-300' : 'text-neutral-300'}`}
            >
              {formatClock(timeLeft)}
            </span>
            <span className="w-20 text-right text-red-300">RED {redPercent}%</span>
            <button
              type="button"
              aria-label="Pause"
              data-testid="pause"
              disabled={!canSteer}
              onClick={() => controller.pause()}
              className="-my-2 -mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-neutral-300 active:bg-neutral-800 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
                <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
              </svg>
            </button>
          </div>
          <div
            data-testid="event-line"
            aria-live="polite"
            className={`mt-0.5 h-5 truncate text-center text-sm ${inDanger ? 'text-amber-300' : 'text-neutral-300'}`}
          >
            {messages.join(' · ')}
          </div>
        </header>

        <div className="board-slot flex min-h-0 flex-1 items-center justify-center py-2">
          <Board
            state={state}
            flash={flash}
            moveMs={running ? tickMs : 0}
            dangerTrail={inDanger}
            highlight={end?.highlight}
            className="board-fit"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false }
              e.currentTarget.setPointerCapture?.(e.pointerId)
            }}
            onPointerMove={(e) => {
              const s = swipe.current
              if (!s || s.id !== e.pointerId || s.fired) return
              const direction = swipeDirection(e.clientX - s.x, e.clientY - s.y)
              if (direction) {
                s.fired = true
                controller.steer(direction)
              }
            }}
            onPointerUp={() => {
              swipe.current = null
            }}
          >
            {phase === 'COUNTDOWN' && snap.countdown > 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                <span key={snap.countdown} data-testid="countdown" className="countdown-number">
                  {snap.countdown}
                </span>
              </div>
            )}
          </Board>
        </div>

        <div className="flex justify-center pb-4 pt-2" data-testid="dpad">
          <DPad heading={heading} onSteer={(d) => controller.steer(d)} disabled={!canSteer} />
        </div>

        {phase === 'PAUSED' && (
          <PauseScreen
            onResume={() => controller.resume()}
            onRestart={() => {
              abandon()
              onRestart(false)
            }}
            onMenu={() => {
              abandon()
              onMenu()
            }}
          />
        )}

        {end && (
          <GameOverScreen
            title={end.title}
            reason={end.reason}
            bluePercent={bluePercent}
            redPercent={redPercent}
            onPlayAgain={() => onRestart(true)}
            onMenu={onMenu}
          />
        )}
      </div>
    </div>
  )
}
