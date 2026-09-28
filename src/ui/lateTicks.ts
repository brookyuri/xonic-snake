import { LATE_FACTOR } from './perf'

/** VISUAL_2026.md раздел 5: после 30 тиков, если опоздавших больше 10%, — предложить 1986. */
export const LATE_MIN_TICKS = 30
export const LATE_MAX_SHARE = 0.1

/**
 * Опоздавшие тики партии: интервал между соседними тиками игры больше 1.5 × tickMs.
 * Перерывы (отсчёт, пауза, вспышка удара, экран уровня) не считаются опозданием:
 * интервал через перерыв пропускается.
 */
export class LateTickMonitor {
  private last: number | null = null
  private offered = false
  intervals = 0
  late = 0

  constructor(private readonly tickMs: number) {}

  /** Тик начался в момент at. Возвращает, посчитан ли интервал (false — первый после перерыва). */
  tick(at: number): boolean {
    const counted = this.last !== null
    if (counted) {
      this.intervals++
      if (at - this.last! > this.tickMs * LATE_FACTOR) this.late++
    }
    this.last = at
    return counted
  }

  /** Перерыв в игре: следующий интервал не считается. */
  pause(): void {
    this.last = null
  }

  /** Пора предложить тему 1986 — ровно один раз за партию. */
  shouldOffer(): boolean {
    if (this.offered || this.intervals < LATE_MIN_TICKS || this.late / this.intervals <= LATE_MAX_SHARE) return false
    this.offered = true
    return true
  }
}
