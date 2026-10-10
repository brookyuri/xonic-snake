import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { Theme } from '../render/createRenderer'
import { gameLayout, type GameLayout } from './gameLayout'
import { useViewport } from './viewport'

/**
 * Раскладка игрового экрана (gameLayout) по видимой области и замеренной высоте шапки.
 * Пока экран открыт, на <html> — класс ts-game: страница не прокручивается и не тянется
 * (overflow hidden, overscroll-behavior none, touch-action none на области игры).
 */
export function useGameLayout(theme: Theme, cols: number): { layout: GameLayout | null; headerRef: RefObject<HTMLElement> } {
  const headerRef = useRef<HTMLElement>(null)
  const viewport = useViewport()
  const [headerPx, setHeaderPx] = useState(0)

  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.add('ts-game')
    return () => root.classList.remove('ts-game')
  }, [])

  useLayoutEffect(() => {
    const el = headerRef.current
    if (!el) return
    const update = () => setHeaderPx(Math.ceil(el.getBoundingClientRect().height))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [theme])

  const layout = viewport && headerPx > 0 ? gameLayout({ theme, cols, headerPx, ...viewport }) : null
  return { layout, headerRef }
}
