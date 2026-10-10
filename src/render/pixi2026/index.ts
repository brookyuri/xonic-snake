// Отдельный чанк: грузится динамическим импортом, только когда активна тема 2026.
export { Pixi2026Renderer, type PixiPreference } from './Pixi2026Renderer'

import { Pixi2026Renderer } from './Pixi2026Renderer'
// ?perf: счётчики текстур и рендереров для панели и автоматических замеров.
;(globalThis as { __tsGpu?: () => ReturnType<typeof Pixi2026Renderer.stats> }).__tsGpu = () => Pixi2026Renderer.stats()
