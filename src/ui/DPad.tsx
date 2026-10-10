import { OPPOSITE_DIRECTION } from '../engine/constants'
import type { Direction } from '../engine/types'
import { PixelArrow } from './Board'

interface Props {
  /** Последнее направление, которое получит змейка (хвост очереди или текущее). */
  heading: Direction
  onSteer: (direction: Direction) => void
  disabled?: boolean
  /** Сторона креста, px (исходно 204): меньше — пропорционально, вместе с зонами нажатия. */
  size?: number
}

/** Крест 3 × 64 с зазором 6. */
export const DPAD_PX = 3 * 64 + 2 * 6

const BUTTONS: { dir: Direction; area: string }[] = [
  { dir: 'UP', area: 'up' },
  { dir: 'LEFT', area: 'left' },
  { dir: 'RIGHT', area: 'right' },
  { dir: 'DOWN', area: 'down' },
]

/**
 * D-pad меняет направление, а не делает ход. Неактивен только разворот
 * относительно последнего направления в очереди.
 */
export function DPad({ heading, onSteer, disabled = false, size = DPAD_PX }: Props) {
  const scaled = size !== DPAD_PX
  return (
    // Меньше исходного — пропорционально (transform: и картинка, и зоны нажатия).
    <div style={{ width: size, height: size }}>
      <div style={scaled ? { transform: `scale(${size / DPAD_PX})`, transformOrigin: '0 0' } : undefined}>
        {/* Кнопки стоят крестом, соседние — по диагонали: при gap 6px между ними ≈ 8.5px. */}
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateAreas: '". up ." "left . right" ". down ."',
            gridTemplateColumns: 'repeat(3, 4rem)',
            gridTemplateRows: 'repeat(3, 4rem)',
          }}
        >
          {BUTTONS.map(({ dir, area }) => (
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
              className="flex h-16 w-16 items-center justify-center btn"
            >
              <PixelArrow direction={dir} className="h-7 w-7" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
