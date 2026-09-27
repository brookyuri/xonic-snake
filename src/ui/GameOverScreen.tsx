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
    <div className="absolute inset-0 flex flex-col justify-end bg-ts-scrim" data-testid="game-over">
      <div className="mx-4 mb-4 flex flex-col items-center gap-3 border-2 border-ts-border bg-ts-bg px-4 py-5 text-ts-text">
        <div className="text-3xl font-bold tracking-wide">{title}</div>
        <div className="text-center text-lg text-ts-text2">{reason}</div>
        <div className="flex gap-6 text-sm">
          <span className="text-ts-blue">BLUE {bluePercent}%</span>
          <span className="text-ts-red">RED {redPercent}%</span>
        </div>
        <div className="mt-1 flex w-full gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="min-h-14 flex-1 btn text-lg text-ts-timer"
          >
            PLAY AGAIN
          </button>
          {onMenu && (
            <button
              type="button"
              onClick={onMenu}
              className="min-h-14 flex-1 btn text-lg"
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
            className="min-h-10 px-3 text-xs text-ts-text2 underline underline-offset-2"
          >
            {perfCopy === 'copied' ? 'Copied' : perfCopy === 'failed' ? 'Copy failed' : 'Copy perf'}
          </button>
        )}
      </div>
    </div>
  )
}
