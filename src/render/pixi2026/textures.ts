import { CanvasSource, Texture } from 'pixi.js'
import { C, type LandStyle } from './palette'

/**
 * Текстуры поля 2026 рисуются один раз (на старте и при смене размера) обычным Canvas2D
 * и дальше живут как спрайты: свечение и градиенты не пересчитываются на кадре.
 */

function canvasTexture(width: number, height: number, res: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(width * res))
  canvas.height = Math.max(1, Math.ceil(height * res))
  const ctx = canvas.getContext('2d')!
  ctx.scale(res, res)
  draw(ctx)
  return new Texture({ source: new CanvasSource({ resource: canvas, resolution: res }) })
}

/** Фон поля: радиальный градиент (центр 50% 40%) и тонкая сетка 0.5px. */
export function boardTexture(size: number, cols: number, rows: number, res: number): Texture {
  return canvasTexture(size, size, res, (ctx) => {
    const g = ctx.createRadialGradient(size * 0.5, size * 0.4, 0, size * 0.5, size * 0.4, size * 0.75)
    g.addColorStop(0, C.boardInner)
    g.addColorStop(1, C.boardOuter)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = C.grid
    ctx.lineWidth = 0.5
    ctx.beginPath()
    for (let x = 1; x < cols; x++) {
      const px = (x * size) / cols
      ctx.moveTo(px, 0)
      ctx.lineTo(px, size)
    }
    for (let y = 1; y < rows; y++) {
      const py = (y * size) / rows
      ctx.moveTo(0, py)
      ctx.lineTo(size, py)
    }
    ctx.stroke()
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Земля — «стеклянная панель пола» размером в клетку: отступ 1px, скругление radius,
 * заливка 135°, внутреннее свечение, обводка 1px.
 */
export function landTexture(cell: number, radius: number, style: LandStyle, res: number): Texture {
  return canvasTexture(cell, cell, res, (ctx) => {
    const x = 1
    const w = cell - 2
    const g = ctx.createLinearGradient(x, x, x + w, x + w)
    g.addColorStop(0, style.from)
    g.addColorStop(1, style.to)
    ctx.beginPath()
    roundRect(ctx, x, x, w, w, radius)
    ctx.fillStyle = g
    ctx.fill()
    // Внутреннее свечение: тень кольца вокруг панели, обрезанная по самой панели.
    ctx.save()
    ctx.clip()
    ctx.beginPath()
    ctx.rect(-cell, -cell, cell * 3, cell * 3)
    roundRect(ctx, x, x, w, w, radius)
    ctx.shadowColor = style.glow
    ctx.shadowBlur = Math.max(2, cell * 0.22) * res
    ctx.fillStyle = style.glow
    ctx.fill('evenodd')
    ctx.restore()
    ctx.beginPath()
    roundRect(ctx, x + 0.5, x + 0.5, w - 1, w - 1, Math.max(0, radius - 0.5))
    ctx.strokeStyle = style.stroke
    ctx.lineWidth = 1
    ctx.stroke()
  })
}

/** Шарик: сфера диаметром cell − 2, блик в точке (35%, 35%). */
export function ballTexture(cell: number, res: number): Texture {
  const d = Math.max(4, cell - 2)
  return canvasTexture(d, d, res, (ctx) => {
    const g = ctx.createRadialGradient(d * 0.35, d * 0.35, 0, d / 2, d / 2, d / 2)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.24, '#ff9cf8')
    g.addColorStop(0.58, '#ff3df0')
    g.addColorStop(1, '#6a0f73')
    ctx.beginPath()
    ctx.arc(d / 2, d / 2, d / 2, 0, Math.PI * 2)
    ctx.fillStyle = g
    ctx.fill()
  })
}

/** Свечение шарика: два круга magenta побольше (α 0.35 и 0.15) с мягким краем. */
export function ballGlowTexture(cell: number, res: number): Texture {
  const outer = cell * 0.95
  const inner = cell * 0.68
  const size = outer * 2
  return canvasTexture(size, size, res, (ctx) => {
    const c = size / 2
    for (const [r, a] of [
      [outer, 0.15],
      [inner, 0.35],
    ] as const) {
      const g = ctx.createRadialGradient(c, c, r * 0.55, c, c, r)
      g.addColorStop(0, `rgba(255,61,240,${a})`)
      g.addColorStop(1, 'rgba(255,61,240,0)')
      ctx.beginPath()
      ctx.arc(c, c, r, 0, Math.PI * 2)
      ctx.fillStyle = g
      ctx.fill()
    }
  })
}
