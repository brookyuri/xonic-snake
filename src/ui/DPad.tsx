import { OPPOSITE_DIRECTION } from '../engine/constants'
import type { Direction } from '../engine/types'

interface Props {
  /** Последнее направление, которое получит змейка (хвост очереди или текущее). */
  heading: Direction
  onSteer: (direction: Direction) => void
  disabled?: boolean
}

const BUTTONS: { dir: Direction; label: string; area: string }[] = [
  { dir: 'UP', label: '↑', area: 'up' },
  { dir: 'LEFT', label: '←', area: 'left' },
  { dir: 'RIGHT', label: '→', area: 'right' },
  { dir: 'DOWN', label: '↓', area: 'down' },
]

/**
 * D-pad меняет направление, а не делает ход. Неактивен только разворот
 * относительно последнего направления в очереди.
 */
export function DPad({ heading, onSteer, disabled = false }: Props) {
  return (
    // Кнопки стоят крестом, соседние — по диагонали: при gap 6px между ними ≈ 8.5px.
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
          aria-label={`Steer ${dir.toLowerCase()}`}
          data-dir={dir}
          disabled={disabled || dir === OPPOSITE_DIRECTION[heading]}
          // pointerdown, а не click: поворот засчитывается в момент касания.
          onPointerDown={(event) => {
            event.preventDefault()
            onSteer(dir)
          }}
          style={{ gridArea: area }}
          className="flex h-16 w-16 items-center justify-center btn text-2xl"
        >
          {label}
        </button>
      ))}
    </div>
  )
}
