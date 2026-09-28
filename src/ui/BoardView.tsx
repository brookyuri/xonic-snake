import { useLayoutEffect, useRef, type CSSProperties, type PointerEventHandler, type ReactNode } from 'react'
import { Dom8bitRenderer } from '../render/dom8bit'
import type { BoardRenderer, RenderEvent, RenderSnapshot } from '../render/types'
import { prefersReducedMotion } from './matchHooks'

interface Props {
  snapshot: RenderSnapshot
  /** События последнего тика: рендерер получает их один раз — когда сменился tick. */
  events?: readonly RenderEvent[]
  tick?: number
  className?: string
  style?: CSSProperties
  onPointerDown?: PointerEventHandler<HTMLDivElement>
  onPointerMove?: PointerEventHandler<HTMLDivElement>
  onPointerUp?: PointerEventHandler<HTMLDivElement>
  /** Оверлеи поверх поля (отсчёт, LEVEL CLEAR). */
  children?: ReactNode
}

/**
 * Поле на экране: рамка (DOM), внутри — рендерер (BoardRenderer), сверху — оверлеи.
 * Рендерер монтируется прямо в элемент рамки и ставит свои узлы первыми, перед
 * React-оверлеями: лишняя обёртка меняла бы растеризацию слоёв голов в 1986.
 * Рендерер получает update() при каждой смене кадра.
 */
export function BoardView({
  snapshot,
  events = [],
  tick = 0,
  className = '',
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  children,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const renderer = useRef<BoardRenderer | null>(null)
  const lastTick = useRef(tick)
  const { cols, rows } = snapshot

  useLayoutEffect(() => {
    const el = mountRef.current!
    const r = new Dom8bitRenderer()
    // Dom8bitRenderer монтируется синхронно: поле в DOM уже в этом кадре.
    void r.mount(el, { cols, rows, sizePx: el.clientWidth, reducedMotion: prefersReducedMotion() })
    renderer.current = r
    return () => {
      r.destroy()
      renderer.current = null
    }
  }, [cols, rows])

  useLayoutEffect(() => {
    const fresh = tick !== lastTick.current
    lastTick.current = tick
    renderer.current?.update(snapshot, fresh ? events : [])
  }, [snapshot]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={mountRef}
      className={`board-frame relative aspect-square overflow-hidden ${snapshot.loading ? 'board-loading' : ''} ${className}`}
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
