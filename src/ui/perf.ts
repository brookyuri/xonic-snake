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
  /** От начала тика до коммита DOM (включает costMs и update() рендерера). */
  commitMs: number
  /** Первый тик после перерыва (отсчёт, пауза, удар): интервал до него — не опоздание. */
  afterBreak?: boolean
  /** Событий с эффектами на поле 2026 (захват, смерть, потеря жизни) в этом тике. */
  fx?: number
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
    /** ?perf: кадры [длительность frame() рендерера, мс; момент кадра]. */
    __tsFrames?: [number, number][]
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
  for (let i = 1; i < samples.length; i++) if (!samples[i].afterBreak) intervals.push(samples[i].at - samples[i - 1].at)
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

export interface FrameSummary {
  frames: number
  /** Кадров за последнюю секунду (панель ?perf). */
  fps: number
  /** Средний FPS за партию. */
  fpsAvg: number
  /** Худшие 5 секунд: минимум FPS по полным 5-секундным окнам (нет полного окна — среднее). */
  fpsMin5s: number
  /** Время frame() рендерера за партию, мс. */
  frameAvg: number
  frameP95: number
  frameMax: number
}

export interface FrameRecorder {
  record(ms: number, now: number): void
  summary(): FrameSummary
}

/** Длина окна для «худших» FPS. */
export const FPS_WINDOW_MS = 5000

/** Сводка кадров: FPS (среднее и минимум по 5-секундным окнам) и время frame(). Чистая функция. */
export function summarizeFrames(samples: readonly (readonly [number, number])[], now = samples.length ? samples[samples.length - 1][1] : 0): FrameSummary {
  const n = samples.length
  if (n === 0) return { frames: 0, fps: 0, fpsAvg: 0, fpsMin5s: 0, frameAvg: 0, frameP95: 0, frameMax: 0 }
  const times = samples.map((s) => s[1])
  const ms = samples.map((s) => s[0]).sort((a, b) => a - b)
  const span = times[n - 1] - times[0]
  const fpsAvg = span > 0 ? ((n - 1) * 1000) / span : 0
  let fpsMin5s = Infinity
  for (let from = times[0], i = 0; from + FPS_WINDOW_MS <= times[n - 1]; from += FPS_WINDOW_MS) {
    let count = 0
    while (i < n && times[i] < from + FPS_WINDOW_MS) {
      if (times[i] >= from) count++
      i++
    }
    fpsMin5s = Math.min(fpsMin5s, (count * 1000) / FPS_WINDOW_MS)
  }
  return {
    frames: n,
    fps: times.filter((t) => t > now - 1000).length,
    fpsAvg: round1(fpsAvg),
    fpsMin5s: round1(Number.isFinite(fpsMin5s) ? fpsMin5s : fpsAvg),
    frameAvg: round1(ms.reduce((a, b) => a + b, 0) / n),
    frameP95: round1(ms[Math.min(n - 1, Math.floor(n * 0.95))]),
    frameMax: round1(ms[n - 1]),
  }
}

/** Кадры рендерера (?perf). Панель берёт сводку раз в тик — сортировка там дешевле, чем на кадре. */
export function createFrameRecorder(): FrameRecorder {
  const samples: [number, number][] = []
  if (perfEnabled) window.__tsFrames = samples
  return {
    record(ms, now) {
      samples.push([ms, now])
    },
    summary: () => summarizeFrames(samples),
  }
}

/** Устройство для отчёта: модель (Client Hints, если браузер её отдаёт), платформа, мобильное ли. */
export interface DeviceInfo {
  model: string | null
  platform: string | null
  mobile: boolean | null
}

interface UADataLike {
  platform?: string
  mobile?: boolean
  getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string; platform?: string }>
}

let device: DeviceInfo = { model: null, platform: null, mobile: null }

/** Запросить модель заранее (асинхронно); в отчёт попадёт то, что успело прийти. */
export function detectDevice(): void {
  const ua = (navigator as Navigator & { userAgentData?: UADataLike }).userAgentData
  if (!ua) return
  device = { model: null, platform: ua.platform ?? null, mobile: ua.mobile ?? null }
  ua.getHighEntropyValues?.(['model', 'platform'])
    .then((v) => (device = { ...device, model: v.model || null, platform: v.platform ?? device.platform }))
    .catch(() => {})
}

if (perfEnabled && typeof navigator !== 'undefined') detectDevice()

/** JSON, который тестер копирует с экрана конца партии. */
export function perfReport(
  summary: PerfSummary,
  settings: { mode: string; speed: string; difficulty: string; theme?: string },
  frames?: FrameSummary
): string {
  return JSON.stringify(
    {
      userAgent: navigator.userAgent,
      screen: `${screen.width}x${screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      mode: settings.mode,
      speed: settings.speed,
      difficulty: settings.mode === 'duel' ? settings.difficulty : null,
      theme: settings.theme ?? null,
      device,
      ...summary,
      ...(frames
        ? { fps: { avg: frames.fpsAvg, min5s: frames.fpsMin5s }, frameAvg: frames.frameAvg, frameP95: frames.frameP95, frameMax: frames.frameMax }
        : {}),
    },
    null,
    2
  )
}
