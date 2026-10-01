import { useEffect, useState, type ReactNode } from 'react'
import type { Speed } from '../game/config'
import { preloadPixi, type Theme } from '../render/createRenderer'
import type { Pt } from '../render/geometry'
import { copyText } from '../ui/clipboard'
import { modeDifficulty, withModeDifficulty, type Difficulty, type Mode, type Settings } from '../ui/settings'
import { exportStats, loadSoloStats, loadStats } from '../ui/stats'
import { BallSvg, SnakeSvg } from './SnakeSvg'

interface Props {
  settings: Settings
  onSettingsChange: (settings: Settings) => void
  onPlay: () => void
  onHowTo: () => void
}

const SPEEDS: Speed[] = ['slow', 'normal', 'fast']

/** Иконка-кнопка 44×44 в скошенной рамке (градиент cyan → #2a5cff). */
function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="cut t26-btn h-11 w-11 text-[var(--c26-cyan-soft)]" style={{ ['--cut' as string]: '8px' }}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  )
}

/** Переключатель 1986 | 2026: рамка cyan → magenta, активный — подсветка градиентом α0.25. */
export function ThemeSwitch({ value, onChange }: { value: Theme; onChange: (theme: Theme) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Graphics"
      className="cut flex h-12 p-[2px]"
      style={{ ['--cut' as string]: '8px', ['--edge' as string]: 'linear-gradient(90deg, var(--c26-cyan), var(--c26-magenta))' }}
    >
      {(['1986', '2026'] as const).map((theme) => (
        <button
          key={theme}
          type="button"
          role="radio"
          aria-checked={value === theme}
          onClick={() => onChange(theme)}
          className="h-full min-w-[52px] px-2 text-sm font-semibold tracking-wider"
          style={{
            color: value === theme ? '#ffffff' : 'var(--c26-text-muted)',
            background: value === theme ? 'linear-gradient(90deg, rgba(34,229,255,0.25), rgba(255,61,240,0.25))' : 'transparent',
          }}
        >
          {theme}
        </button>
      ))}
    </div>
  )
}

/** Герой меню: змея волной в технике поля + шарики; лёгкое «дыхание» (reduced motion — статично). */
function Hero() {
  const points: Pt[] = []
  for (let i = 0; i <= 24; i++) {
    const x = 22 + i * 10
    // Огибающая: хвост и голова на средней линии, волна — посередине.
    const envelope = Math.sin((i / 24) * Math.PI)
    points.push({ x, y: 50 + Math.sin(i * 0.55) * 16 * envelope })
  }
  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  return (
    <svg viewBox="0 0 320 100" className="h-full max-h-[110px] w-full" aria-hidden preserveAspectRatio="xMidYMid meet">
      <g className="t26-breathe" style={{ transformOrigin: '160px 50px', animation: 'hero-breathe 3.2s ease-in-out infinite alternate' }}>
        <SnakeSvg points={points} width={15} px={1} headScale={24 / 19} angle={Math.atan2(last.y - prev.y, last.x - prev.x)} tongue />
      </g>
      <BallSvg x={292} y={26} cell={20} />
      <BallSvg x={36} y={82} cell={16} />
      <BallSvg x={200} y={16} cell={13} />
    </svg>
  )
}

