import type { Cell, Direction, PlayerId, Pos } from '../engine/types'
import { cellCenter, DIRECTION_ANGLE, type Pt } from '../render/geometry'
import type { Mode } from '../ui/settings'
import { Legend2026 } from './Overlays2026'
import { BallSvg, LandSvg, SnakeSvg } from './SnakeSvg'

export interface HowToStep {
  text: string
  board: Cell[][]
  heads: { id: PlayerId; pos: Pos; direction: Direction }[]
  balls?: Pos[]
}

/**
 * Клетки следа по порядку для схемы: от головы по соседним клеткам следа. На схемах у
 * игроков нет списка trail — только клетки доски.
 */
export function orderedTrail(board: readonly (readonly Cell[])[], head: Pos, owner: PlayerId): Pos[] {
  const isTrail = (p: Pos) => board[p.y]?.[p.x]?.trail === owner
  const seen = new Set([`${head.x},${head.y}`])
  const path: Pos[] = []
  let cur = head
  for (;;) {
    const next = [
      { x: cur.x, y: cur.y - 1 },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x + 1, y: cur.y },
    ].find((p) => isTrail(p) && !seen.has(`${p.x},${p.y}`))
    if (!next) break
    seen.add(`${next.x},${next.y}`)
    path.push(next)
    cur = next
  }
  return path.reverse()
}

/** Мини-поле схемы в стиле 2026: фон, сетка, земля-панели, змеи, шарики (статичный SVG). */
export function MiniBoard({ step }: { step: HowToStep }) {
  const cell = 16
  const n = step.board.length
  const size = n * cell
  return (
    <div className="cut shrink-0 p-[3px]" style={{ ['--cut' as string]: '6px', ['--edge' as string]: 'linear-gradient(135deg, var(--c26-cyan), var(--c26-violet), var(--c26-magenta))', ['--fill' as string]: 'var(--c26-board-edge)' }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="block h-[clamp(50px,10.5dvh,70px)] w-[clamp(50px,10.5dvh,70px)]" aria-hidden>
        <defs>
          <radialGradient id="mb-bg" cx="0.5" cy="0.4" r="0.75">
            <stop offset="0" stopColor="#0c1836" />
            <stop offset="1" stopColor="#060b1c" />
          </radialGradient>
        </defs>
        <rect width={size} height={size} fill="url(#mb-bg)" />
        {Array.from({ length: n - 1 }, (_, i) => (
          <g key={i} stroke="rgba(70,130,255,0.13)" strokeWidth={0.5}>
            <line x1={(i + 1) * cell} y1={0} x2={(i + 1) * cell} y2={size} />
            <line x1={0} y1={(i + 1) * cell} x2={size} y2={(i + 1) * cell} />
          </g>
        ))}
        {step.board.flatMap((row, y) =>
          row.map((c, x) => (c.territory === 'NONE' ? null : <LandSvg key={`${x},${y}`} x={x * cell} y={y * cell} cell={cell} owner={c.territory} radius={2} />))
        )}
        {step.heads
          .filter((h) => h.pos.x >= 0)
          .map((h) => {
            const trail = orderedTrail(step.board, h.pos, h.id)
            const points: Pt[] = [...trail, h.pos].map((p) => cellCenter(p, cell))
            return (
              <SnakeSvg key={h.id} id={h.id} points={points.length > 1 ? points : [cellCenter(h.pos, cell)]} width={cell * 0.62} px={cell / 24} headScale={cell / 19} angle={DIRECTION_ANGLE[h.direction]} />
            )
          })}
        {(step.balls ?? []).map((b, i) => {
          const c = cellCenter(b, cell)
          return <BallSvg key={i} x={c.x} y={c.y} cell={cell} />
        })}
      </svg>
    </div>
  )
}

export function HowTo2026({ mode, steps, footer, onDone, doneLabel }: { mode: Mode; steps: HowToStep[]; footer: string; onDone: () => void; doneLabel: string }) {
  return (
    <div className={`t26-screen ${mode === 'duel' ? 't26-duel' : ''}`}>
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col px-4 pb-3 pt-[clamp(10px,2dvh,16px)]">
        <h1 className="text-center text-[clamp(16px,3dvh,20px)] font-bold tracking-[0.2em]">
          HOW TO PLAY <span className={mode === 'solo' ? 'text-[var(--c26-magenta-soft)]' : 'text-[var(--c26-cyan)]'}>{mode === 'solo' ? 'SOLO' : 'DUEL'}</span>
        </h1>
        <ol className="mt-2 flex min-h-0 flex-1 flex-col justify-center gap-[clamp(4px,1.2dvh,12px)]">
          {steps.map((step, i) => (
            <li key={i} className="flex items-center gap-3">
              <MiniBoard step={step} />
              <p className="text-[clamp(12.5px,2.3dvh,15px)] leading-snug text-[var(--c26-text)]">
                <span className="mr-1 font-bold text-[var(--c26-cyan)]">{i + 1}.</span>
                {step.text}
              </p>
            </li>
          ))}
        </ol>
        {/* Duel — 5 шагов: на низких экранах (320×568) легенда уступает место шагам (она есть и на паузе). */}
        <div className={`mt-2 flex justify-center ${mode === 'duel' ? '[@media(max-height:600px)]:hidden' : ''}`}>
          <Legend2026 mode={mode} />
        </div>
        <p className="mt-2 text-center text-[clamp(12px,2.1dvh,14px)] leading-snug text-[var(--c26-text-muted)]">
          Swipe on the board, tap the arrows or use arrow keys / WASD.
          <br />
          {footer}
        </p>
        <div className="t26-glow-cyan mt-2">
          <button
            type="button"
            onClick={onDone}
            className="cut t26-btn t26-btn-primary min-h-14 w-full text-base"
            style={{ ['--edge' as string]: 'linear-gradient(135deg, var(--c26-cyan), var(--c26-violet), var(--c26-magenta))' }}
          >
            {doneLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
