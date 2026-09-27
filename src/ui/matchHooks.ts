import { useEffect, useRef, type PointerEvent } from 'react'
import type { Direction } from '../engine/types'
import { swipeDirection } from './swipe'

/** Что нужно экрану от контроллера матча (Duel и Solo). */
export interface Steerable {
  frame(): void
  steer(direction: Direction): void
  pause(): void
  togglePause(): void
}

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

export const prefersReducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Цикл кадров: контроллер сам решает, пора ли тикать. */
export function useFrameLoop(controller: Steerable): void {
  useEffect(() => {
    let frame = requestAnimationFrame(function loop() {
      controller.frame()
      frame = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(frame)
  }, [controller])
}

/** Автопауза при сворачивании вкладки (5.1.2). */
export function useAutoPause(controller: Steerable): void {
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) controller.pause()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [controller])
}

/** Стрелки / WASD — поворот, Space / P — пауза, Enter — onEnter (если задан). */
export function useMatchKeys(controller: Steerable, onEnter?: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_TO_DIRECTION[event.key]
      if (direction) {
        event.preventDefault()
        controller.steer(direction)
      } else if (event.key === ' ' || event.key === 'p' || event.key === 'P') {
        event.preventDefault()
        controller.togglePause()
      } else if (event.key === 'Enter' && onEnter) {
        onEnter()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [controller, onEnter])
}

/** Свайп по полю: одно направление на жест, после порога 24px. */
export function useSwipe(controller: Steerable) {
  const swipe = useRef<{ id: number; x: number; y: number; fired: boolean } | null>(null)
  return {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false }
      e.currentTarget.setPointerCapture?.(e.pointerId)
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const s = swipe.current
      if (!s || s.id !== e.pointerId || s.fired) return
      const direction = swipeDirection(e.clientX - s.x, e.clientY - s.y)
      if (direction) {
        s.fired = true
        controller.steer(direction)
      }
    },
    onPointerUp: () => {
      swipe.current = null
    },
  }
}