/** Карточка режима 72px: выбранная — сплошная рамка cyan со свечением, другая — violet → magenta. */
function ModeCard({ selected, title, subtitle, onClick }: { selected: boolean; title: string; subtitle: string; onClick: () => void }) {
  return (
    <div className={selected ? 't26-glow-cyan' : ''}>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onClick}
        className="cut flex h-[72px] w-full flex-col items-start justify-center px-4 text-left"
        style={{
          ['--edge' as string]: selected ? 'var(--c26-cyan)' : 'linear-gradient(135deg, var(--c26-violet), var(--c26-magenta))',
          ['--bw' as string]: selected ? '2px' : '1.5px',
        }}
      >
        <span className="text-xl font-bold tracking-[0.12em]" style={{ color: selected ? 'var(--c26-cyan)' : 'var(--c26-text)' }}>
          {title}
        </span>
        <span className="t26-label text-[11px]">{subtitle}</span>
      </button>
    </div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="t26-scrim absolute inset-0 z-20 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="cut w-full max-w-[340px] p-5" style={{ ['--edge' as string]: 'linear-gradient(135deg, var(--c26-cyan), var(--c26-violet))' }} onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-center text-lg font-bold tracking-[0.2em]">{title}</h2>
        {children}
        <button type="button" autoFocus onClick={onClose} className="cut t26-btn mt-4 w-full">
          Close
        </button>
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="t26-label">{label}</span>
      <span className="t26-num text-base font-semibold">{value}</span>
    </div>
  )
}

