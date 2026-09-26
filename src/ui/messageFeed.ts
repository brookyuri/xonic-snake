/** Сколько держится сообщение строки событий: на быстрых тиках текст не должен мигать. */
export const MESSAGE_HOLD_MS = 1200

interface Entry {
  text: string
  at: number
}

/**
 * Лента строки событий: до `max` сообщений одновременно, каждое показанное держится
 * не меньше holdMs. Новые сообщения ждут свободного места в короткой очереди, а не
 * вытесняют показанные; если очередь переполнена, старейшее ожидающее отбрасывается
 * (на Fast событий больше, чем влезает в одну строку).
 */
export class MessageFeed {
  private shown: Entry[] = []
  private pending: string[] = []

  constructor(
    private readonly holdMs = MESSAGE_HOLD_MS,
    private readonly max = 2,
    private readonly maxPending = 2
  ) {}

  push(texts: string[], now: number): void {
    for (const text of texts) {
      const visible = this.shown.find((e) => e.text === text)
      if (visible) {
        visible.at = now // повтор того же события продлевает показ
        continue
      }
      if (this.pending.includes(text)) continue
      this.pending.push(text)
      if (this.pending.length > this.maxPending) this.pending.shift()
    }
  }

  visible(now: number): string[] {
    this.shown = this.shown.filter((e) => now - e.at < this.holdMs)
    while (this.shown.length < this.max && this.pending.length > 0) {
      this.shown.push({ text: this.pending.shift()!, at: now })
    }
    return this.shown.map((e) => e.text)
  }

  clear(): void {
    this.shown = []
    this.pending = []
  }
}

/** Флаг, который после включения держится минимум holdMs (угроза следу не мигает). */
export class HeldFlag {
  private lastOn = -Infinity

  constructor(private readonly holdMs = MESSAGE_HOLD_MS) {}

  update(on: boolean, now: number): boolean {
    if (on) this.lastOn = now
    return now - this.lastOn < this.holdMs
  }
}
