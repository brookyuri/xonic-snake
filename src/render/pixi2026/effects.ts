import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import type { PlayerId, Pos } from '../../engine/types'
import { cellCenter, waveDelays, type Pt } from '../geometry'
import { flashTexture, particleTextures } from './textures'

/**
 * Эффекты поля 2026 (VISUAL_2026.md раздел 3 «Эффекты»). Запускаются только событиями
 * движка (захват, смерть, удар) — сами ничего о правилах не знают. Всё по времени кадра;
 * пулы спрайтов создаются один раз, неактивные спрайты — прозрачные (не visible: смена
 * visible пересобирает список отрисовки сцены).
 */

/** Волна захвата: вся за ≤ 300 мс, затем каждая клетка 400 мс гаснет до обычной земли. */
export const WAVE_MS = 300
export const WAVE_FADE_MS = 400
const PARTICLE_MS = 600
export const PARTICLE_POOL = 80
const SHOCK_MS = 400
/** «+N»: всплывает и гаснет за 800 мс. */
const PLUS_MS = 800

const PARTICLE_COLORS: Record<PlayerId, number[]> = {
  P1: [0x8ff4ff, 0x22e5ff, 0xffd23f, 0xff3df0, 0xffffff],
  P2: [0xffd0d8, 0xff3355, 0xffd23f, 0xffb020, 0xffffff],
}


interface WaveCell {
  sprite: Sprite
  cover: Texture
  flash: Texture
  start: number
}

interface Particle {
  sprite: Sprite
  start: number
  x: number
  y: number
  dx: number
  dy: number
  spin: number
  ms: number
}

