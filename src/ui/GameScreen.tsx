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
import { Board, type Flash } from './Board'
import { DPad } from './DPad'
import { GameOverScreen } from './GameOverScreen'
import { PauseScreen } from './PauseScreen'
import { describeEnd } from './endText'
import { HeldFlag, MESSAGE_HOLD_MS, MessageFeed } from './messageFeed'
import { describeRound, eventLines } from './roundText'
import type { Settings } from './settings'
import { markLastGameRematch, recordAbandoned, recordGame, unrecordAbandoned } from './stats'
import { swipeDirection } from './swipe'
import { createPerfRecorder, perfEnabled, perfReport, summarizePerf } from './perf'

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

/** Клетка столкновения мигает 3 раза по 320 мс, потом появляется GAME OVER. */
const DEATH_BLINK_MS = 960

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
  const [endVisible, setEndVisible] = useState(false)
  const flashId = useRef(0)
  // Одно событие за раз: вместе с угрозой строка событий — максимум две строки.
  const feed = useRef(new MessageFeed(MESSAGE_HOLD_MS, 1))
  const danger = useRef(new HeldFlag())
  const match = useRef({ startedAt: new Date().toISOString(), captures: 0, recorded: false })
  // Лениво: иначе рекордер (и window.__tsPerf) пересоздавался бы на каждом рендере.
  const [perfSamples] = useState(() => (perfEnabled ? createPerfRecorder() : null))

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
  const abandon = useCallback((): string | null => {
    const { ticks: played, state: current, phase: now } = controller.snapshot
    if (played === 0 || now === 'FINISHED' || match.current.recorded) return null
    match.current.recorded = true
    return recordAbandoned({
      startedAt: match.current.startedAt,
      rounds: played,
      blueCells: territoryCells(current, 'P1'),
      redCells: territoryCells(current, 'P2'),
      captures: match.current.captures,
      difficulty: settings.difficulty,
      speed: settings.speed,
    })
  }, [controller, settings])

  // Закрытие вкладки или уход со страницы во время матча. Если страница уходит в
  // bfcache (persisted), она может вернуться: запоминаем id записи, чтобы снять её.
  const bfcacheRecord = useRef<string | null>(null)
  useEffect(() => {
    const onPageHide = (event: PageTransitionEvent) => {
      const id = abandon()
      if (event.persisted) {
        bfcacheRecord.current = id
        controller.pause()
      }
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      // Вкладка вернулась: партия не брошена — снимаем запись и оставляем матч на паузе
      // (RESUME запустит отсчёт 3-2-1).
      if (bfcacheRecord.current) {
        unrecordAbandoned(bfcacheRecord.current)
        bfcacheRecord.current = null
        match.current.recorded = false
      }
      controller.pause()
    }
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [abandon, controller])

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
    if (!perfSamples || ticks === 0) return
    perfSamples.push({
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
    // Вспышка захвата — эффект, при prefers-reduced-motion не показываем.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (captured.size > 0 && !reduced) {
      const id = ++flashId.current
      // Захваченные клетки на один тик белые, затем сразу цвет земли — без плавного перехода.
      setFlash({ cells: captured })
      setTimeout(() => {
        if (flashId.current === id) setFlash(null)
      }, tickMs)
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

  // Конец партии: сначала мигает клетка столкновения, потом оверлей GAME OVER.
  useEffect(() => {
    if (phase !== 'FINISHED') return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const collision = describeEnd(controller.snapshot.state, controller.snapshot.events).highlight.length > 0
    const id = setTimeout(() => setEndVisible(true), collision && !reduced ? DEATH_BLINK_MS : 0)
    return () => clearTimeout(id)
  }, [phase, controller])

  const running = phase === 'RUNNING'
  const now = performance.now()
  const rawDanger = useMemo(() => state.status === 'PLAYING' && isTrailInDanger(state, 'P1'), [state])
  const inDanger = danger.current.update(running && rawDanger, now)
  const lines = eventLines(feed.current.visible(now), inDanger)

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
        {perfSamples && <PerfPanel summary={summarizePerf(perfSamples, tickMs)} />}
        <header className="pt-3">
          <div className="flex items-center gap-2 whitespace-nowrap font-pixel text-[10px]" data-testid="hud">
            <span className="shrink-0 text-ts-blue">BLUE {bluePercent}%</span>
            <span
              data-testid="timer"
              className={`flex-1 text-center text-xs text-ts-timer ${finalSeconds ? 'timer-final' : ''}`}
            >
              {formatClock(timeLeft)}
            </span>
            <span className="shrink-0 text-ts-red">RED {redPercent}%</span>
            <button
              type="button"
              aria-label="Pause"
              data-testid="pause"
              disabled={!canSteer}
              onClick={() => controller.pause()}
              className="-my-2 flex h-11 w-11 shrink-0 items-center justify-center btn text-ts-text"
            >
              <svg viewBox="0 0 7 7" shapeRendering="crispEdges" className="h-4 w-4" aria-hidden>
                <path d="M1 1h2v5H1zM4 1h2v5H4z" fill="currentColor" />
              </svg>
            </button>
          </div>
          <div
            data-testid="event-line"
            aria-live="polite"
            // Высота всегда под две строки (угроза + одно событие) — поле не прыгает.
            className="event-line flex h-[28px] flex-col items-center justify-center text-center"
          >
            {lines.map((line) => (
              <span key={line} className={line === lines[0] && inDanger ? 'text-ts-danger' : 'text-ts-text2'}>
                {line}
              </span>
            ))}
          </div>
        </header>

        <div className="board-slot flex min-h-0 flex-1 items-center justify-center py-1">
          <Board
            state={state}
            flash={flash}
            loading={phase === 'COUNTDOWN'}
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
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ts-scrim">
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

        {end && endVisible && (
          <GameOverScreen
            title={end.title}
            reason={end.reason}
            bluePercent={bluePercent}
            redPercent={redPercent}
            onPlayAgain={() => onRestart(true)}
            onMenu={onMenu}
            perfJson={
              perfSamples
                ? () => perfReport(summarizePerf(perfSamples, tickMs), settings)
                : undefined
            }
          />
        )}
      </div>
    </div>
  )
}

/** ?perf: маленькая полупрозрачная панель поверх HUD. */
function PerfPanel({ summary }: { summary: ReturnType<typeof summarizePerf> }) {
  return (
    <div
      data-testid="perf-panel"
      className="pointer-events-none absolute left-2 top-1 z-10 bg-ts-bg px-1.5 py-0.5 font-mono text-[10px] leading-tight text-ts-text"
    >
      tick {summary.avgInterval}ms · late {summary.lateTicksPct}% · p95 {summary.p95Work}ms · n {summary.ticks}
    </div>
  )
}
