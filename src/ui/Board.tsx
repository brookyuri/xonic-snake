import type { Direction, GameState, PlayerId, Pos } from '../engine/types'
import { ARROW_PATH } from '../render/dom8bit'

/** Клетки, захваченные в последнем тике (ключ y*size+x → захватчик). */
export interface Flash {
  cells: Map<number, PlayerId>
}

const ARROW_ROTATION: Record<Direction, number> = { UP: 0, RIGHT: 90, DOWN: 180, LEFT: 270 }

/** Голова змейки на поле. */
export interface HeadView {
  id: PlayerId
  pos: Pos
  direction: Direction
}

/** Головы Duel: BLUE и RED. */
export const duelHeads = (state: GameState): HeadView[] =>
  (['P1', 'P2'] as const).map((id) => ({ id, pos: state.players[id].head, direction: state.players[id].direction }))

/** Пиксельная стрелка 7×7, смотрит вверх; поворот — на кратные 90°, пиксели не размываются. */
export function PixelArrow({ direction, className = '' }: { direction: Direction; className?: string }) {
  return (
    <svg
      viewBox="0 0 7 7"
      shapeRendering="crispEdges"
      className={className}
      style={{ transform: `rotate(${ARROW_ROTATION[direction]}deg)` }}
      aria-hidden
    >
      <path d={ARROW_PATH} fill="currentColor" />
    </svg>
  )
}

export type LegendItem = readonly [className: string, label: string]

export const DUEL_LEGEND: readonly LegendItem[] = [
  ['cell-p1-land', 'Your land'],
  ['cell-p1-trail', 'Your trail'],
  ['cell-p2-land', 'RED land'],
  ['cell-p2-trail', 'RED trail'],
]

/** 'ball' — не заливка клетки, а сам шарик на пустой клетке. */
export const SOLO_LEGEND: readonly LegendItem[] = [
  ['cell-p1-land', 'Your land'],
  ['cell-p1-trail', 'Your trail'],
  ['ball', 'Ball'],
]

/** Легенда (правила, пауза): те же заливки, штриховки и шарик, что и на поле. */
export function Legend({ items = DUEL_LEGEND }: { items?: readonly LegendItem[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1 font-pixel text-[10px] uppercase text-ts-text2" data-testid="legend">
      {items.map(([cls, label]) => (
        <li key={cls} className="flex items-center gap-2">
          {cls === 'ball' ? (
            <span className="cell inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
              <span className="ball" />
            </span>
          ) : (
            <span className={`cell ${cls} inline-block h-3.5 w-3.5 shrink-0`} aria-hidden />
          )}
          {label}
        </li>
      ))}
    </ul>
  )
}
