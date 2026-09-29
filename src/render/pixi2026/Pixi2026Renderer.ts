import { autoDetectRenderer, Container, Graphics, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js'
import type { Owner, PlayerId } from '../../engine/types'
import type { BoardRenderer, BoardVariant, MountOptions, RenderEvent, RenderSnapshot } from '../types'
import { LAND } from './palette'
import { BallSprites } from './balls'
import { Effects } from './effects'
import { DEATH_FLASH_MS, SnakeSprite, snakeMetrics } from './snake'
import { boardTexture, landTexture } from './textures'

export type PixiPreference = 'webgl' | 'canvas'

/** Вид клетки земли: 0 — пусто, 1 — игрок, 2 — AI, 3 — рамка Solo (стартовая земля). */
type LandKind = 0 | 1 | 2 | 3
const LAND_STYLES = [null, LAND.P1, LAND.P2, LAND.FRAME] as const

function landKind(territory: Owner, x: number, y: number, s: RenderSnapshot): LandKind {
  if (territory === 'P2') return 2
  if (territory !== 'P1') return 0
  const edge = x === 0 || y === 0 || x === s.cols - 1 || y === s.rows - 1
  return s.variant === 'solo' && edge ? 3 : 1
}

/** Сколько раз мигает клетка удара и период мигания (как в 1986). */
/** Клетка столкновения 2026: неоновая рамка red, 3 пульса по 320 мс, затем статично. */
const HIT_PULSES = 3
const HIT_PULSE_MS = 320
const HIT_RED = 0xff3355

/**
 * Тема 2026 (VISUAL_2026.md раздел 3): поле на PixiJS. Фон с сеткой — один спрайт; земля —
 * RenderTexture, в которой на тике перерисовываются только изменившиеся клетки.
 */
export class Pixi2026Renderer implements BoardRenderer {
  private renderer: Renderer | null = null
  private readonly stage = new Container()
  private readonly baseSprite = new Sprite()
  private readonly landSprite = new Sprite()
  private land: RenderTexture | null = null
  /** Штамп для земли: сначала стираем клетки, потом кладём панели. */
  private readonly stamp = new Container()
  private readonly eraseLayer = new Container()
  private readonly panelLayer = new Container()
  private baseTexture: Texture | null = null
  private landTextures: (Texture | null)[] = []
  private kinds = new Uint8Array(0)
  private readonly snakeLayer = new Container()
  private readonly ballLayer = new Container()
  private readonly snakes = new Map<PlayerId, SnakeSprite>()
  private balls: BallSprites | null = null
  private readonly hit = new Graphics()
  /** Свечение рамки столкновения — отдельно, пульсирует прозрачностью. */
  private readonly hitGlow = new Graphics()
  private hitStartedAt = 0
  private hitKey = ''
  private effects: Effects | null = null
  /** Последняя потеря жизни — удар шариком: вместо рамки клетки — ударная волна. */
  private ballHit = false

  private res = 1
  private size = 0
  private cols = 0
  private rows = 0
  private variant: BoardVariant | null = null
  private reducedMotion = false
  private snapshot: RenderSnapshot | null = null

  constructor(private readonly preference: PixiPreference[] = ['webgl', 'canvas']) {
    this.stamp.addChild(this.eraseLayer, this.panelLayer)
    // Шарики поверх змей: в одной клетке они бывают только в момент удара — шарик должен быть виден.
    this.stage.addChild(this.baseSprite, this.landSprite, this.snakeLayer, this.ballLayer, this.hitGlow, this.hit)
  }

  get rendererName(): string {
    return this.renderer?.name ?? 'none'
  }

  async mount(el: HTMLElement, opts: MountOptions): Promise<void> {
    this.res = Math.min(window.devicePixelRatio || 1, 2)
    this.size = opts.sizePx
    this.cols = opts.cols
    this.rows = opts.rows
    this.reducedMotion = opts.reducedMotion
    this.balls = new BallSprites(this.reducedMotion)
    this.ballLayer.addChild(this.balls.container)
    this.effects = new Effects(this.reducedMotion)
    this.effects.mountLabels(el)
    // Волна захвата — над землёй, под змеями; частицы и ударные волны — поверх всего.
    this.stage.addChildAt(this.effects.under, this.stage.getChildIndex(this.landSprite) + 1)
    this.stage.addChild(this.effects.over)
    this.renderer = await autoDetectRenderer({
      width: this.size,
      height: this.size,
      resolution: this.res,
      autoDensity: true,
      // Без MSAA: вместе с записью в RenderTexture земли он давал паузы GPU 200–400 мс на
      // захвате (замер на Intel UHD). При DPR 2 края и так гладкие.
      antialias: false,
      backgroundAlpha: 0,
      preference: this.preference,
      // Выборочный импорт: без автозагрузки browserAll / webworkerAll (доступность, DOM,
      // события, фильтры, спрайтшиты) — полю нужны только рендерер, спрайты и Graphics.
      skipExtensionImports: true,
    })
    const canvas = this.renderer.canvas as HTMLCanvasElement
    canvas.className = 'board-canvas'
    // Какой рендерер Pixi поднялся (webgl / canvas) — видно в DOM для проверок.
    canvas.dataset.renderer = this.renderer.name
    el.prepend(canvas)
  }

  /** Всё, что зависит от размера клетки: текстуры, RenderTexture земли. */
  private layout(s: RenderSnapshot): void {
    const r = this.renderer!
    this.variant = s.variant
    this.cols = s.cols
    this.rows = s.rows
    const cell = this.size / this.cols

    this.baseTexture?.destroy(true)
    this.baseTexture = boardTexture(this.size, this.cols, this.rows, this.res)
    this.baseSprite.texture = this.baseTexture
    for (const t of this.landTextures) t?.destroy(true)
    const radius = s.variant === 'solo' ? 2 : 3
    this.landTextures = LAND_STYLES.map((style) => (style ? landTexture(cell, radius, style, this.res) : null))

    const m = snakeMetrics(cell, s.variant)
    for (const snake of this.snakes.values()) snake.setMetrics(m)
    this.balls!.setCell(cell, this.res)
    this.effects!.setCell(cell, this.res, this.baseTexture, this.cols)

    this.land?.destroy(true)
    this.land = RenderTexture.create({ width: this.size, height: this.size, resolution: this.res })
    r.render({ container: new Container(), target: this.land, clear: true })
    this.landSprite.texture = this.land
    this.kinds = new Uint8Array(this.cols * this.rows)
  }

  /**
   * Прогрев (во время отсчёта): один раз рисуем в скрытую текстуру змею со следом и шарики —
   * всё, что появится только когда игра пойдёт. Иначе первые выходы из дома платят за сборку
   * шейдеров, буферов и пулов прямо на тиках (замер: пики frame() 90–220 мс при 6× CPU).
   */
  private warmUp(s: RenderSnapshot): void {
    const r = this.renderer!
    const cell = this.size / this.cols
    const warm = new Container()
    const cx = Math.floor(s.cols / 2)
    const cy = Math.floor(s.rows / 2)
    const trail = [0, 1, 2, 3, 4].map((i) => ({ x: cx - 2 + i, y: cy + (i > 2 ? 1 : 0) }))
    for (const id of ['P1', 'P2'] as const) {
      const snake = new SnakeSprite(id, snakeMetrics(cell, s.variant), this.reducedMotion)
      snake.update({ id, trail, head: trail[4], prevHead: trail[3], direction: 'RIGHT', alive: true })
      snake.frame(0.5, 0)
      warm.addChild(snake.container)
    }
    const balls = new BallSprites(this.reducedMotion)
    balls.setCell(cell, this.res)
    balls.update([{ pos: { x: cx, y: cy }, prev: { x: cx - 1, y: cy - 1 } }])
    balls.frame(0.5, 0)
    // Текстуры эффектов (волна захвата, частицы) и Graphics ударной волны — тоже до игры.
    const fx = this.effects!.warmSprites()
    const ring = new Graphics().circle(cell, cell, cell).stroke({ width: 2, color: 0xff3df0, alpha: 0.5 })
    warm.addChild(...fx, ring)
    warm.addChild(balls.container, this.stage)
    const target = RenderTexture.create({ width: this.size, height: this.size, resolution: this.res })
    r.render({ container: warm, target, clear: true })
    warm.removeChild(this.stage, balls.container)
    warm.destroy({ children: true })
    balls.destroy()
    target.destroy(true)
    // И первый кадр на экран — здесь, при монтировании (идёт отсчёт), а не в первом frame().
    r.render({ container: this.stage })
  }

  update(s: RenderSnapshot, events: readonly RenderEvent[]): void {
    if (!this.renderer) return
    const first = !this.snapshot
    if (s.variant !== this.variant || s.cols !== this.cols || s.rows !== this.rows || first) this.layout(s)
    if (first) this.warmUp(s)
    this.snapshot = s
    this.drawLand(s)
    this.updateSnakes(s)
    this.balls!.update(s.balls)
    this.playEvents(s, events)
    this.updateHit(s)
  }

  /**
   * Эффекты — только по событиям движка этого тика (VISUAL_2026.md «Эффекты»):
   * CAPTURED — волна, частицы, «+N»; DIED / LIFE_LOST — смерть змеи; удар шариком —
   * ударная волна вместо рамки клетки.
   */
  private playEvents(s: RenderSnapshot, events: readonly RenderEvent[]): void {
    const now = performance.now()
    for (const e of events) {
      if (e.type === 'CAPTURED') {
        const owner: PlayerId = 'player' in e ? e.player : 'P1'
        const snake = s.snakes.find((v) => v.id === owner)
        this.effects!.capture(e.cells, snake?.head ?? e.cells[0], owner, now)
      } else if (e.type === 'DIED' || e.type === 'LIFE_LOST') {
        const snake = this.snakes.get(e.type === 'DIED' ? e.player : 'P1')
        if (snake) this.effects!.scatter(snake.die(now), snake.deathColors, now + DEATH_FLASH_MS)
        if (e.type === 'LIFE_LOST') {
          this.ballHit = e.reason === 'BALL_HIT'
          if (this.ballHit) this.effects!.shockwave(e.at, now)
        }
      }
    }
  }

  /** Змеи: BLUE, затем RED — RED сверху (как в 1986). */
  private updateSnakes(s: RenderSnapshot): void {
    const seen = new Set<PlayerId>()
    for (const view of s.snakes) {
      seen.add(view.id)
      let snake = this.snakes.get(view.id)
      if (!snake) {
        snake = new SnakeSprite(view.id, snakeMetrics(this.size / this.cols, s.variant), this.reducedMotion)
        this.snakes.set(view.id, snake)
        this.snakeLayer.addChild(snake.container)
      }
      // Угроза — только следу человека (P1).
      snake.update(view, view.id === 'P1' && (s.danger ?? false))
    }
    for (const [id, snake] of this.snakes) {
      if (seen.has(id)) continue
      snake.destroy()
      this.snakes.delete(id)
    }
  }

  /** Земля: стереть и перерисовать только клетки, у которых сменился вид. */
  private drawLand(s: RenderSnapshot): void {
    const cell = this.size / this.cols
    let erased = 0
    let panels = 0
    for (let y = 0; y < s.rows; y++) {
      const row = s.board[y]
      for (let x = 0; x < s.cols; x++) {
        const i = y * s.cols + x
        const kind = landKind(row[x].territory, x, y, s)
        if (kind === this.kinds[i]) continue
        this.kinds[i] = kind
        const erase = this.pooled(this.eraseLayer, erased++, Texture.WHITE)
        erase.blendMode = 'erase'
        erase.position.set(x * cell, y * cell)
        erase.setSize(cell, cell)
        if (kind !== 0) {
          const panel = this.pooled(this.panelLayer, panels++, this.landTextures[kind]!)
          panel.position.set(x * cell, y * cell)
        }
      }
    }
    if (erased === 0) return
    this.trim(this.eraseLayer, erased)
    this.trim(this.panelLayer, panels)
    this.renderer!.render({ container: this.stamp, target: this.land!, clear: false })
  }

  /** Спрайт из пула слоя (создаётся при нехватке). */
  private pooled(layer: Container, index: number, texture: Texture): Sprite {
    let sprite = layer.children[index] as Sprite | undefined
    if (!sprite) {
      sprite = new Sprite()
      layer.addChild(sprite)
    }
    sprite.texture = texture
    sprite.visible = true
    return sprite
  }

  private trim(layer: Container, used: number): void {
    for (let i = used; i < layer.children.length; i++) layer.children[i].visible = false
  }

  /** Клетка удара / столкновения: рамка мигает 3 раза, затем остаётся (reduced motion — сразу). */
  private updateHit(s: RenderSnapshot): void {
    // Удар шариком показывает ударная волна, рамка клетки — только для остальных столкновений.
    if (!s.highlight?.length) this.ballHit = false
    const cells = this.ballHit ? [] : (s.highlight ?? [])
    // Graphics трогаем, только когда рамка меняется: clear() на каждом обновлении заставлял
    // Pixi пересобирать инструкции всей сцены на каждом тике.
    const key = cells.map((p) => `${p.x},${p.y}`).join(' ') + `|${this.size}`
    if (key === this.hitKey) return
    this.hitKey = key
    this.hit.clear()
    this.hitGlow.clear()
    if (cells.length === 0) {
      this.hitStartedAt = 0
      return
    }
    if (this.hitStartedAt === 0) this.hitStartedAt = performance.now()
    // Неоновая рамка red со свечением (3 широких полупрозрачных штриха без BlurFilter).
    const cell = this.size / this.cols
    const px = cell / 24
    const w = Math.max(1.5, 2 * px)
    const rect = (g: Graphics, p: { x: number; y: number }, grow: number) =>
      g.roundRect(p.x * cell + w / 2 - grow, p.y * cell + w / 2 - grow, cell - w + grow * 2, cell - w + grow * 2, 3 * px + grow)
    for (const [width, alpha] of [
      [10 * px, 0.14],
      [6 * px, 0.24],
      [3.5 * px, 0.45],
    ] as const) {
      for (const p of cells) rect(this.hitGlow, p, 0)
      this.hitGlow.stroke({ width, color: HIT_RED, alpha, join: 'round' })
    }
    for (const p of cells) rect(this.hit, p, 0)
    this.hit.stroke({ width: w, color: HIT_RED, join: 'round' })
    for (const p of cells) rect(this.hit, p, -w * 0.6)
    this.hit.stroke({ width: Math.max(0.75, 0.8 * px), color: 0xffd0d8, alpha: 0.85, join: 'round' })
  }

  frame(alpha: number): void {
    if (!this.renderer || !this.snapshot) return
    const now = performance.now()
    const a = this.reducedMotion ? 1 : alpha
    for (const snake of this.snakes.values()) snake.frame(a, now)
    this.balls!.frame(a, now)
    this.effects!.frame(now)
    if (this.hitStartedAt > 0) {
      const t = now - this.hitStartedAt
      // alpha, а не visible: смена visible пересобирает список отрисовки сцены.
      // 3 плавных пульса свечения (и чуть — самой рамки), затем статично; reduced motion — сразу.
      const done = this.reducedMotion || t >= HIT_PULSES * HIT_PULSE_MS
      const wave = done ? 1 : 0.5 - 0.5 * Math.cos((t / HIT_PULSE_MS) * Math.PI * 2)
      this.hitGlow.alpha = done ? 1 : 0.2 + 0.8 * wave
      this.hit.alpha = done ? 1 : 0.65 + 0.35 * wave
    }
    this.renderer.render({ container: this.stage })
  }

  resize(sizePx: number): void {
    if (!this.renderer || sizePx === this.size || sizePx <= 0) return
    this.size = sizePx
    this.renderer.resize(sizePx, sizePx, this.res)
    if (this.snapshot) {
      this.layout(this.snapshot)
      this.update(this.snapshot, [])
    }
  }

  destroy(): void {
    this.land?.destroy(true)
    for (const t of this.landTextures) t?.destroy(true)
    this.baseTexture?.destroy(true)
    this.snakes.clear()
    this.balls?.destroy()
    this.balls = null
    this.effects?.destroy()
    this.effects = null
    this.stage.destroy({ children: true })
    this.stamp.destroy({ children: true })
    this.renderer?.destroy({ removeView: true })
    this.renderer = null
    this.snapshot = null
  }
}
