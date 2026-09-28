import { Dom8bitRenderer } from './dom8bit'
import type { BoardRenderer } from './types'

/** Визуальная тема поля: 1986 — DOM 8-bit, 2026 — PixiJS (VISUAL_2026.md). */
export type Theme = '1986' | '2026'

/** Чанк Pixi: один промис на всё приложение (меню может начать загрузку заранее). */
let pixiChunk: Promise<typeof import('./pixi2026')> | null = null
export function preloadPixi(): Promise<typeof import('./pixi2026')> {
  pixiChunk ??= import('./pixi2026')
  // Не удалось загрузить (офлайн) — в следующий раз попробуем снова.
  pixiChunk.catch(() => (pixiChunk = null))
  return pixiChunk
}

/**
 * Для проверок: ?renderer=canvas — только Canvas-рендерер Pixi, ?renderer=fail — Pixi не
 * поднимается (проверка перехода на 1986).
 */
function rendererOverride(): string | null {
  return typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('renderer')
}

/** Рендерер темы. Для 2026 — после загрузки чанка; ошибка значит «переходи на 1986». */
export async function createBoardRenderer(theme: Theme): Promise<BoardRenderer> {
  if (theme === '1986') return new Dom8bitRenderer()
  const override = rendererOverride()
  if (override === 'fail') throw new Error('2026 renderer disabled by ?renderer=fail')
  const { Pixi2026Renderer } = await preloadPixi()
  return new Pixi2026Renderer(override === 'canvas' ? ['canvas'] : override === 'webgl' ? ['webgl'] : ['webgl', 'canvas'])
}
