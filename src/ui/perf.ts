/**
 * Диагностика производительности: включается только параметром ?perf в URL.
 * Пишет по тику: когда начался, сколько заняли бот + resolveRound и через сколько
 * после начала тика React закоммитил DOM. Читается Playwright-замером.
 */
export interface TickSample {
  tick: number
  at: number
  /** Сам тик: resolveRound (+ бот, если не посчитан заранее). */
  costMs: number
  /** Ход бота для этого тика, посчитанный между тиками. */
  botMs: number
  commitMs: number
}

declare global {
  interface Window {
    __tsPerf?: TickSample[]
  }
}

export const perfEnabled = typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf')

export function recordTick(sample: TickSample): void {
  if (!perfEnabled) return
  ;(window.__tsPerf ??= []).push(sample)
}
