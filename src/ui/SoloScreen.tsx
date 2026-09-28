import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { assertSoloInvariants, SOLO_BOARD_SIZE, START_LIVES, type SoloState } from '../engine/solo'
import type { Direction, PlayerId, Pos } from '../engine/types'
import { SPEEDS } from '../game/config'
import { lastQueuedDirection } from '../game/input'
import { SoloMatchController } from '../game/soloMatch'
import { SOLO_LEGEND, type Flash } from './Board'
import { BoardView } from './BoardView'
import { snapshotFromSolo } from '../render/adapters'
import type { RenderSnapshot } from '../render/types'
import { DPad } from './DPad'
import { CountdownOverlay, EventLine, PauseButton, PerfPanel } from './GameChrome'
import { GameOverScreen } from './GameOverScreen'
import { PauseScreen } from './PauseScreen'
import { MESSAGE_HOLD_MS, MessageFeed } from './messageFeed'
import { prefersReducedMotion, useAutoPause, useFrameLoop, useMatchKeys, useSwipe } from './matchHooks'
import { createFrameRecorder, createPerfRecorder, perfEnabled, perfReport, summarizePerf } from './perf'
import { LateTickMonitor } from './lateTicks'
import type { Settings } from './settings'
import { describeSoloTick, levelIntro, progressLabel, soloEndReason } from './soloText'
import { markLastGameRematch, recordSoloAbandoned, recordSoloGame, unrecordAbandoned } from './stats'

/** Рамка клетки удара мигает 3 раза по 320 мс, потом — отсчёт или GAME OVER. */
const HIT_BLINK_MS = 960

const randomSeed = () => Math.floor(Math.random() * 2 ** 32)

interface Props {
  settings: Settings
  onMenu: () => void
  /** Поле 2026 не поднялось — App переключает на 1986 и показывает тост. */
  onRendererFallback: (error: unknown) => void
  /** Тики опаздывают на теме 2026 — App предлагает перейти на 1986. */
  onSlowRenderer: () => void
}

/** Экран Solo. Каждая партия — отдельный SoloMatch с новым key: рестарт сбрасывает всё. */
export function SoloScreen({ settings, onMenu, onRendererFallback, onSlowRenderer }: Props) {
  const [matchId, setMatchId] = useState(0)
  const restart = useCallback((afterFinishedGame: boolean) => {
    if (afterFinishedGame) markLastGameRematch()
    setMatchId((id) => id + 1)
  }, [])
  return <SoloMatch key={matchId} settings={settings} onMenu={onMenu} onRestart={restart} onRendererFallback={onRendererFallback} onSlowRenderer={onSlowRenderer} />
}

interface MatchProps extends Props {
  onRestart: (afterFinishedGame: boolean) => void
}

