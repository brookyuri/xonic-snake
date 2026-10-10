/** За столько после возврата на экран поле 2026 должно подняться заново, иначе — 1986. */
export const RESTORE_TIMEOUT_MS = 3000
/** Пауза между попытками пересоздать рендерер (GPU после сброса может отказать не сразу). */
export const RESTORE_RETRY_MS = 500

export interface GraphicsGuardHooks {
  /** Поднять новый рендерер и отдать ему текущий кадр; true — он реально рисует. */
  mount(): Promise<boolean>
  /** Убрать текущий рендерер (если есть). */
  teardown(): void
  /** Вкладка скрыта: пересоздавать пока бессмысленно. */
  hidden(): boolean
  /** Графика пропала: пауза и «Restoring graphics…». */
  onLost(): void
  /** Поле снова рисуется. */
  onRestored(): void
  /** Не поднялось за RESTORE_TIMEOUT_MS — переход на 1986. */
  onGiveUp(): void
}

/**
 * Потеря WebGL-контекста (Android при сворачивании / блокировке экрана): текстуры шаров и
 * свечений, RenderTexture земли пропадают. Ничего не чиним по частям — рендерер пересоздаётся
 * целиком, когда вкладка видна. Не вышло за RESTORE_TIMEOUT_MS — onGiveUp.
 */
export class GraphicsGuard {
  private state: 'ok' | 'lost' | 'restoring' | 'failed' = 'ok'
  private deadline: ReturnType<typeof setTimeout> | null = null
  private retry: ReturnType<typeof setTimeout> | null = null
  private disposed = false

  constructor(private readonly hooks: GraphicsGuardHooks) {}

  get status(): 'ok' | 'lost' | 'restoring' | 'failed' {
    return this.state
  }

  /** Контекст потерян или проверка показала пустую отрисовку. */
  lost(): void {
    if (this.disposed || this.state !== 'ok') return
    this.state = 'lost'
    this.hooks.teardown()
    this.hooks.onLost()
    if (!this.hooks.hidden()) this.begin()
  }

  /** Вкладка снова видна. */
  visible(): void {
    if (this.state === 'lost') this.begin()
  }

  dispose(): void {
    this.disposed = true
    this.clearTimers()
  }

  private begin(): void {
    this.state = 'restoring'
    this.deadline = setTimeout(() => this.giveUp(), RESTORE_TIMEOUT_MS)
    this.attempt()
  }

  private attempt(): void {
    this.retry = null
    this.hooks.mount().then(
      (ok) => this.settle(ok),
      () => this.settle(false)
    )
  }

  private settle(ok: boolean): void {
    if (this.disposed || this.state !== 'restoring') {
      // Опоздавшая попытка (уже 1986 или экран закрыт) — её рендерер не нужен.
      if (ok && this.state === 'failed') this.hooks.teardown()
      return
    }
    if (ok) {
      this.clearTimers()
      this.state = 'ok'
      this.hooks.onRestored()
      return
    }
    this.hooks.teardown()
    this.retry = setTimeout(() => this.attempt(), RESTORE_RETRY_MS)
  }

  private giveUp(): void {
    this.deadline = null
    if (this.disposed || this.state !== 'restoring') return
    this.state = 'failed'
    this.clearTimers()
    this.hooks.teardown()
    this.hooks.onGiveUp()
  }

  private clearTimers(): void {
    if (this.deadline) clearTimeout(this.deadline)
    if (this.retry) clearTimeout(this.retry)
    this.deadline = null
    this.retry = null
  }
}
