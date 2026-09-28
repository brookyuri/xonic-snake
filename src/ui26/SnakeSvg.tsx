import { useId } from 'react'
import type { PlayerId } from '../engine/types'
import { polylineLength, taperRuns, type Pt } from '../render/geometry'

/**
 * Змея в технике поля 2026 (VISUAL_2026.md «Змея») как inline SVG: те же слои, сужение
 * хвоста, пунктир и геометрия головы, что у Pixi-рендерера. Для героя меню, схем How to play
 * и легенды — там, где поднимать WebGL ради картинки незачем.
 */

const PAL: Record<PlayerId, { glow: string; outline: string; body: string; deep: string; ring: string; sheen: string; head: [string, string, string]; eye: string; pupil: string; tongue: string }> = {
  P1: { glow: '#22e5ff', outline: '#062a55', body: '#1fb6ff', deep: '#0b3f8f', ring: '#ff3df0', sheen: '#d6fbff', head: ['#b8f8ff', '#1fb6ff', '#0b3f8f'], eye: '#fff6a8', pupil: '#041022', tongue: '#ff3df0' },
  P2: { glow: '#ff3355', outline: '#4a0616', body: '#ff3355', deep: '#7a0a22', ring: '#ffb020', sheen: '#ffd0d8', head: ['#ffc6d0', '#ff3355', '#6e0a20'], eye: '#fff3a0', pupil: '#1a0208', tongue: '#ffb020' },
}

const HEAD_CONTOUR = 'M -9 -7 C -1 -10.5, 9 -9.5, 14 -4.5 C 16.5 -2, 16.5 2, 14 4.5 C 9 9.5, -1 10.5, -9 7 C -12 4, -12 -4, -9 -7 Z'
const HEAD_SHEEN = 'M -4 -4.5 C 2 -6.5, 8 -5.5, 11 -2.5'
const TONGUE = 'M 15.5 0 L 21 0 M 21 0 L 24 -2.6 M 21 0 L 24 2.6'

const toPoints = (pts: readonly Pt[]) => pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')

interface LayerDef {
  color: 'glow' | 'outline' | 'body' | 'deep' | 'ring' | 'sheen'
  alpha: number
  factor: number
  extra: number
  dash?: [number, number]
  fromCell1?: boolean
  cap: 'round' | 'butt'
}

const LAYERS: LayerDef[] = [
  { color: 'glow', alpha: 0.12, factor: 1, extra: 8, cap: 'round' },
  { color: 'glow', alpha: 0.22, factor: 1, extra: 4, cap: 'round' },
  { color: 'outline', alpha: 1, factor: 1, extra: 2.5, cap: 'round' },
  { color: 'body', alpha: 1, factor: 1, extra: 0, cap: 'round' },
  { color: 'deep', alpha: 0.6, factor: 0.5, extra: 0, dash: [2, 5], fromCell1: true, cap: 'butt' },
  { color: 'ring', alpha: 1, factor: 0.8, extra: 0, dash: [3, 19], fromCell1: true, cap: 'butt' },
  { color: 'sheen', alpha: 0.75, factor: 0.18, extra: 0, fromCell1: true, cap: 'round' },
]

interface Props {
  id?: PlayerId
  /** Центральная линия от хвоста к голове, px. Меньше двух точек — змея дома: голова и шея. */
  points: readonly Pt[]
  /** Толщина тела W, px. */
  width: number
  /** «Пиксель» спецификации (cell / 24). */
  px: number
  /** Масштаб головы (cell / 19). */
  headScale: number
  /** Угол головы, радианы (ось X вперёд, y вниз). */
  angle: number
  tongue?: boolean
  /** Тело без хвостового сужения (для легенды — кусочек тела). */
  noTaper?: boolean
  /** Без головы (кусочек тела). */
  noHead?: boolean
}

