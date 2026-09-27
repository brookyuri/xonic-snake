import type { GameEvent } from '../engine/types'

export const DANGER_MESSAGE = 'Your trail is in danger'

const cells = (n: number) => `${n} ${n === 1 ? 'cell' : 'cells'}`

/** Строка событий последнего раунда с точки зрения человека (P1 = "You"). */
export function describeRound(events: GameEvent[]): string[] {
  const lines: string[] = []
  for (const event of events) {
    if (event.type === 'CAPTURED') {
      if (event.player === 'P1') {
        const stolen = event.stolenFromEnemy > 0 ? ` (${event.stolenFromEnemy} from RED)` : ''
        lines.push(`You +${cells(event.cells.length)}${stolen}`)
      } else {
        const stolen = event.stolenFromEnemy > 0 ? ` (${event.stolenFromEnemy} from you)` : ''
        lines.push(`RED +${cells(event.cells.length)}${stolen}`)
      }
    }
    if (event.type === 'TRAIL_STARTED' && event.player === 'P2') lines.push('RED left home')
  }
  return lines
}

/**
 * Строки под HUD: не больше одного события плюс угроза — всего две строки. Угроза
 * важнее и идёт первой. Тексты короткие («RED +12 cells (5 from you)» — 26 знаков),
 * чтобы каждая строка помещалась целиком даже на 320px, без переноса и многоточия.
 */
export function eventLines(events: readonly string[], inDanger: boolean): string[] {
  const event = events.slice(-1)
  return inDanger ? [DANGER_MESSAGE, ...event] : event
}
