import { useState } from 'react'
import { exportStats, formatStatsLine, loadStats } from './stats'
import { copyText } from './clipboard'
import type { Difficulty, Settings } from './settings'
import type { Speed } from '../game/config'

interface Props {
  settings: Settings
  onSettingsChange: (settings: Settings) => void
  onPlay: () => void
  onHowTo: () => void
}

/** Сегментированный переключатель: радиогруппа с зоной касания 44px на вариант. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-neutral-400">{label}</div>
      <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl bg-neutral-900 p-1">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`min-h-11 flex-1 rounded-lg text-base transition-colors duration-150 ${
                selected ? 'bg-neutral-700 font-semibold text-neutral-50' : 'text-neutral-400 active:bg-neutral-800'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
]

const SPEED_OPTIONS: { value: Speed; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
]

export function MenuScreen({ settings, onSettingsChange, onPlay, onHowTo }: Props) {
  const [stats] = useState(loadStats)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  return (
    <div className="screen">
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col px-4 pb-4 text-neutral-100">
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <h1 className="text-center text-4xl font-bold tracking-widest">
            <span className="text-cyan-300">TERRITORY</span>
            <br />
            <span className="text-red-300">SNAKE</span>
          </h1>
        </div>

        <div className="mb-4 flex flex-col gap-3">
          <Segmented
            label="Difficulty"
            value={settings.difficulty}
            options={DIFFICULTIES}
            onChange={(difficulty) => onSettingsChange({ ...settings, difficulty })}
          />
          <Segmented
            label="Speed"
            value={settings.speed}
            options={SPEED_OPTIONS}
            onChange={(speed) => onSettingsChange({ ...settings, speed })}
          />
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onPlay}
            className="min-h-14 rounded-xl bg-cyan-400 text-lg font-semibold text-neutral-950 active:bg-cyan-300"
          >
            PLAY VS COMPUTER
          </button>
          <button
            type="button"
            disabled
            className="min-h-14 rounded-xl bg-neutral-900 text-lg text-neutral-500"
          >
            PLAY WITH FRIEND
            <span className="block text-xs font-normal uppercase tracking-wider">Coming soon</span>
          </button>
          <button
            type="button"
            onClick={onHowTo}
            className="min-h-14 rounded-xl bg-neutral-800 text-lg text-neutral-100 active:bg-neutral-700"
          >
            HOW TO PLAY
          </button>
        </div>

        <p className="mt-4 text-center text-sm text-neutral-400" data-testid="stats-line">
          {formatStatsLine(stats)}
        </p>
        <button
          type="button"
          onClick={async () => setCopyStatus((await copyText(exportStats())) ? 'copied' : 'failed')}
          className="mx-auto mt-1 min-h-10 px-3 text-xs text-neutral-500 underline underline-offset-2"
        >
          {copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Export stats'}
        </button>
      </div>
    </div>
  )
}
