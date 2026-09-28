import { useLayoutEffect, useRef, type CSSProperties, type PointerEventHandler, type ReactNode } from 'react'
import { tickAlpha } from '../game/match'
import { createBoardRenderer, type Theme } from '../render/createRenderer'
import { Dom8bitRenderer } from '../render/dom8bit'
import type { BoardRenderer, RenderEvent, RenderSnapshot } from '../render/types'
import { prefersReducedMotion } from './matchHooks'

/** Для плавного движения: когда начался последний тик, его длина и идёт ли игра. */
export interface TickTiming {
  at: number
  tickMs: number
  running: boolean
}

interface Props {
  theme: Theme
  snapshot: RenderSnapshot
  /** События последнего тика: рендерер получает их один раз — когда сменился tick. */
  events?: readonly RenderEvent[]
  tick?: number
  timing?: TickTiming
  /** Тема 2026 не поднялась (нет WebGL и Canvas, чанк не загрузился). */
  onFallback?: (error: unknown) => void
  /** ?perf: сколько занял frame() рендерера на этом кадре. */
  onFrame?: (ms: number, now: number) => void
  className?: string
  style?: CSSProperties
  onPointerDown?: PointerEventHandler<HTMLDivElement>
  onPointerMove?: PointerEventHandler<HTMLDivElement>
  onPointerUp?: PointerEventHandler<HTMLDivElement>
  /** Оверлеи поверх поля (отсчёт, LEVEL CLEAR). */
  children?: ReactNode
}

/** Кадр ближе этого к следующему тику не рисуется (тик придёт в этом же rAF). */
const FRAME_GUARD_MS = 4
/** frame() в среднем дороже — рисуем через кадр. */
const SLOW_FRAME_MS = 6

/** Сторона поля внутри рамки, CSS px. */
function contentSize(el: HTMLElement): number {
  const cs = getComputedStyle(el)
  return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
}

/**
 * Поле на экране: рамка (DOM), внутри — рендерер темы (BoardRenderer), сверху — оверлеи.
 * Рендерер монтируется прямо в элемент рамки и ставит свои узлы первыми, перед
 * React-оверлеями. update() — при каждой смене кадра (события — только на тике),
 * frame(alpha) — на каждом кадре rAF.
 */
export function BoardView({
  theme,
  snapshot,
  events = [],
  tick = 0,
  timing,
  onFallback,
  onFrame,
  className = '',
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  children,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const renderer = useRef<BoardRenderer | null>(null)
  const lastTick = useRef(tick)
  const latest = useRef({ snapshot, tick, timing, onFallback, onFrame })
  latest.current = { snapshot, tick, timing, onFallback, onFrame }
  const { cols, rows } = snapshot

  useLayoutEffect(() => {
    const el = hostRef.current!
    const reduced = prefersReducedMotion()
    const opts = { cols, rows, sizePx: contentSize(el), reducedMotion: reduced }
    // 1986 движется дискретно — кадры ей не нужны (кроме замеров ?perf).
    const animated = theme !== '1986' || latest.current.onFrame !== undefined
    let disposed = false
    let raf = 0
    let mounted: BoardRenderer | null = null

    const start = (r: BoardRenderer) => {
      mounted = r
      renderer.current = r
      lastTick.current = latest.current.tick
      r.update(latest.current.snapshot, [])
      if (!animated) return
      // Бюджет на слабых устройствах (VISUAL_2026.md раздел 5 — тики важнее кадров):
      // 1) кадр, в котором вот-вот будет тик, не рисуем — его занимают тик и коммит React,
      //    а картинка при alpha ≈ 1 почти не отличается от предыдущей;
      // 2) если frame() в среднем дороже SLOW_FRAME_MS, рисуем через кадр (~30 FPS).
      let avg = 0
      let odd = false
      raf = requestAnimationFrame(function loop() {
        raf = requestAnimationFrame(loop)
        const started = performance.now()
        const t = latest.current.timing
        if (t?.running && started >= t.at + t.tickMs - FRAME_GUARD_MS) return
        odd = !odd
        if (avg > SLOW_FRAME_MS && odd) return
        r.frame(t && !reduced ? tickAlpha(started, t.at, t.tickMs, t.running) : 1)
        const ms = performance.now() - started
        avg = avg === 0 ? ms : avg * 0.9 + ms * 0.1
        latest.current.onFrame?.(ms, started)
      })
    }

    if (theme === '1986') {
      // Dom8bitRenderer монтируется синхронно: поле в DOM уже в этом кадре.
      const r = new Dom8bitRenderer()
      void r.mount(el, opts)
      start(r)
    } else {
      createBoardRenderer(theme)
        .then(async (r) => {
          if (disposed) return
          try {
            await r.mount(el, { ...opts, sizePx: contentSize(el) })
          } catch (error) {
            r.destroy()
            throw error
          }
          if (disposed) r.destroy()
          else start(r)
        })
        .catch((error) => {
          if (!disposed) latest.current.onFallback?.(error)
        })
    }

    const resize = new ResizeObserver(() => renderer.current?.resize(contentSize(el)))
    resize.observe(el)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      resize.disconnect()
      mounted?.destroy()
      renderer.current = null
    }
  }, [theme, cols, rows])

  useLayoutEffect(() => {
    const fresh = tick !== lastTick.current
    lastTick.current = tick
    renderer.current?.update(snapshot, fresh ? events : [])
  }, [snapshot]) // eslint-disable-line react-hooks/exhaustive-deps

  const frame = theme === '1986' ? `board-frame ${snapshot.loading ? 'board-loading' : ''}` : 'board-2026'
  return (
    <div
      ref={hostRef}
      data-theme={theme}
      className={`${frame} relative aspect-square overflow-hidden ${className}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {children}
    </div>
  )
}
