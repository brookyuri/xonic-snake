import type { PlayerId } from '../../engine/types'

/** Токены темы 2026 для поля (VISUAL_2026.md раздел 2). */
export const C = {
  bg: '#050814',
  boardInner: '#0c1836',
  boardOuter: '#060b1c',
  grid: 'rgba(70,130,255,0.13)',
  cyan: 0x22e5ff,
  magenta: 0xff3df0,
  white: 0xffffff,
}

/** Стеклянная панель земли: заливка 135° от from к to, обводка, внутреннее свечение. */
export interface LandStyle {
  from: string
  to: string
  stroke: string
  glow: string
}

export const LAND: Record<'P1' | 'P2' | 'FRAME', LandStyle> = {
  P1: { from: 'rgba(34,229,255,0.40)', to: 'rgba(34,120,255,0.16)', stroke: 'rgba(120,240,255,0.55)', glow: 'rgba(34,229,255,0.30)' },
  P2: { from: 'rgba(255,51,85,0.38)', to: 'rgba(160,20,70,0.16)', stroke: 'rgba(255,130,155,0.55)', glow: 'rgba(255,51,85,0.28)' },
  // Рамка Solo (стартовая земля): как земля игрока, но слабее.
  FRAME: { from: 'rgba(34,229,255,0.30)', to: 'rgba(34,120,255,0.12)', stroke: 'rgba(120,240,255,0.45)', glow: 'rgba(34,229,255,0.22)' },
}

/** Змея игрока (синяя) и AI (красная). */
export interface SnakePalette {
  glow: number
  outline: number
  body: number
  deep: number
  ring: number
  sheen: number
  /** Вертикальный градиент головы сверху вниз. */
  head: [string, string, string]
  eye: number
  pupil: number
  tongue: number
}

export const SNAKE: Record<PlayerId, SnakePalette> = {
  P1: {
    glow: 0x22e5ff,
    outline: 0x062a55,
    body: 0x1fb6ff,
    deep: 0x0b3f8f,
    ring: 0xff3df0,
    sheen: 0xd6fbff,
    head: ['#b8f8ff', '#1fb6ff', '#0b3f8f'],
    eye: 0xfff6a8,
    pupil: 0x041022,
    tongue: 0xff3df0,
  },
  P2: {
    glow: 0xff3355,
    outline: 0x4a0616,
    body: 0xff3355,
    deep: 0x7a0a22,
    ring: 0xffb020,
    sheen: 0xffd0d8,
    head: ['#ffc6d0', '#ff3355', '#6e0a20'],
    eye: 0xfff3a0,
    pupil: 0x1a0208,
    tongue: 0xffb020,
  },
}
