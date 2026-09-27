import type { SoloEvent, SoloState } from '../engine/solo'

const cells = (n: number) => `${n} ${n === 1 ? 'cell' : 'cells'}`

/** Строка событий Solo за тик (UPPERCASE делает CSS). */
export function describeSoloTick(events: readonly SoloEvent[]): string[] {
  const lines: string[] = []
  for (const e of events) {
    if (e.type === 'CAPTURED') lines.push(`+${cells(e.cells.length)}`)
    if (e.type === 'LIFE_LOST') lines.push(e.reason === 'BALL_HIT' ? 'Ball hit!' : 'Own trail!')
  }
  return lines
}

/** Начало уровня: «LEVEL 2 — 3 BALLS». */
export function levelIntro(level: number): string {
  const balls = level + 1
  return `Level ${level} — ${balls} ${balls === 1 ? 'ball' : 'balls'}`
}

/** Прогресс в HUD: «42%/75%». Проценты вниз — 75% только когда уровень реально пройден. */
export function progressLabel(state: Pick<SoloState, 'progress'>): string {
  return `${Math.floor(state.progress * 100)}%/75%`
}

/** Почему партия закончилась — по последнему LIFE_LOST. */
export function soloEndReason(events: readonly SoloEvent[]): string {
  const hit = [...events].reverse().find((e) => e.type === 'LIFE_LOST')
  if (hit?.type === 'LIFE_LOST' && hit.reason === 'SELF_TRAIL') return 'You crossed your own trail'
  return 'A ball hit your trail'
}
