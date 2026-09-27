/**
 * Диагностика производительности: включается только параметром ?perf в URL (работает
 * и в production-сборке — для замеров на телефонах тестеров). Без ?perf ничего не пишется.
 */
export interface TickSample {
  tick: number
  /** Начало тика по часам матча. */
  at: number
  /** Сам тик: resolveRound (+ бот, если не посчитан заранее). */
  costMs: number
  /** Ход бота для этого тика, посчитанный между тиками. */
  botMs: number
  /** От начала тика до коммита DOM (включает costMs). */
  commitMs: number
}

export interface PerfSummary {
  ticks: number
  avgInterval: number
  lateTicksPct: number
  p95Work: number
  maxWork: number
}

declare global {
  interface Window {
    __tsPerf?: TickSample[]
  }
}

export const perfEnabled = typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf')

/** Тик опоздал, если с предыдущего прошло больше 1.5 × tickMs. */
export const LATE_FACTOR = 1.5

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Сводка по тикам матча. Работа тика = бот (между тиками) + тик + рендер,
 * то есть всё, что должно уложиться в tickMs.
 */
export function summarizePerf(samples: readonly TickSample[], tickMs: number): PerfSummary {
  const intervals: number[] = []
  for (let i = 1; i < samples.length; i++) intervals.push(samples[i].at - samples[i - 1].at)
  const work = samples.map((s) => s.botMs + s.commitMs).sort((a, b) => a - b)
  const late = intervals.filter((d) => d > tickMs * LATE_FACTOR).length
  return {
    ticks: samples.length,
    avgInterval: intervals.length ? round1(intervals.reduce((a, b) => a + b, 0) / intervals.length) : 0,
    lateTicksPct: intervals.length ? round1((late / intervals.length) * 100) : 0,
    p95Work: work.length ? round1(work[Math.min(work.length - 1, Math.floor(work.length * 0.95))]) : 0,
    maxWork: work.length ? round1(work[work.length - 1]) : 0,
  }
}

/** Сэмплы одного матча; в ?perf они же доступны как window.__tsPerf для автоматических замеров. */
export function createPerfRecorder(): TickSample[] {
  const samples: TickSample[] = []
  if (perfEnabled) window.__tsPerf = samples
  return samples
}

/** JSON, который тестер копирует с экрана конца партии. */
export function perfReport(summary: PerfSummary, settings: { mode: string; speed: string; difficulty: string }): string {
  return JSON.stringify(
    {
      userAgent: navigator.userAgent,
      screen: `${screen.width}x${screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      mode: settings.mode,
      speed: settings.speed,
      difficulty: settings.mode === 'duel' ? settings.difficulty : null,
      ...summary,
    },
    null,
    2
  )
}
