import type { Direction } from '../engine/types'

interface Props {
  legalMoves: Direction[]
  onMove: (direction: Direction) => void
}

const BUTTONS: { dir: Direction; label: string; area: string }[] = [
  { dir: 'UP', label: '↑', area: 'up' },
  { dir: 'LEFT', label: '←', area: 'left' },
  { dir: 'RIGHT', label: '→', area: 'right' },
  { dir: 'DOWN', label: '↓', area: 'down' },
]

export function DPad({ legalMoves, onMove }: Props) {
  return (
    <div
      className="grid gap-1.5"
      style={{
        gridTemplateAreas: '". up ." "left . right" ". down ."',
        gridTemplateColumns: 'repeat(3, 4rem)',
        gridTemplateRows: 'repeat(3, 4rem)',
      }}
    >
      {BUTTONS.map(({ dir, label, area }) => (
        <button
          key={dir}
          type="button"
          aria-label={dir}
          disabled={!legalMoves.includes(dir)}
          onClick={() => onMove(dir)}
          style={{ gridArea: area }}
          className="h-16 w-16 rounded-xl bg-neutral-800 text-neutral-100 text-2xl flex items-center justify-center select-none active:bg-neutral-700 disabled:opacity-25 disabled:cursor-not-allowed"
        >
          {label}
        </button>
      ))}
    </div>
  )
}
