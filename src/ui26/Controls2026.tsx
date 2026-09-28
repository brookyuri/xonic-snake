import { OPPOSITE_DIRECTION } from '../engine/constants'
import type { Direction } from '../engine/types'

/**
 * Управление темы 2026 (VISUAL_2026.md «Управление»): круглый пэд Ø168 с 4 кнопками-стрелками
 * 56×56 (активное направление — белое со свечением), сфера в центре; справа — пауза 64×64,
 * слева пусто для симметрии. Как и в 1986, неактивен только разворот.
 */

const BUTTONS: { dir: Direction; style: React.CSSProperties; rotate: number }[] = [
  { dir: 'UP', style: { left: 56, top: 2 }, rotate: 0 },
  { dir: 'LEFT', style: { left: 2, top: 56 }, rotate: -90 },
  { dir: 'RIGHT', style: { right: 2, top: 56 }, rotate: 90 },
  { dir: 'DOWN', style: { left: 56, bottom: 2 }, rotate: 180 },
]

export function Pad2026({ heading, onSteer, disabled = false }: { heading: Direction; onSteer: (d: Direction) => void; disabled?: boolean }) {
  return (
    <div className="t26-pad" data-testid="pad">
      {BUTTONS.map(({ dir, style, rotate }) => (
        <button
          key={dir}
          type="button"
          aria-label={`Steer ${dir.toLowerCase()}`}
          data-dir={dir}
          data-active={!disabled && dir === heading}
          disabled={disabled || dir === OPPOSITE_DIRECTION[heading]}
          // pointerdown, а не click: поворот засчитывается в момент касания.
          onPointerDown={(event) => {
            event.preventDefault()
            onSteer(dir)
          }}
          className="t26-pad-btn"
          style={style}
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" style={{ transform: `rotate(${rotate}deg)` }} aria-hidden>
            <path d="M5 15.5 L12 8.5 L19 15.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
      <span className="t26-pad-core" aria-hidden />
    </div>
  )
}

export function PauseButton2026({ disabled, onPause }: { disabled: boolean; onPause: () => void }) {
  return (
    <button
      type="button"
      aria-label="Pause"
      data-testid="pause"
      disabled={disabled}
      onClick={onPause}
      className="cut t26-btn h-16 w-16"
      style={{ ['--cut' as string]: '12px', ['--edge' as string]: 'linear-gradient(135deg, var(--c26-cyan), var(--c26-violet))' }}
    >
      <svg viewBox="0 0 20 20" className="h-6 w-6" aria-hidden>
        <path d="M6 4h3v12H6zM11 4h3v12h-3z" fill="var(--c26-cyan-soft)" />
      </svg>
    </button>
  )
}

/** Нижний ряд: пусто 64 · пэд 168 · пауза 64. */
export function Controls2026({
  heading,
  onSteer,
  canSteer,
  onPause,
}: {
  heading: Direction
  onSteer: (d: Direction) => void
  canSteer: boolean
  onPause: () => void
}) {
  return (
    // На 320 px 64 + 168 + 64 шире колонки контента — ряд заходит в поля экрана, зазор сжимается.
    <div className="-mx-2 grid grid-cols-[64px_168px_64px] items-center justify-center gap-[clamp(4px,3.5vw,16px)] pb-3 pt-1" data-testid="dpad">
      <span aria-hidden />
      <Pad2026 heading={heading} onSteer={onSteer} disabled={!canSteer} />
      <PauseButton2026 disabled={!canSteer} onPause={onPause} />
    </div>
  )
}