/** Меню темы 2026 (VISUAL_2026.md раздел 4 «Меню»). */
export function Menu2026({ settings, onSettingsChange, onPlay, onHowTo }: Props) {
  const [stats] = useState(loadStats)
  const [solo] = useState(loadSoloStats)
  const [sheet, setSheet] = useState<'settings' | 'stats' | null>(null)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const set = (patch: Partial<Settings>) => onSettingsChange({ ...settings, ...patch })
  const speedIndex = SPEEDS.indexOf(settings.speed)

  // Тема 2026: чанк Pixi начинает грузиться уже в меню, к PLAY он обычно готов.
  useEffect(() => {
    if (settings.theme === '2026') preloadPixi().catch(() => {})
  }, [settings.theme])

  const exportButton = (
    <button
      type="button"
      onClick={async () => setCopyStatus((await copyText(exportStats())) ? 'copied' : 'failed')}
      className="cut t26-btn mt-3 w-full text-sm"
    >
      {copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Export stats'}
    </button>
  )

  return (
    <div className="t26-screen">
      <div className="relative mx-auto flex h-full w-full max-w-[480px] flex-col gap-[clamp(6px,1.4dvh,12px)] px-4 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <IconButton label="Settings" onClick={() => setSheet('settings')}>
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8" />
          </IconButton>
          <IconButton label="Stats" onClick={() => setSheet('stats')}>
            <path d="M5 20V11M12 20V5M19 20v-7" />
          </IconButton>
          <IconButton label="How to play" onClick={onHowTo}>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6M12 16.8v.2" />
          </IconButton>
          <div className="flex-1" />
          <ThemeSwitch value={settings.theme} onChange={(theme) => set({ theme })} />
        </div>

        <div className="text-center">
          <h1 className="leading-none">
            <span className="t26-logo block pr-[0.1em] text-[clamp(44px,min(18vw,9.5dvh),70px)]">XONIC</span>
            <span className="t26-logo-snake mt-1 block pl-[12px] text-[clamp(18px,3.6dvh,26px)]">SNAKE</span>
          </h1>
          <p className="t26-slogan mt-1">CLASSIC GAME / NEW DIMENSION</p>
        </div>

        {/* Герой занимает свободную высоту; на низких экранах (320×568) его нет — там он был бы полоской. */}
        <div className="flex min-h-0 flex-1 items-center justify-center [@media(max-height:600px)]:hidden">
          <Hero />
        </div>

        <div className="flex justify-center">
          <div className="t26-glow-cyan">
            <button type="button" onClick={onPlay} data-testid="play" className="t26-play flex h-[72px] w-[280px] items-center justify-center gap-3">
              <svg viewBox="0 0 20 20" className="h-6 w-6" aria-hidden>
                <path d="M4 2 L18 10 L4 18 Z" fill="var(--c26-cyan)" />
              </svg>
              <span className="text-[34px] font-bold tracking-[4px] text-white">PLAY</span>
            </button>
          </div>
        </div>

        <div role="radiogroup" aria-label="Mode" className="grid grid-cols-2 gap-3">
          <ModeCard selected={settings.mode === 'solo'} title="SOLO" subtitle="Dodge the orbs" onClick={() => set({ mode: 'solo' })} />
          <ModeCard selected={settings.mode === 'duel'} title="DUEL" subtitle="Play against AI" onClick={() => set({ mode: 'duel' as Mode })} />
        </div>
        {/* Сложность — для обоих режимов, у каждого своя (SOLO_RULES v0.3, раздел 13). */}
        <div role="radiogroup" aria-label="Difficulty" className="grid grid-cols-2 gap-3">
          {(['easy', 'normal'] as Difficulty[]).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={modeDifficulty(settings) === d}
              onClick={() => onSettingsChange(withModeDifficulty(settings, d))}
              className="cut t26-btn text-sm"
              style={{
                ['--edge' as string]: modeDifficulty(settings) === d ? 'var(--c26-cyan)' : 'linear-gradient(135deg, var(--c26-violet), var(--c26-magenta))',
                color: modeDifficulty(settings) === d ? 'var(--c26-cyan)' : 'var(--c26-text)',
              }}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="cut px-4 pb-1 pt-2" style={{ ['--edge' as string]: 'linear-gradient(135deg, var(--c26-cyan), var(--c26-violet))' }}>
          <div className="flex items-center justify-between">
            <label htmlFor="speed" className="t26-label">
              Speed
            </label>
            <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--c26-cyan)]">{settings.speed}</span>
          </div>
          <input
            id="speed"
            type="range"
            min={0}
            max={2}
            step={1}
            value={speedIndex}
            aria-valuetext={settings.speed}
            onChange={(e) => set({ speed: SPEEDS[Number(e.target.value)] })}
            className="t26-range"
            style={{ ['--fill-pct' as string]: `${speedIndex * 50}%` }}
          />
          <div className="-mt-2 flex justify-between text-[11px] font-semibold tracking-[0.14em] text-[var(--c26-text-muted)]">
            <span>SLOW</span>
            <span>NORMAL</span>
            <span>FAST</span>
          </div>
        </div>

        <div className="cut grid grid-cols-3 px-2 py-2 text-center" data-testid="stats-line" style={{ ['--edge' as string]: 'linear-gradient(135deg, var(--c26-violet), var(--c26-magenta))' }}>
          {[
            ['Best score', solo.bestScore, 'var(--c26-gold)'],
            ['Best level', solo.bestLevel, 'var(--c26-gold)'],
            ['Duel wins', stats.wins, 'var(--c26-cyan)'],
          ].map(([label, value, color]) => (
            <div key={label as string}>
              <div className="t26-num text-xl font-bold" style={{ color: color as string }}>
                {value}
              </div>
              <div className="t26-label text-[10px]">{label}</div>
            </div>
          ))}
        </div>

        {sheet === 'settings' && (
          <Sheet title="SETTINGS" onClose={() => setSheet(null)}>
            <div className="flex items-center justify-between">
              <span className="t26-label">Graphics</span>
              <ThemeSwitch value={settings.theme} onChange={(theme) => set({ theme })} />
            </div>
            <p className="mt-3 text-sm text-[var(--c26-text-muted)]">Animations follow your system “reduce motion” setting.</p>
            {exportButton}
          </Sheet>
        )}
        {sheet === 'stats' && (
          <Sheet title="STATS" onClose={() => setSheet(null)}>
            <div className="t26-label mb-1 text-[var(--c26-magenta-soft)]">Solo</div>
            <StatRow label="Played" value={solo.gamesPlayed} />
            <StatRow label="Best score" value={solo.bestScore} />
            <StatRow label="Best level" value={solo.bestLevel} />
            <div className="t26-label mb-1 mt-3 text-[var(--c26-cyan)]">Duel</div>
            <StatRow label="Played" value={stats.gamesPlayed} />
            <StatRow label="Won" value={stats.wins} />
            <StatRow label="Best territory" value={`${stats.bestTerritory}%`} />
            {exportButton}
          </Sheet>
        )}
      </div>
    </div>
  )
}
