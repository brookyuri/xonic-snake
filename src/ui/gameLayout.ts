import type { Theme } from '../render/createRenderer'

/**
 * Раскладка игрового экрана (обе темы, оба режима): экран не прокручивается никогда.
 * Сначала фиксированные блоки — шапка (HUD + строка событий, высота замеряется), ряд управления,
 * отступы; поле получает остаток: квадрат min(ширина, оставшаяся высота). Клетка меньше
 * MIN_CELL_PX — пэд уменьшается пропорционально (не ниже MIN_PAD_PX). Пэд остаётся в нижней трети.
 */

export const MIN_CELL_PX = 12
export const MIN_PAD_PX = 132
/** Между зоной нажатия паузы (2026) и любой стрелкой. */
export const PAUSE_GAP_PX = 24

/** Колонка контента: max-w-[480px] px-4. */
const COLUMN_MAX_PX = 480
const COLUMN_PAD_PX = 16
/** Слот поля: py-1. */
const SLOT_PAD_Y_PX = 8

/** 2026: пэд Ø168, стрелка 56 с отступом 2 и рамкой 1.5, пауза 64; ряд — pb-2, заходит в поля на 8px. */
const PAD26_PX = 168
const PAUSE26_PX = 64
const ARROW26_TOP = 1.5 + 56
const ARROW26_SIDE = 1.5 + 2
const ROW26_BOTTOM_PX = 8
/** Рамка 2026 шире сетки на --c26-inset с каждой стороны и заходит в поля экрана на столько же. */
const FRAME26_PX = 9

/** 1986: крест 3 × 64 с зазором 6, ряд pt-2 pb-4; рамка поля 10px. */
const PAD86_PX = 3 * 64 + 2 * 6
const ROW86_TOP_PX = 8
const ROW86_BOTTOM_PX = 16
const FRAME86_PX = 10

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface GameLayoutInput {
  theme: Theme
  /** Видимая область (ширина × высота) в CSS px. */
  width: number
  height: number
  insets: Insets
  /** Высота шапки (HUD + строка событий + отступ сверху), замер. */
  headerPx: number
  /** Клеток по стороне поля. */
  cols: number
}

export interface GameLayout {
  /** Сторона пэда (2026 — круг, 1986 — крест), px. */
  padPx: number
  /** Масштаб пэда относительно исходного размера. */
  padScale: number
  /** 2026: на сколько пэд ниже верха ряда (пауза — у верха ряда). */
  padDropPx: number
  /** 2026: зазор между колонками ряда (пусто · пэд · пауза). */
  gapPx: number
  /** Высота ряда управления. */
  controlsPx: number
  /** Внешняя сторона поля (с рамкой) и сетка внутри неё. */
  boardPx: number
  gridPx: number
  cellPx: number
  /** Сумма блоков по высоте (с safe-area): ≤ height. */
  usedPx: number
  /** 2026: расстояние от зоны паузы до ближайшей стрелки. */
  pauseGapPx: number
  /** Верх пэда от верха видимой области (пэд прижат к низу ряда). */
  padTopPx: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Ряд управления при стороне пэда pad. */
function controls(theme: Theme, width: number, insets: Insets, pad: number) {
  if (theme === '1986') {
    return { padDropPx: 0, gapPx: 0, controlsPx: ROW86_TOP_PX + pad + ROW86_BOTTOM_PX, pauseGapPx: Infinity, bottomPx: ROW86_BOTTOM_PX }
  }
  const s = pad / PAD26_PX
  // Ряд «64 · пэд · 64» заходит в поля экрана до 8px от края; зазор 4..16px.
  const gapPx = clamp((width - insets.left - insets.right - 16 - (2 * PAUSE26_PX + pad)) / 2, 4, 16)
  // Пауза у верха ряда, пэд ниже: её низ выше верха правой стрелки, по диагонали ≥ 24px.
  const dx = gapPx + ARROW26_SIDE * s
  const dy = dx >= PAUSE_GAP_PX ? 1 : Math.sqrt(PAUSE_GAP_PX ** 2 - dx ** 2) + 1
  const padDropPx = Math.max(0, Math.ceil(PAUSE26_PX + dy - ARROW26_TOP * s))
  const vertical = padDropPx + ARROW26_TOP * s - PAUSE26_PX
  return {
    padDropPx,
    gapPx,
    controlsPx: Math.max(PAUSE26_PX, padDropPx + pad) + ROW26_BOTTOM_PX,
    pauseGapPx: Math.hypot(dx, Math.max(0, vertical)),
    bottomPx: ROW26_BOTTOM_PX,
  }
}

export function gameLayout(input: GameLayoutInput): GameLayout {
  const { theme, width, height, insets, headerPx, cols } = input
  const base = theme === '2026' ? PAD26_PX : PAD86_PX
  const frame = theme === '2026' ? FRAME26_PX : FRAME86_PX
  const column = Math.min(COLUMN_MAX_PX, width - insets.left - insets.right)
  // 2026: рамка заходит в поля экрана на FRAME26_PX с каждой стороны.
  const boardWidth = column - 2 * COLUMN_PAD_PX + (theme === '2026' ? 2 * FRAME26_PX : 0)
  const inner = height - insets.top - insets.bottom

  const at = (pad: number) => {
    const row = controls(theme, width, insets, pad)
    const free = inner - headerPx - row.controlsPx - SLOT_PAD_Y_PX
    const boardPx = Math.floor(Math.max(0, Math.min(boardWidth, free)))
    const gridPx = Math.max(0, boardPx - 2 * frame)
    return { ...row, boardPx, gridPx, cellPx: gridPx / cols }
  }

  // Пэд в нижней трети: его верх не выше 2/3 видимой высоты.
  const thirdMax = Math.floor(height / 3 - insets.bottom - controls(theme, width, insets, base).bottomPx)
  let pad = clamp(Math.min(base, thirdMax), MIN_PAD_PX, base)
  let r = at(pad)
  while (r.cellPx < MIN_CELL_PX && pad > MIN_PAD_PX) r = at(--pad)

  const usedPx = insets.top + headerPx + SLOT_PAD_Y_PX + r.boardPx + r.controlsPx + insets.bottom
  return {
    padPx: pad,
    padScale: pad / base,
    padDropPx: r.padDropPx,
    gapPx: r.gapPx,
    controlsPx: r.controlsPx,
    boardPx: r.boardPx,
    gridPx: r.gridPx,
    cellPx: r.cellPx,
    usedPx,
    pauseGapPx: r.pauseGapPx,
    padTopPx: height - insets.bottom - r.bottomPx - pad,
  }
}
