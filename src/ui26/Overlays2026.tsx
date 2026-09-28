import { useState, type ReactNode } from 'react'
import type { Mode } from '../ui/settings'
import { copyText } from '../ui/clipboard'
import { BallSvg, LandSvg, SnakeSvg } from './SnakeSvg'

/** Оверлеи темы 2026 (VISUAL_2026.md раздел 4 «Прочие экраны»): панели со скосом, Chakra Petch. */

/** Отсчёт 3-2-1 поверх поля: цифра 96px со свечением cyan. */
export function Countdown2026({ value }: { value: number }) {
  if (value <= 0) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-[rgba(5,8,20,0.45)]">
      <span key={value} data-testid="countdown" className="t26-countdown">
        {value}
      </span>
    </div>
  )
}

export function LevelClear2026({ level, bonus, onSkip }: { level: number; bonus: number; onSkip: () => void }) {
  return (
    <button type="button" data-testid="level-clear" onClick={onSkip} className="t26-scrim absolute inset-0 z-[2] flex items-center justify-center font-[inherit]">
      <div className="t26-glow-cyan">
        <div className="cut flex flex-col items-center gap-2 px-7 py-5" style={{ ['--cut' as string]: '12px', ['--edge' as string]: 'linear-gradient(135deg, var(--c26-cyan), var(--c26-violet))' }}>
          <span className="whitespace-nowrap text-[clamp(20px,6.6vw,26px)] font-bold tracking-[0.14em] text-white">LEVEL {level} CLEAR</span>
          <span className="t26-num text-lg font-bold text-[var(--c26-gold)]" style={{ textShadow: '0 0 10px rgba(255,210,63,0.6)' }}>
            BONUS +{bonus}
          </span>
          <span className="t26-label text-[11px]">Tap to go on</span>
        </div>
      </div>
    </button>
  )
}

/** Легенда: мини-панели земли и кусочек тела змеи (как на поле). */
export function Legend2026({ mode }: { mode: Mode }) {
  const cell = 16
  const items: [ReactNode, string][] = [
    [<LandSvg key="l" x={0} y={0} cell={cell} owner="P1" />, 'Your land'],
    [<SnakeSvg key="t" points={[{ x: 0, y: 8 }, { x: 22, y: 8 }]} width={9} px={0.6} headScale={0.8} angle={0} noTaper noHead />, 'Your trail'],
  ]
  if (mode === 'duel') {
    items.push([<LandSvg key="rl" x={0} y={0} cell={cell} owner="P2" />, 'AI land'])
    items.push([<SnakeSvg key="rt" id="P2" points={[{ x: 0, y: 8 }, { x: 22, y: 8 }]} width={9} px={0.6} headScale={0.8} angle={0} noTaper noHead />, 'AI trail'])
  } else {
    items.push([<BallSvg key="b" x={8} y={8} cell={11} />, 'Ball'])
  }
  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-2" data-testid="legend">
      {items.map(([icon, label]) => (
        <li key={label} className="flex items-center gap-2 text-[13px] font-semibold tracking-[0.06em] text-[var(--c26-text)]">
          <svg viewBox="-4 0 30 16" className="h-4 w-[30px] shrink-0" aria-hidden>
            {icon}
          </svg>
          {label}
        </li>
      ))}
    </ul>
  )
}

function PanelButton({ onClick, children, primary = false, autoFocus = false }: { onClick: () => void; children: ReactNode; primary?: boolean; autoFocus?: boolean }) {
  return (
    <button
      type="button"
      autoFocus={autoFocus}
      onClick={onClick}
      className={`cut t26-btn min-h-12 flex-1 text-sm ${primary ? 't26-btn-primary' : ''}`}
      style={primary ? { ['--edge' as string]: 'linear-gradient(135deg, var(--c26-cyan), var(--c26-violet), var(--c26-magenta))' } : undefined}
    >
      {children}
    </button>
  )
}

/** Пауза: панель со скосом 12px, легенда, RESUME / RESTART / MENU. */
export function Pause2026({ mode, onResume, onRestart, onMenu }: { mode: Mode; onResume: () => void; onRestart: () => void; onMenu: () => void }) {
  return (
    <div className="t26-scrim absolute inset-0 z-10 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="pause-title" data-testid="pause-screen">
      <div className="cut mx-4 flex w-full max-w-xs flex-col gap-3 p-5" style={{ ['--cut' as string]: '12px', ['--edge' as string]: 'linear-gradient(135deg, var(--c26-cyan), var(--c26-violet))' }}>
        <h2 id="pause-title" className="text-center text-2xl font-bold tracking-[0.24em] text-white">
          PAUSED
        </h2>
        <div className="flex justify-center py-1">
          <Legend2026 mode={mode} />
        </div>
        <PanelButton primary autoFocus onClick={onResume}>
          Resume
        </PanelButton>
        <PanelButton onClick={onRestart}>Restart</PanelButton>
        <PanelButton onClick={onMenu}>Menu</PanelButton>
      </div>
    </div>
  )
}

/** Конец партии: панель внизу (поле с последним кадром видно), итог и кнопки. */
export function GameOver2026({
  title,
  titleColor = 'var(--c26-text)',
  reason,
  children,
  onPlayAgain,
  onMenu,
  perfJson,
}: {
  title: string
  titleColor?: string
  reason?: string
  children?: ReactNode
  onPlayAgain: () => void
  onMenu?: () => void
  perfJson?: () => string
}) {
  const [perfCopy, setPerfCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-end bg-[rgba(5,8,20,0.55)]" data-testid="game-over">
      <div
        className="cut mx-4 mb-4 flex flex-col items-center gap-2 px-4 py-5"
        style={{ ['--cut' as string]: '12px', ['--edge' as string]: 'linear-gradient(135deg, var(--c26-cyan), var(--c26-violet), var(--c26-magenta))' }}
      >
        <div className="t26-label">Game over</div>
        <div className="text-[30px] font-bold leading-tight tracking-[0.1em]" style={{ color: titleColor, textShadow: '0 0 12px currentColor' }}>
          {title}
        </div>
        {reason && <div className="text-center text-[15px] text-[var(--c26-text-muted)]">{reason}</div>}
        {children}
        <div className="mt-1 flex w-full gap-3">
          <PanelButton primary onClick={onPlayAgain}>
            Play again
          </PanelButton>
          {onMenu && <PanelButton onClick={onMenu}>Menu</PanelButton>}
        </div>
        {perfJson && (
          <button
            type="button"
            data-testid="copy-perf"
            onClick={async () => setPerfCopy((await copyText(perfJson())) ? 'copied' : 'failed')}
            className="min-h-11 px-3 text-xs text-[var(--c26-text-muted)] underline underline-offset-2"
          >
            {perfCopy === 'copied' ? 'Copied' : perfCopy === 'failed' ? 'Copy failed' : 'Copy perf'}
          </button>
        )}
      </div>
    </div>
  )
}
