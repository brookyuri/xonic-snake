import type { FrameSummary, summarizePerf } from './perf'

/** Кнопка паузы в HUD: 44×44, пиксельная иконка. */
export function PauseButton({ disabled, onPause }: { disabled: boolean; onPause: () => void }) {
  return (
    <button
      type="button"
      aria-label="Pause"
      data-testid="pause"
      disabled={disabled}
      onClick={onPause}
      // 44px в строке HUD высотой 28px: выступ −4px сверху и −12px снизу (не −8/−8) — верх кнопки
      // не ближе 8px к краю экрана, высота строки и положение поля те же.
      className="-mb-3 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center btn text-ts-text"
    >
      <svg viewBox="0 0 7 7" shapeRendering="crispEdges" className="h-4 w-4" aria-hidden>
        <path d="M1 1h2v5H1zM4 1h2v5H4z" fill="currentColor" />
      </svg>
    </button>
  )
}

/**
 * Строка событий под HUD: не больше двух строк. Высота постоянная — поле не прыгает.
 * urgent — первая строка выделяется (угроза следу в Duel).
 */
export function EventLine({ lines, urgent = false }: { lines: readonly string[]; urgent?: boolean }) {
  return (
    <div
      data-testid="event-line"
      aria-live="polite"
      className="event-line flex h-[28px] flex-col items-center justify-center text-center"
    >
      {lines.map((line, i) => (
        <span key={line} className={i === 0 && urgent ? 'text-ts-danger' : 'text-ts-text2'}>
          {line}
        </span>
      ))}
    </div>
  )
}

/** Отсчёт 3-2-1 поверх поля: крупная цифра, сменяется без анимации. */
export function CountdownOverlay({ value }: { value: number }) {
  if (value <= 0) return null
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ts-scrim">
      <span key={value} data-testid="countdown" className="countdown-number">
        {value}
      </span>
    </div>
  )
}

/** ?perf: маленькая полупрозрачная панель поверх HUD; вторая строка — кадры рендерера. */
export function PerfPanel({ summary, frames }: { summary: ReturnType<typeof summarizePerf>; frames?: FrameSummary }) {
  return (
    <div
      data-testid="perf-panel"
      className="pointer-events-none absolute left-2 top-1 z-10 bg-ts-bg px-1.5 py-0.5 font-mono text-[10px] leading-tight text-ts-text"
    >
      tick {summary.avgInterval}ms · late {summary.lateTicksPct}% · p95 {summary.p95Work}ms · n {summary.ticks}
      {frames && (
        <>
          <br />
          fps {frames.fps} · frame avg {frames.frameAvg}ms · max {frames.frameMax}ms
        </>
      )}
    </div>
  )
}
