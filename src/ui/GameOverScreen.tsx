import type { GameResult, Reason } from '../engine/types'

interface Props {
  result: GameResult
  bluePercent: number
  redPercent: number
  onPlayAgain: () => void
}

const REASON_LABEL: Record<Reason, string> = {
  TRAIL_CUT: 'Trail cut',
  SELF_TRAIL: 'Ran into own trail',
  ENGULFED: 'Territory engulfed',
  HEAD_ON: 'Head-on collision',
  MUTUAL: 'Mutual collision',
  NO_TERRITORY: 'Lost all territory',
  ROUND_LIMIT: 'Round limit reached',
}

export function GameOverScreen({ result, bluePercent, redPercent, onPlayAgain }: Props) {
  const title =
    result.winner === 'DRAW' ? 'DRAW' : result.winner === 'P1' ? 'BLUE WINS' : 'RED WINS'

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 text-neutral-100 rounded-lg">
      <div className="text-3xl font-bold tracking-wide">{title}</div>
      <div className="text-neutral-400">{REASON_LABEL[result.reason]}</div>
      <div className="flex gap-6 text-sm">
        <span className="text-cyan-300">BLUE {bluePercent}%</span>
        <span className="text-red-300">RED {redPercent}%</span>
      </div>
      <button
        type="button"
        onClick={onPlayAgain}
        className="mt-4 min-h-14 px-6 rounded-lg bg-neutral-800 text-neutral-100 text-lg"
      >
        PLAY AGAIN
      </button>
    </div>
  )
}
