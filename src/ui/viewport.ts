import { useSyncExternalStore } from 'react'
import type { Insets } from './gameLayout'

export interface Viewport {
  width: number
  height: number
  insets: Insets
}

let current: Viewport | null = null
const listeners = new Set<() => void>()

/** env(safe-area-inset-*) в px: значения читаются с невидимого пробника (.safe-area-probe). */
function readInsets(probe: HTMLElement): Insets {
  const cs = getComputedStyle(probe)
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  }
}

const same = (a: Viewport | null, b: Viewport) =>
  !!a &&
  a.width === b.width &&
  a.height === b.height &&
  a.insets.top === b.insets.top &&
  a.insets.right === b.insets.right &&
  a.insets.bottom === b.insets.bottom &&
  a.insets.left === b.insets.left

/**
 * Видимая область: window.innerHeight — высота, которую браузер реально показывает (без адресной
 * строки и системных панелей; меняется при их показе и скрытии). Пишется в --app-h на <html>:
 * экраны берут высоту из неё (до первого замера — 100dvh). Пересчёт на resize, orientationchange,
 * visualViewport.resize (адресная строка), pageshow; после поворота — ещё раз на следующем кадре.
 */
export function startViewportTracking(): void {
  const root = document.documentElement
  const probe = document.createElement('div')
  probe.className = 'safe-area-probe'
  probe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(probe)
  let raf = 0
  const measure = () => {
    const next: Viewport = { width: root.clientWidth || window.innerWidth, height: window.innerHeight, insets: readInsets(probe) }
    root.style.setProperty('--app-h', `${next.height}px`)
    if (same(current, next)) return
    current = next
    for (const listener of listeners) listener()
  }
  const later = () => {
    measure()
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(measure)
  }
  measure()
  window.addEventListener('resize', later)
  window.addEventListener('orientationchange', later)
  window.visualViewport?.addEventListener('resize', later)
  window.addEventListener('pageshow', later)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useViewport(): Viewport | null {
  return useSyncExternalStore(subscribe, () => current)
}
