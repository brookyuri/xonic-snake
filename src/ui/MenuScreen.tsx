import { useEffect, useState } from 'react'
import { exportStats, formatSoloStatsLine, formatStatsLine, loadSoloStats, loadStats } from './stats'
import { copyText } from './clipboard'
import type { Difficulty, Mode, Settings } from './settings'
import type { Speed } from '../game/config'
import { preloadPixi, type Theme } from '../render/createRenderer'

interface Props {
  settings: Settings
  onSettingsChange: (settings: Settings) => void
  onPlay: () => void
  onHowTo: () => void
}

/**
 * Сегментированный переключатель: радиогруппа с зоной касания 44px на вариант.
 * inline — подпись слева в той же строке (компактно, для низких экранов).
 */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  inline = false,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  inline?: boolean
}) {
  return (
    <div className={inline ? 'flex items-center gap-2' : ''}>
      <div className={`font-pixel text-[10px] uppercase text-ts-text2 ${inline ? 'flex-1' : 'mb-2'}`}>{label}</div>
      <div role="radiogroup" aria-label={label} className={`flex gap-2 ${inline ? 'w-[60%]' : ''}`}>
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              // Выбранный вариант инвертирован (.btn[aria-checked=true]).
              className="btn min-h-11 flex-1 text-xs"
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const MODES: { value: Mode; label: string }[] = [
  { value: 'duel', label: 'DUEL' },
  { value: 'solo', label: 'SOLO' },
]

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
]

// Временный переключатель темы поля (полный редизайн меню — следующая сессия).
const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: '1986', label: '1986' },
  { value: '2026', label: '2026' },
]

const SPEED_OPTIONS: { value: Speed; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
]

export function MenuScreen({ settings, onSettingsChange, onPlay, onHowTo }: Props) {
  const [stats] = useState(loadStats)
  const [soloStats] = useState(loadSoloStats)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  // Тема 2026: чанк Pixi начинает грузиться уже в меню, к PLAY он обычно готов.
  useEffect(() => {
    if (settings.theme === '2026') preloadPixi().catch(() => {})
  }, [settings.theme])

  return (
    <div className="screen">
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col px-4 pb-4 text-ts-text">
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <h1 className="text-center font-pixel text-[clamp(20px,7vw,32px)] leading-snug">
            <span className="text-ts-blue">XONIC</span>
            <br />
            <span className="text-ts-red">SNAKE</span>
          </h1>
          {/* Декоративная строка; на экранах ниже 700px (320×568, 375×667) место нужнее переключателям. */}
          <p className="mt-4 font-pixel text-[10px] text-ts-text [@media(max-height:700px)]:hidden" aria-hidden>
            PRESS PLAY
            <span className="cursor-blink ml-1 inline-block h-[10px] w-[10px] bg-ts-text align-top" />
          </p>
        </div>

        <div className="mb-4 flex flex-col gap-3">
          <Segmented
            label="Mode"
            value={settings.mode}
            options={MODES}
            onChange={(mode) => onSettingsChange({ ...settings, mode })}
          />
          {settings.mode === 'duel' && (
            <Segmented
              label="Difficulty"
              value={settings.difficulty}
              options={DIFFICULTIES}
              onChange={(difficulty) => onSettingsChange({ ...settings, difficulty })}
            />
          )}
          <Segmented
            label="Speed"
            value={settings.speed}
            options={SPEED_OPTIONS}
            onChange={(speed) => onSettingsChange({ ...settings, speed })}
          />
          <Segmented
            label="Graphics"
            value={settings.theme}
            options={THEME_OPTIONS}
            onChange={(theme) => onSettingsChange({ ...settings, theme })}
            inline
          />
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onPlay}
            data-testid="play"
            className="min-h-14 btn text-sm text-ts-timer"
          >
            {settings.mode === 'solo' ? 'PLAY SOLO' : 'PLAY VS COMPUTER'}
          </button>
          <button
            type="button"
            disabled
            // Заглушка «скоро»: на низких экранах (320×568) место нужнее статистике.
            className="min-h-14 btn text-sm text-ts-text2 [@media(max-height:600px)]:hidden"
          >
            PLAY WITH FRIEND
            <span className="mt-1 block text-[10px] uppercase">Coming soon</span>
          </button>
          <button
            type="button"
            onClick={onHowTo}
            className="min-h-14 btn text-sm"
          >
            HOW TO PLAY
          </button>
        </div>

        {/* На 320×568 — меньше отступ: «Export stats» не ближе 8px к нижнему краю. */}
        <p className="mt-4 text-center font-mono text-sm text-ts-text2 [@media(max-height:600px)]:mt-1" data-testid="stats-line">
          {settings.mode === 'solo' ? formatSoloStatsLine(soloStats) : formatStatsLine(stats)}
        </p>
        <button
          type="button"
          onClick={async () => setCopyStatus((await copyText(exportStats())) ? 'copied' : 'failed')}
          className="mx-auto mt-1 min-h-11 px-3 font-mono text-xs text-ts-text2 underline underline-offset-2"
        >
          {copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Export stats'}
        </button>
      </div>
    </div>
  )
}