/** Детерминированный генератор для разлёта частиц (без Math.random — кадры повторяемы). */
function rng(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Effects {
  /**
   * Над землёй, под змеями: волна захвата. Слой всегда включён (пустые спрайты прозрачны):
   * включение visible на захвате пересобирало список отрисовки всей сцены — пик кадра до 28 мс.
   */
  readonly under = new Container()
  /** Поверх всего: частицы, ударные волны. */
  readonly over = new Container()
  private cell = 0
  private cols = 0
  private px = 1
  private base: Texture | null = null
  private flash: Record<PlayerId, Texture> | null = null
  private shapes: Texture[] = []
  private coverCache = new Map<number, Texture>()
  private wave: WaveCell[] = []
  private waveFree: Sprite[] = []
  private particles: Particle[] = []
  private nextParticle = 0
  private shocks: { g: Graphics; at: Pt; start: number }[] = []
  private seed = 1
  /** DOM-слой для «+N» (поверх canvas); анимация — по времени кадра, как у остальных эффектов. */
  private labels: HTMLElement | null = null
  private plusLabels: { el: HTMLElement; start: number }[] = []

  constructor(private readonly reducedMotion: boolean) {
  }

  mountLabels(host: HTMLElement): void {
    this.labels = host
  }

  /** Размер клетки сменился: новые текстуры (фон для «ещё не загоревшихся» клеток — base). */
  setCell(cell: number, res: number, base: Texture, cols: number): void {
    this.cell = cell
    this.px = cell / 24
    this.base = base
    for (const t of this.coverCache.values()) t.destroy(false)
    this.coverCache.clear()
    this.cols = cols
    if (this.flash) for (const t of Object.values(this.flash)) t.destroy(true)
    this.flash = { P1: flashTexture(cell, 'P1', res), P2: flashTexture(cell, 'P2', res) }
    for (const t of this.shapes) t.destroy(true)
    this.shapes = particleTextures(res)
    for (const p of this.particles) p.sprite.texture = this.shapes[0]
    // Пул волны — сразу на все клетки поля, подложки — тоже: большой захват не создаёт
    // сотни спрайтов и текстур в одном кадре (замер: пик 28 мс при 1× на захвате).
    const rows = Math.round(base.height / cell)
    while (this.waveFree.length + this.wave.length < cols * rows) {
      const s = this.newWaveSprite()
      s.alpha = 0
      this.waveFree.push(s)
    }
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) this.cover({ x, y })
  }

  /** Кусок фона поля под клеткой: пока волна не дошла, клетка выглядит пустой. */
  private cover(p: Pos): Texture {
    const key = p.y * this.cols + p.x
    let t = this.coverCache.get(key)
    if (!t) {
      t = new Texture({ source: this.base!.source, frame: new Rectangle(p.x * this.cell, p.y * this.cell, this.cell, this.cell) })
      this.coverCache.set(key, t)
    }
    return t
  }

  /** Для прогрева рендерера: по спрайту с каждой текстурой эффектов (загрузка в GPU до игры). */
  warmSprites(): Sprite[] {
    if (!this.flash) return []
    return [this.flash.P1, this.flash.P2, ...this.shapes].map((t) => new Sprite(t))
  }

  /** Захват: волна от точки замыкания, частицы, «+N». */
  capture(cells: readonly Pos[], origin: Pos, owner: PlayerId, now: number): void {
    if (this.reducedMotion || cells.length === 0 || !this.flash) return
    const delays = waveDelays(cells, origin, WAVE_MS)
    cells.forEach((c, i) => {
      const sprite = this.waveFree.pop() ?? this.newWaveSprite()
      sprite.position.set(c.x * this.cell, c.y * this.cell)
      sprite.alpha = 1
      sprite.texture = this.cover(c)
      this.wave.push({ sprite, cover: this.cover(c), flash: this.flash![owner], start: now + delays[i] })
    })
    const o = cellCenter(origin, this.cell)
    const count = 12 + Math.min(8, Math.floor(cells.length / 4))
    const rand = rng(this.seed++)
    for (let i = 0; i < count; i++) {
      // Вверх и в стороны: угол от −160° до −20°, 20–70 px (в px спецификации).
      const angle = (-160 + rand() * 140) * (Math.PI / 180)
      const dist = (20 + rand() * 50) * this.px
      this.emit(o, Math.cos(angle) * dist, Math.sin(angle) * dist, PARTICLE_COLORS[owner][i % 5], (3 + rand() * 5) * this.px, i % 3 === 0 ? 1 : 0, rand, now, PARTICLE_MS)
    }
    this.plus(o, cells.length, now)
  }

  private newWaveSprite(): Sprite {
    const s = new Sprite()
    this.under.addChild(s)
    return s
  }

  /** Одна частица из кольцевого пула (≤ PARTICLE_POOL): самая старая переиспользуется. */
  private emit(o: Pt, dx: number, dy: number, color: number, size: number, shape: number, rand: () => number, now: number, ms: number): void {
    let p = this.particles[this.nextParticle]
    if (!p) {
      const sprite = new Sprite(this.shapes[0])
      sprite.anchor.set(0.5)
      this.over.addChild(sprite)
      p = { sprite, start: 0, x: 0, y: 0, dx: 0, dy: 0, spin: 0, ms }
      this.particles.push(p)
    }
    this.nextParticle = (this.nextParticle + 1) % PARTICLE_POOL
    p.sprite.texture = this.shapes[shape]
    p.sprite.tint = color
    p.sprite.setSize(size, size)
    p.start = now
    p.x = o.x
    p.y = o.y
    p.dx = dx
    p.dy = dy
    p.ms = ms
    p.spin = (rand() - 0.5) * 6
  }

  /** «+N» цвета gold над точкой захвата: всплывает и гаснет за 800 мс (DOM, CSS-анимация). */
  private plus(at: Pt, n: number, now: number): void {
    if (!this.labels) return
    const el = document.createElement('div')
    el.className = 'fx-plus'
    el.textContent = `+${n}`
    const canvas = this.labels.querySelector('.board-canvas') as HTMLElement | null
    el.style.left = `${(canvas?.offsetLeft ?? 0) + at.x}px`
    el.style.top = `${(canvas?.offsetTop ?? 0) + at.y}px`
    this.labels.appendChild(el)
    this.plusLabels.push({ el, start: now })
  }

  /** Смерть: частицы вдоль тела (по 2–3 на клетку, не больше пула). */
  scatter(points: readonly Pt[], colors: readonly number[], now: number): void {
    if (this.reducedMotion || points.length === 0) return
    const rand = rng(this.seed++)
    const step = Math.max(1, Math.ceil(points.length / PARTICLE_POOL))
    for (let i = 0; i < points.length; i += step) {
      const angle = rand() * Math.PI * 2
      const dist = (10 + rand() * 25) * this.px
      this.emit(points[i], Math.cos(angle) * dist, Math.sin(angle) * dist - 6 * this.px, colors[i % colors.length], (3 + rand() * 4) * this.px, i % 2, rand, now + rand() * 120, 600)
    }
  }

  /** Удар шариком: расширяющееся кольцо magenta 0 → 2.5 клетки за 400 мс. */
  shockwave(at: Pos, now: number): void {
    if (this.reducedMotion) return
    const g = new Graphics()
    this.over.addChild(g)
    this.shocks.push({ g, at: cellCenter(at, this.cell), start: now })
  }

  frame(now: number): void {
    if (this.wave.length > 0) {
      let active = 0
      for (const w of this.wave) {
        const t = now - w.start
        if (t < 0) {
          active++
          continue
        }
        if (w.sprite.texture !== w.flash) w.sprite.texture = w.flash
        if (t >= WAVE_FADE_MS) {
          w.sprite.alpha = 0
          continue
        }
        active++
        // Сначала яркая панель, затем затухание до обычной земли (под ней — RenderTexture земли).
        w.sprite.alpha = 1 - t / WAVE_FADE_MS
      }
      if (active === 0) {
        for (const w of this.wave) this.waveFree.push(w.sprite)
        this.wave = []
      }
    }
    for (const p of this.particles) {
      const t = (now - p.start) / p.ms
      if (t < 0 || t >= 1) {
        if (p.sprite.alpha !== 0) p.sprite.alpha = 0
        continue
      }
      const ease = 1 - (1 - t) * (1 - t)
      p.sprite.position.set(p.x + p.dx * ease, p.y + p.dy * ease)
      p.sprite.rotation = p.spin * t
      p.sprite.alpha = 1 - t * t
    }
    for (let i = this.plusLabels.length - 1; i >= 0; i--) {
      const { el, start } = this.plusLabels[i]
      const t = (now - start) / PLUS_MS
      if (t >= 1) {
        el.remove()
        this.plusLabels.splice(i, 1)
        continue
      }
      const ease = 1 - (1 - t) * (1 - t)
      el.style.opacity = String(1 - t * t)
      el.style.transform = `translate(-50%, calc(-100% - ${Math.round(28 * ease)}px))`
    }
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i]
      const t = (now - s.start) / SHOCK_MS
      if (t >= 1) {
        s.g.destroy()
        this.shocks.splice(i, 1)
        continue
      }
      const ease = 1 - (1 - t) ** 3
      s.g.clear()
      s.g.circle(s.at.x, s.at.y, Math.max(0.5, 2.5 * this.cell * ease))
      s.g.stroke({ width: 3 * this.px * (1 - t) + 1, color: 0xff3df0, alpha: 1 - t })
      s.g.circle(s.at.x, s.at.y, Math.max(0.5, 2.5 * this.cell * ease * 0.7))
      s.g.stroke({ width: 1.5 * this.px, color: 0xff8cf6, alpha: (1 - t) * 0.6 })
    }
  }

  destroy(): void {
    for (const { el } of this.plusLabels) el.remove()
    for (const t of this.coverCache.values()) t.destroy(false)
    if (this.flash) for (const t of Object.values(this.flash)) t.destroy(true)
    for (const t of this.shapes) t.destroy(true)
    this.under.destroy({ children: true })
    this.over.destroy({ children: true })
  }
}