export function SnakeSvg({ id = 'P1', points, width, px, headScale, angle, tongue = false, noTaper = false, noHead = false }: Props) {
  const gid = useId().replace(/:/g, '')
  const pal = PAL[id]
  const head = points[points.length - 1]
  // Дома — шея 0.6 клетки назад от головы.
  const line: Pt[] =
    points.length >= 2
      ? [...points]
      : [{ x: head.x - Math.cos(angle) * 0.6 * 24 * px, y: head.y - Math.sin(angle) * 0.6 * 24 * px }, head]
  const start = points.length >= 2 && !noTaper ? 0 : 2
  const layers = LAYERS.map((spec, li) => {
    let pts = line
    let first = start
    if (spec.fromCell1 && start === 0) {
      pts = line.slice(1)
      first = 1
    }
    if (pts.length < 2) return null
    return taperRuns(pts, 1, first).map((run, ri) => {
      const phase = spec.dash ? polylineLength(pts.slice(0, pts.indexOf(run.points[0]) + 1)) : 0
      return (
        <polyline
          key={`${li}-${ri}`}
          points={toPoints(run.points)}
          fill="none"
          stroke={pal[spec.color]}
          strokeOpacity={spec.alpha}
          strokeWidth={run.width * spec.factor * width + spec.extra * px}
          strokeLinecap={spec.cap}
          strokeLinejoin="round"
          strokeDasharray={spec.dash ? `${spec.dash[0] * px} ${spec.dash[1] * px}` : undefined}
          strokeDashoffset={spec.dash ? phase : undefined}
        />
      )
    })
  })
  return (
    <g>
      <defs>
        <linearGradient id={`h${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.head[0]} />
          <stop offset="0.5" stopColor={pal.head[1]} />
          <stop offset="1" stopColor={pal.head[2]} />
        </linearGradient>
      </defs>
      {layers}
      {!noHead && (
        <g transform={`translate(${head.x.toFixed(2)} ${head.y.toFixed(2)}) rotate(${((angle * 180) / Math.PI).toFixed(1)}) scale(${headScale.toFixed(3)})`}>
          {tongue && <path d={TONGUE} stroke={pal.tongue} strokeWidth={1.2} strokeLinecap="round" fill="none" />}
          <path d={HEAD_CONTOUR} fill={`url(#h${gid})`} stroke={pal.outline} strokeWidth={1.2} />
          <path d={HEAD_SHEEN} stroke={pal.sheen} strokeOpacity={0.75} strokeWidth={1} strokeLinecap="round" fill="none" />
          {[-1, 1].map((side) => (
            <g key={side}>
              <ellipse cx={6.5} cy={side * 4.6} rx={2.4} ry={1.7} fill={pal.eye} />
              <rect x={6.1} y={side * 4.6 - 1.3} width={0.8} height={2.6} fill={pal.pupil} />
              <circle cx={12.2} cy={side * 1.6} r={0.6} fill={pal.outline} />
            </g>
          ))}
        </g>
      )}
    </g>
  )
}

/** Шарик: сфера с бликом в (35%, 35%), свечение и пунктирный ореол. */
export function BallSvg({ x, y, cell }: { x: number; y: number; cell: number }) {
  const gid = useId().replace(/:/g, '')
  const r = (cell - 2) / 2
  return (
    <g>
      <defs>
        <radialGradient id={`b${gid}`} cx="0.5" cy="0.5" r="0.5" fx="0.35" fy="0.35">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.24" stopColor="#ff9cf8" />
          <stop offset="0.58" stopColor="#ff3df0" />
          <stop offset="1" stopColor="#6a0f73" />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={cell * 0.9} fill="#ff3df0" opacity={0.15} />
      <circle cx={x} cy={y} r={cell * 0.66} fill="#ff3df0" opacity={0.35} />
      <circle cx={x} cy={y} r={cell / 2 + (4 * cell) / 24} fill="none" stroke="rgba(255,140,246,0.8)" strokeWidth={1} strokeDasharray={`${cell * 0.12} ${cell * 0.1}`} />
      <circle cx={x} cy={y} r={r} fill={`url(#b${gid})`} />
    </g>
  )
}

/** Стеклянная панель земли (как на поле): заливка 135°, обводка, отступ 1px. */
export function LandSvg({ x, y, cell, owner, radius = 3 }: { x: number; y: number; cell: number; owner: PlayerId; radius?: number }) {
  const gid = useId().replace(/:/g, '')
  const [from, to, stroke] =
    owner === 'P1'
      ? ['rgba(34,229,255,0.40)', 'rgba(34,120,255,0.16)', 'rgba(120,240,255,0.55)']
      : ['rgba(255,51,85,0.38)', 'rgba(160,20,70,0.16)', 'rgba(255,130,155,0.55)']
  return (
    <g>
      <defs>
        <linearGradient id={`l${gid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect x={x + 1.5} y={y + 1.5} width={cell - 3} height={cell - 3} rx={radius} fill={`url(#l${gid})`} stroke={stroke} strokeWidth={1} />
    </g>
  )
}
