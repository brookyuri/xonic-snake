import type { Direction } from '../engine/types'

/** Порог свайпа: меньше — это касание, а не жест. */
export const SWIPE_THRESHOLD_PX = 24

/** Направление свайпа по смещению пальца; null, пока порог не пройден. */
export function swipeDirection(dx: number, dy: number, threshold = SWIPE_THRESHOLD_PX): Direction | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'RIGHT' : 'LEFT'
  return dy > 0 ? 'DOWN' : 'UP'
}
