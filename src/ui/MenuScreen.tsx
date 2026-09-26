import { useState } from 'react'
import { exportStats, formatStatsLine, loadStats } from './stats'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Clipboard API недоступен (http, старый браузер) — копируем через скрытое поле.
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

interface Props {
  onPlay: () => void
  onHowTo: () => void
}

export function MenuScreen({ onPlay, onHowTo }: Props) {
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

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onPlay}
            className="min-h-16 rounded-xl bg-cyan-400 text-lg font-semibold text-neutral-950 active:bg-cyan-300"
          >
            PLAY VS COMPUTER
          </button>
          <button
            type="button"
            disabled
            className="min-h-16 rounded-xl bg-neutral-900 text-lg text-neutral-500"
          >
            PLAY WITH FRIEND
            <span className="block text-xs font-normal uppercase tracking-wider">Coming soon</span>
          </button>
          <button
            type="button"
            onClick={onHowTo}
            className="min-h-16 rounded-xl bg-neutral-800 text-lg text-neutral-100 active:bg-neutral-700"
          >
            HOW TO PLAY
          </button>
        </div>

        <p className="mt-5 text-center text-sm text-neutral-400" data-testid="stats-line">
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
