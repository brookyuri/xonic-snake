import type { Cell, Direction, GameEvent, PlayerId, Pos } from '../engine/types'
import type { SoloEvent } from '../engine/solo'

/** Какое поле рисуем: от этого зависят только пропорции (VISUAL_2026.md раздел 3), не правила. */
export type BoardVariant = 'duel' | 'solo'

/** Змейка: след по порядку и голова. */
export interface SnakeView {
  id: PlayerId
  /** Клетки следа от первой к голове; пусто — змейка дома. */
  trail: readonly Pos[]
  head: Pos
  /** Где голова была до последнего тика; равна head, если за тик не двигалась. */
  prevHead: Pos
  direction: Direction
  alive: boolean
}

export interface BallView {
  pos: Pos
  /** Клетка до последнего тика; равна pos, если шарик не двигался. */
  prev: Pos
}

/**
 * Нейтральное описание кадра поля. Рендерер не знает правил: только клетки, змейки и
 * шарики, плюс оформление, которое задаёт экран (вспышка захвата, угроза, клетка удара).
 */
export interface RenderSnapshot {
  variant: BoardVariant
  cols: number
  rows: number
  /** Земля и след по клеткам, board[y][x]. */
  board: readonly (readonly Cell[])[]
  snakes: readonly SnakeView[]
  balls: readonly BallView[]
  /** Клетки, захваченные в последнем тике (ключ y*cols+x → захватчик). */
  flash?: ReadonlyMap<number, PlayerId> | null
  /** След человека под угрозой. */
  danger?: boolean
  /** Клетки столкновения / удара. */
  highlight?: readonly Pos[]
  /** 'fill' — мигает вся клетка (конец Duel), 'frame' — только рамка (удар в Solo). */
  highlightStyle?: 'fill' | 'frame'
  /** Идёт отсчёт 3-2-1. */
  loading?: boolean
}

export type RenderEvent = GameEvent | SoloEvent

export interface MountOptions {
  cols: number
  rows: number
  /** Сторона поля в CSS-пикселях. */
  sizePx: number
  reducedMotion: boolean
}

/** VISUAL_2026.md раздел 1: общий интерфейс отрисовки поля. */
export interface BoardRenderer {
  mount(el: HTMLElement, opts: MountOptions): Promise<void>
  /** На каждом тике (и при любой смене кадра без тика — тогда events пустые). */
  update(snapshot: RenderSnapshot, events: readonly RenderEvent[]): void
  /** На каждом кадре rAF; alpha — доля прошедшего тика 0..1 (для плавного движения). */
  frame(alpha: number): void
  resize(sizePx: number): void
  destroy(): void
}
