import { Container, Graphics, Sprite, type Texture } from 'pixi.js'
import { interpolateCell } from '../geometry'
import type { BallView } from '../types'
import { ballGlowTexture, ballTexture } from './textures'

/** Ореол: 1 оборот за 3 с. */
const HALO_TURN_MS = 3000
const HALO_DASHES = 14

interface BallItem {
  root: Container
  glow: Sprite
  sphere: Sprite
  halo: Graphics
}

/**
 * Шарики Solo (VISUAL_2026.md «Шарики»): текстуры сферы и свечения рисуются один раз,
 * дальше — спрайты. Ореол — пунктирная окружность, медленно вращается.
 */
export class BallSprites {
  readonly container = new Container()
  private items: BallItem[] = []
  private views: readonly BallView[] = []
  private sphereTexture: Texture | null = null
  private glowTexture: Texture | null = null
  private cell = 0

  constructor(private readonly reducedMotion: boolean) {}

  /** Размер клетки сменился: новые текстуры и ореолы. */
  setCell(cell: number, res: number): void {
    this.cell = cell
    this.sphereTexture?.destroy(true)
    this.glowTexture?.destroy(true)
    this.sphereTexture = ballTexture(cell, res)
    this.glowTexture = ballGlowTexture(cell, res)
    for (const item of this.items) this.style(item)
  }

  private style(item: BallItem): void {
    item.glow.texture = this.glowTexture!
    item.sphere.texture = this.sphereTexture!
    const radius = this.cell / 2 + 4 * (this.cell / 24)
    const g = item.halo.clear()
    const step = (Math.PI * 2) / HALO_DASHES
    for (let i = 0; i < HALO_DASHES; i++) {
      const a = i * step
      g.moveTo(Math.cos(a) * radius, Math.sin(a) * radius)
      g.arc(0, 0, radius, a, a + step * 0.55)
    }
    g.stroke({ width: 1, color: 0xff8cf6, alpha: 0.8 })
  }

  update(balls: readonly BallView[]): void {
    this.views = balls
    while (this.items.length > balls.length) this.items.pop()!.root.destroy({ children: true })
    while (this.items.length < balls.length) {
      const item: BallItem = { root: new Container(), glow: new Sprite(), sphere: new Sprite(), halo: new Graphics() }
      item.glow.anchor.set(0.5)
      item.sphere.anchor.set(0.5)
      item.root.addChild(item.glow, item.halo, item.sphere)
      this.style(item)
      this.container.addChild(item.root)
      this.items.push(item)
    }
  }

  frame(alpha: number, now: number): void {
    const turn = this.reducedMotion ? 0 : ((now % HALO_TURN_MS) / HALO_TURN_MS) * Math.PI * 2
    this.views.forEach((b, i) => {
      const item = this.items[i]
      const p = interpolateCell(b.prev, b.pos, alpha, this.cell)
      item.root.position.set(p.x, p.y)
      item.halo.rotation = turn
    })
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.sphereTexture?.destroy(true)
    this.glowTexture?.destroy(true)
  }
}
