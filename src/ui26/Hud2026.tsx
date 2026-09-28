import type { ReactNode } from 'react'

/** HUD темы 2026 (VISUAL_2026.md раздел 4 «HUD Duel», «HUD Solo»). */

function Bar({ value, color, fromRight = false, mark }: { value: number; color: string; fromRight?: boolean; mark?: number }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="t26-bar mt-1">
      <span style={{ width: `${pct}%`, background: color, [fromRight ? 'right' : 'left']: 0 }} />
      {mark !== undefined && (
        <i className="absolute -top-[2px] h-[8px] w-[2px] bg-[var(--c26-gold)]" style={{ left: `calc(${mark}% - 1px)` }} aria-hidden />
      )}
    </div>
  )
}

function Card({ className, edge, children, testId }: { className: string; edge: string; children: ReactNode; testId?: string }) {
  return (
    <div className={`${className} px-2.5 py-1.5`} style={{ ['--edge' as string]: edge }} data-testid={testId}>
      {children}
    </div>
  )
}

export function DuelHud2026({
  bluePercent,
  redPercent,
  clock,
  finalSeconds,
  difficulty,
}: {
  bluePercent: number
  redPercent: number
  clock: string
  finalSeconds: boolean
  difficulty: string
}) {
  return (
    <div className="grid grid-cols-[1fr_96px_1fr] items-stretch gap-1.5" data-testid="hud">
      <div className="t26-glow-cyan">
        <Card className="cut-tl h-full" edge="var(--c26-cyan)">
          <div className="flex items-baseline justify-between gap-1">
            <span className="t26-label text-[10px]">YOU</span>
            <span className="t26-num text-[22px] font-bold leading-none text-[var(--c26-cyan)]">{bluePercent}%</span>
          </div>
          <Bar value={bluePercent} color="var(--c26-cyan)" />
        </Card>
      </div>
      <Card className="cut h-full" edge="linear-gradient(90deg, var(--c26-cyan), var(--c26-red))" testId="timer">
        <div className="flex h-full items-center justify-center gap-1.5">
          <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="var(--c26-cyan-soft)" strokeWidth={1.6} aria-hidden>
            <circle cx="8" cy="9" r="5.5" />
            <path d="M8 6v3.2l2 1.4M6.3 1.8h3.4" strokeLinecap="round" />
          </svg>
          <span className="t26-num text-[22px] font-bold leading-none" style={{ color: finalSeconds ? 'var(--c26-red)' : 'var(--c26-text)' }}>
            {clock}
          </span>
        </div>
      </Card>
      <div className="t26-glow-red">
        <Card className="cut-tr h-full" edge="var(--c26-red)">
          <div className="flex items-baseline justify-between gap-1">
            <span className="t26-num text-[22px] font-bold leading-none text-[var(--c26-red)]">{redPercent}%</span>
            <span className="t26-label text-right text-[10px] leading-tight">
              AI · {difficulty}
            </span>
          </div>
          <Bar value={redPercent} color="var(--c26-red)" fromRight />
        </Card>
      </div>
    </div>
  )
}

export function SoloHud2026({
  score,
  level,
  lives,
  slots,
  progressPercent,
  targetPercent,
}: {
  score: number
  level: number
  lives: number
  /** Сколько ромбов показывать (потерянные — пустые). */
  slots: number
  progressPercent: number
  targetPercent: number
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5" data-testid="hud">
      <Card className="cut-tl" edge="linear-gradient(135deg, var(--c26-cyan), var(--c26-violet))">
        <div className="flex items-baseline justify-between gap-2">
          <span className="t26-label text-[10px]">SCORE</span>
          <span className="t26-label text-[11px] text-[var(--c26-gold)]">LV {level}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="t26-num text-[22px] font-bold leading-tight text-[var(--c26-gold)]" data-testid="score">
            {score}
          </span>
          <span className="flex items-center gap-1.5" role="img" aria-label={`${lives} ${lives === 1 ? 'life' : 'lives'} left`} data-testid="lives">
            {Array.from({ length: slots }, (_, i) => (
              <span key={i} className={`t26-life ${i < lives ? 't26-life-full' : ''}`} />
            ))}
          </span>
        </div>
      </Card>
      <Card className="cut-tr" edge="linear-gradient(135deg, var(--c26-violet), var(--c26-cyan))">
        <div className="flex items-baseline justify-between gap-2">
          <span className="t26-label text-[10px]">CAPTURED</span>
          <span className="t26-num text-[22px] font-bold leading-tight text-[var(--c26-cyan)]" data-testid="progress">
            {progressPercent}%
          </span>
        </div>
        <Bar value={progressPercent} color="linear-gradient(90deg, var(--c26-cyan), var(--c26-violet))" mark={targetPercent} />
      </Card>
    </div>
  )
}

/** Строка событий 22px: одно событие (угроза важнее). Duel — gold, угроза — red; Solo — magenta-soft. */
export function EventLine2026({ lines, urgent = false, tone }: { lines: readonly string[]; urgent?: boolean; tone: 'duel' | 'solo' }) {
  const line = lines[0] ?? ''
  const color = urgent ? 'var(--c26-red)' : tone === 'solo' ? 'var(--c26-magenta-soft)' : 'var(--c26-gold)'
  const glow = urgent ? 'rgba(255,51,85,0.6)' : tone === 'solo' ? 'rgba(255,140,246,0.5)' : 'rgba(255,210,63,0.55)'
  return (
    <div data-testid="event-line" aria-live="polite" className="t26-events mt-1" style={{ color, textShadow: `0 0 8px ${glow}` }}>
      {line}
    </div>
  )
}
