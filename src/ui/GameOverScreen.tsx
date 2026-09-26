import { useState } from 'react'
import { copyText } from './clipboard'

interface Props {
  title: string
  reason: string
  bluePercent: number
  redPercent: number
  onPlayAgain: () => void
  onMenu?: () => void
  /** Только в режиме ?perf: JSON с замерами для кнопки "Copy perf". */
  perfJson?: () => string
}

/**
 * Полупрозрачный оверлей: поле с подсвеченной клеткой столкновения остаётся видно,
 * итог — в нижней части экрана, где был D-pad.
 */
export function GameOverScreen({ title, reason, bluePercent, redPercent, onPlayAgain, onMenu, perfJson }: Props) {
  const [perfCopy, setPerfCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  return (
    <div className="absolute inset-0 flex flex-col justify-end bg-black/40" data-testid="game-over">
      <div className="mx-4 mb-4 flex flex-col items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950/95 px-4 py-5 text-neutral-100">
        <div className="text-3xl font-bold tracking-wide">{title}</div>
        <div className="text-center text-lg text-neutral-200">{reason}</div>
        <div className="flex gap-6 text-sm">
          <span className="text-cyan-300">BLUE {bluePercent}%</span>
          <span className="text-red-300">RED {redPercent}%</span>
        </div>
        <div className="mt-1 flex w-full gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="min-h-14 flex-1 rounded-lg bg-cyan-400 text-lg font-semibold text-neutral-950 active:bg-cyan-300"
          >
            PLAY AGAIN
          </button>
          {onMenu && (
            <button
              type="button"
              onClick={onMenu}
              className="min-h-14 flex-1 rounded-lg bg-neutral-800 text-lg text-neutral-100 active:bg-neutral-700"
            >
              MENU
            </button>
          )}
        </div>
        {perfJson && (
          <button
            type="button"
            data-testid="copy-perf"
            onClick={async () => setPerfCopy((await copyText(perfJson())) ? 'copied' : 'failed')}
            className="min-h-10 px-3 text-xs text-neutral-400 underline underline-offset-2"
          >
            {perfCopy === 'copied' ? 'Copied' : perfCopy === 'failed' ? 'Copy failed' : 'Copy perf'}
          </button>
        )}
      </div>
    </div>
  )
}