function SoloMatch({ settings, onMenu, onRestart, onRendererFallback, onSlowRenderer }: MatchProps) {
  const tickMs = SPEEDS[settings.speed]
  const [controller] = useState(() => new SoloMatchController({ tickMs, seed: randomSeed() }))
  const subscribe = useCallback((listener: () => void) => controller.subscribe(listener), [controller])
  const snap = useSyncExternalStore(subscribe, () => controller.snapshot)
  const { state, phase, events, ticks } = snap

  // Состояние до последнего тика. При потере жизни движок сразу убирает след и ставит
  // змейку на старт; на время вспышки показываем кадр удара — след, голову и шарики.
  const history = useRef({ ticks, state, before: state })
  if (history.current.ticks !== ticks) {
    history.current.before = history.current.state
    history.current.ticks = ticks
  }
  history.current.state = state

  const [flash, setFlash] = useState<Flash | null>(null)
  const [endVisible, setEndVisible] = useState(false)
  const flashId = useRef(0)
  const feed = useRef(new MessageFeed(MESSAGE_HOLD_MS, 2))
  // Сколько жизней было максимум: потерянные показываются рамкой.
  const peakLives = useRef(START_LIVES)
  peakLives.current = Math.max(peakLives.current, state.lives)
  const [perfSamples] = useState(() => (perfEnabled ? createPerfRecorder() : null))
  const [frames] = useState(() => (perfEnabled ? createFrameRecorder() : null))
  const [lateTicks] = useState(() => new LateTickMonitor(tickMs))

  const skipHold = useCallback(() => controller.skipHold(), [controller])
  useFrameLoop(controller)
  useAutoPause(controller)
  useMatchKeys(controller, skipHold)
  const swipe = useSwipe(controller)

  const match = useRef({ startedAt: new Date().toISOString(), captures: 0, recorded: false })
  const [best, setBest] = useState<{ previousBest: number; newBest: boolean } | null>(null)
  const record = () => ({
    startedAt: match.current.startedAt,
    rounds: controller.snapshot.ticks,
    level: controller.snapshot.state.level,
    score: controller.snapshot.state.score,
    captures: match.current.captures,
    speed: settings.speed,
  })

  /**
   * Брошенная партия (RESTART / MENU с паузы, уход со страницы): в ts_games с reason
   * ABANDONED. Отсчёт до первого тика и уже записанные партии не пишутся.
   */
  const abandon = useCallback((): string | null => {
    const { ticks: played, phase: now } = controller.snapshot
    if (played === 0 || now === 'FINISHED' || match.current.recorded) return null
    match.current.recorded = true
    return recordSoloAbandoned(record())
  }, [controller]) // eslint-disable-line react-hooks/exhaustive-deps

  // Уход со страницы: запись ABANDONED; если вкладка вернулась из bfcache — снимаем её,
  // партия стоит на паузе (RESUME — через отсчёт 3-2-1). Так же, как в Duel.
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

  // Начало уровня: «LEVEL 2 — 3 BALLS». Лента живёт в ref — перерисовываем сами.
  const [, redraw] = useState(0)
  useEffect(() => {
    feed.current.push([levelIntro(state.level)], performance.now())
    redraw((n) => n + 1)
  }, [state.level])

  // Только dev-сборка: контроллер для автоматических проверок в браузере.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as { __tsMatch?: unknown }).__tsMatch = controller
  }, [controller])

  // Каждый тик: опоздания (VISUAL_2026.md раздел 5 — тост «перейти на 1986») и ?perf —
  // сколько прошло от начала тика до коммита DOM.
  useLayoutEffect(() => {
    if (ticks === 0) return
    const counted = lateTicks.tick(snap.lastTickAt)
    if (phase !== 'RUNNING') lateTicks.pause()
    if (settings.theme === '2026' && lateTicks.shouldOffer()) onSlowRenderer()
    perfSamples?.push({
      tick: ticks,
      at: snap.lastTickAt,
      costMs: snap.lastTickCostMs,
      botMs: 0,
      commitMs: performance.now() - snap.lastTickAt,
      afterBreak: !counted,
    })
  }, [ticks]) // eslint-disable-line react-hooks/exhaustive-deps

  // Пауза, отсчёт, вспышка удара: интервал через перерыв — не опоздание.
  useEffect(() => {
    if (phase !== 'RUNNING') lateTicks.pause()
  }, [phase, lateTicks])

  // Всё, что происходит один раз за тик.
  useEffect(() => {
    if (ticks === 0) return
    if (import.meta.env.DEV) {
      try {
        assertSoloInvariants(state)
      } catch (error) {
        console.error(error)
      }
    }
    const lines = describeSoloTick(events)
    if (lines.length > 0) {
      feed.current.push(lines, performance.now())
      // Во время вспышки удара новых снимков нет — без перерисовки «BALL HIT!» не появится.
      redraw((n) => n + 1)
    }

    // Захваченные клетки на один тик белые (не при reduced motion).
    const captured = new Map<number, PlayerId>()
    for (const e of events) {
      if (e.type !== 'CAPTURED') continue
      match.current.captures++
      for (const c of e.cells) captured.set(c.y * SOLO_BOARD_SIZE + c.x, 'P1')
    }
    if (captured.size > 0 && !prefersReducedMotion()) {
      const id = ++flashId.current
      setFlash({ cells: captured })
      setTimeout(() => {
        if (flashId.current === id) setFlash(null)
      }, tickMs)
    }

    if (state.status === 'GAME_OVER' && !match.current.recorded) {
      match.current.recorded = true
      setBest(recordSoloGame(record()))
    }
  }, [ticks]) // eslint-disable-line react-hooks/exhaustive-deps

  // Конец партии: сначала мигает клетка удара, потом оверлей GAME OVER.
  useEffect(() => {
    if (phase !== 'FINISHED') return
    const id = setTimeout(() => setEndVisible(true), prefersReducedMotion() ? 0 : HIT_BLINK_MS)
    return () => clearTimeout(id)
  }, [phase])

  // Клетка удара: мигает её рамка во время LIFE_LOST (при reduced motion — статичная рамка)
  // и на экране конца; шарик и след в клетке видны. Поле — кадр удара: доска и след до
  // тика, голова в клетке удара.
  const boardSnapshot = useMemo((): RenderSnapshot => {
    const hit = phase === 'LIFE_LOST' || phase === 'FINISHED' ? lifeLostAt(events) : null
    const moved = events.find((e) => e.type === 'MOVED')
    const before = history.current.before
    const view: SoloState =
      hit && moved?.type === 'MOVED'
        ? {
            ...before,
            player: { ...before.player, head: moved.to, direction: stepDirection(moved.from, moved.to) },
            balls: state.balls,
          }
        : state
    return {
      ...snapshotFromSolo(view, events),
      flash: flash?.cells ?? null,
      loading: phase === 'COUNTDOWN',
      highlight: hit ? [hit] : undefined,
      highlightStyle: 'frame',
    }
  }, [state, events, phase, flash])
  const canSteer = phase === 'RUNNING' || phase === 'COUNTDOWN'
  const heading = lastQueuedDirection(snap.queue, state.player.direction)
  const lines = feed.current.visible(performance.now())
  const levelBonus = events.find((e) => e.type === 'LEVEL_COMPLETE')

  return (
    <div className="screen">
      <div className="relative mx-auto flex h-full w-full max-w-[480px] flex-col px-4">
        {perfSamples && <PerfPanel summary={summarizePerf(perfSamples, tickMs)} frames={frames?.summary()} />}
        <header className="pt-3">
          <SoloHud state={state} peakLives={peakLives.current}>
            <PauseButton disabled={!canSteer} onPause={() => controller.pause()} />
          </SoloHud>
          <EventLine lines={lines} />
        </header>

        <div
          // 2026: рамка шире сетки на отступ (скос вне сетки) — слот заходит в поля экрана,
          // чтобы сетка осталась ≥ 343 px на 375×667.
          className={`board-slot flex min-h-0 flex-1 items-center justify-center py-1 ${settings.theme === '2026' ? 'board-slot-2026' : ''}`}
        >
          <BoardView
            theme={settings.theme}
            snapshot={boardSnapshot}
            events={events}
            tick={ticks}
            timing={{ at: snap.lastTickAt, tickMs, running: phase === 'RUNNING' }}
            onFallback={onRendererFallback}
            onFrame={frames?.record}
            className="board-fit"
            style={{ touchAction: 'none' }}
            {...swipe}
          >
            {phase === 'COUNTDOWN' && <CountdownOverlay value={snap.countdown} />}
            {phase === 'LEVEL_CLEAR' && levelBonus?.type === 'LEVEL_COMPLETE' && (
              <button
                type="button"
                data-testid="level-clear"
                onClick={skipHold}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ts-scrim font-pixel"
              >
                <span className="text-base text-ts-text">LEVEL {levelBonus.level} CLEAR</span>
                <span className="text-xs text-ts-timer">BONUS +{levelBonus.bonus}</span>
                <span className="text-[10px] text-ts-text2">TAP TO GO ON</span>
              </button>
            )}
          </BoardView>
        </div>

        <div className="flex justify-center pb-4 pt-2" data-testid="dpad">
          <DPad heading={heading} onSteer={(d) => controller.steer(d)} disabled={!canSteer} />
        </div>

        {phase === 'PAUSED' && (
          <PauseScreen
            legend={SOLO_LEGEND}
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

        {phase === 'FINISHED' && endVisible && (
          <GameOverScreen
            title={`LEVEL ${state.level}`}
            reason={soloEndReason(events)}
            onPlayAgain={() => onRestart(true)}
            onMenu={onMenu}
            perfJson={perfSamples ? () => perfReport(summarizePerf(perfSamples, tickMs), settings, frames?.summary()) : undefined}
          >
            <div className="font-pixel text-xs text-ts-timer" data-testid="solo-score">
              SCORE {state.score}
            </div>
            {best && (
              <div className="font-pixel text-[10px]" data-testid="solo-best">
                {best.newBest ? (
                  <span className="text-ts-ball">NEW BEST!</span>
                ) : (
                  <span className="text-ts-text2">BEST {best.previousBest}</span>
                )}
              </div>
            )}
          </GameOverScreen>
        )}
      </div>
    </div>
  )
}

/** HUD Solo: «LV 1» · «42%/75%» · жизни квадратиками · очки. Помещается в 288px (320 − поля). */
function SoloHud({ state, peakLives, children }: { state: SoloState; peakLives: number; children: ReactNode }) {
  const slots = Math.max(peakLives, state.lives)
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap font-pixel text-[10px]" data-testid="hud">
      <span className="shrink-0 text-ts-text">LV {state.level}</span>
      <span className="shrink-0 text-ts-blue" data-testid="progress">
        {progressLabel(state)}
      </span>
      <span
        className="flex flex-1 items-center justify-center gap-0.5"
        role="img"
        aria-label={`${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left`}
        data-testid="lives"
      >
        {Array.from({ length: slots }, (_, i) => (
          <span key={i} className={`life ${i < state.lives ? 'life-full' : ''}`} />
        ))}
      </span>
      <span className="shrink-0 text-ts-timer" data-testid="score">
        {state.score}
      </span>
      {children}
    </div>
  )
}

const stepDirection = (from: Pos, to: Pos): Direction =>
  to.x > from.x ? 'RIGHT' : to.x < from.x ? 'LEFT' : to.y > from.y ? 'DOWN' : 'UP'

function lifeLostAt(events: SoloMatchController['snapshot']['events']): Pos | null {
  const e = events.find((ev) => ev.type === 'LIFE_LOST')
  return e?.type === 'LIFE_LOST' ? e.at : null
}
