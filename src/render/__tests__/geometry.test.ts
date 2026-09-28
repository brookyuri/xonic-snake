import { describe, it, expect } from 'vitest'
import {
  bodyBase,
  bodyPolyline,
  cellCenter,
  dashPolyline,
  DIRECTION_ANGLE,
  headRotation,
  interpolateCell,
  neckPolyline,
  polylineLength,
  segmentWidth,
  taperRuns,
  type Pt,
} from '../geometry'

const C = 20 // клетка 20 px: центр клетки (x, y) — (20x + 10, 20y + 10)
const close = (a: Pt, b: Pt) => {
  expect(a.x).toBeCloseTo(b.x)
  expect(a.y).toBeCloseTo(b.y)
}

describe('interpolation of head and balls', () => {
  it('lerp between cell centers by alpha', () => {
    close(interpolateCell({ x: 1, y: 1 }, { x: 2, y: 1 }, 0, C), { x: 30, y: 30 })
    close(interpolateCell({ x: 1, y: 1 }, { x: 2, y: 1 }, 0.5, C), { x: 40, y: 30 })
    close(interpolateCell({ x: 1, y: 1 }, { x: 2, y: 1 }, 1, C), { x: 50, y: 30 })
    // Шарик по диагонали.
    close(interpolateCell({ x: 3, y: 3 }, { x: 4, y: 2 }, 0.25, C), { x: 75, y: 65 })
  })
})

describe('body polyline', () => {
  const trail = [
    { x: 5, y: 9 },
    { x: 5, y: 8 },
    { x: 5, y: 7 },
    { x: 6, y: 7 },
  ]

  it('base: trail cell centers in order, without the head cell', () => {
    expect(bodyBase(trail, { x: 6, y: 7 }, C)).toEqual([cellCenter(trail[0], C), cellCenter(trail[1], C), cellCenter(trail[2], C)])
  })

  it('hit frame: the head is outside the trail — the whole trail is the base', () => {
    expect(bodyBase(trail, { x: 7, y: 7 }, C)).toHaveLength(4)
  })

  it('the last segment stretches to the interpolated head', () => {
    const at = (alpha: number) => bodyPolyline(trail, { x: 5, y: 7 }, { x: 6, y: 7 }, alpha, C)
    expect(at(0.5)).toHaveLength(4)
    close(at(0.5)[3], { x: 120, y: 150 })
    close(at(1)[3], cellCenter({ x: 6, y: 7 }, C))
    // alpha = 0: голова ещё в прошлой клетке — нулевой отрезок не добавляется.
    expect(at(0)).toHaveLength(3)
  })

  it('is continuous across a tick: alpha 1 of tick k equals alpha 0 of tick k+1', () => {
    const k = bodyPolyline(trail.slice(0, 3), { x: 5, y: 8 }, { x: 5, y: 7 }, 1, C)
    const next = bodyPolyline(trail, { x: 5, y: 7 }, { x: 6, y: 7 }, 0, C)
    expect(next).toEqual(k)
  })

  it('at home (or one step out) there is no body: fewer than 2 points', () => {
    expect(bodyPolyline([], { x: 5, y: 10 }, { x: 5, y: 10 }, 0.5, C)).toEqual([])
    expect(bodyPolyline([{ x: 5, y: 9 }], { x: 5, y: 10 }, { x: 5, y: 9 }, 0.5, C)).toEqual([])
  })

  it('home: the neck goes 0.6 cell back from the head', () => {
    const head = { x: 100, y: 100 }
    const [tail, h] = neckPolyline(head, DIRECTION_ANGLE.UP, C)
    close(tail, { x: 100, y: 112 })
    expect(h).toBe(head)
    close(neckPolyline(head, DIRECTION_ANGLE.RIGHT, C)[0], { x: 88, y: 100 })
  })
})

describe('tail taper', () => {
  it('segment 0→1 is 0.44W, 1→2 is 0.74W, then W', () => {
    expect(segmentWidth(0, 10)).toBeCloseTo(4.4)
    expect(segmentWidth(1, 10)).toBeCloseTo(7.4)
    expect(segmentWidth(2, 10)).toBe(10)
    expect(segmentWidth(40, 10)).toBe(10)
  })

  it('runs of equal width share their joints', () => {
    const pts = [0, 1, 2, 3, 4].map((i) => ({ x: i * C, y: 0 }))
    const runs = taperRuns(pts, 10)
    expect(runs.map((r) => r.width)).toEqual([4.4, 7.4, 10].map((w) => expect.closeTo(w)))
    expect(runs[0].points).toEqual([pts[0], pts[1]])
    expect(runs[1].points).toEqual([pts[1], pts[2]])
    expect(runs[2].points).toEqual([pts[2], pts[3], pts[4]])
  })

  it('a piece that starts deeper in the body is already full width', () => {
    const pts = [0, 1, 2].map((i) => ({ x: i * C, y: 0 }))
    expect(taperRuns(pts, 10, 5).map((r) => r.width)).toEqual([10])
    expect(taperRuns(pts, 10, 1).map((r) => r.width)).toEqual([expect.closeTo(7.4), 10])
  })
})

describe('dashes by arc length', () => {
  const dashLength = (dashes: Pt[][]) => dashes.reduce((sum, d) => sum + polylineLength(d), 0)

  it('straight line: on 2 / off 5', () => {
    const dashes = dashPolyline([{ x: 0, y: 0 }, { x: 20, y: 0 }], 2, 5)
    expect(dashes.map((d) => [d[0].x, d[d.length - 1].x])).toEqual([
      [0, 2],
      [7, 9],
      [14, 16],
    ])
  })

  it('phase continues the pattern from the length drawn before', () => {
    const whole = dashPolyline([{ x: 0, y: 0 }, { x: 30, y: 0 }], 3, 19)
    const second = dashPolyline([{ x: 20, y: 0 }, { x: 30, y: 0 }], 3, 19, 20)
    expect(second.map((d) => [d[0].x, d[d.length - 1].x])).toEqual([[22, 25]])
    expect(whole.map((d) => [d[0].x, d[d.length - 1].x])).toEqual([
      [0, 3],
      [22, 25],
    ])
  })

  it('a dash through a corner keeps the corner vertex', () => {
    const dashes = dashPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 4, 4)
    // 0–4, 8–12 (через угол (10,0)), 16–20.
    expect(dashes).toHaveLength(3)
    expect(dashes[1]).toEqual([{ x: 8, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 2 }])
    expect(dashLength(dashes)).toBeCloseTo(12)
  })

  it('total dash length ≈ on / period of the line', () => {
    const pts = [{ x: 0, y: 0 }, { x: 700, y: 0 }, { x: 700, y: 700 }]
    expect(dashLength(dashPolyline(pts, 2, 5))).toBeCloseTo((1400 * 2) / 7, 0)
  })
})

describe('head rotation', () => {
  it('turns to the new direction during the first 30% of the tick', () => {
    const { RIGHT, DOWN } = DIRECTION_ANGLE
    expect(headRotation(RIGHT, DOWN, 0)).toBeCloseTo(RIGHT)
    expect(headRotation(RIGHT, DOWN, 0.15)).toBeCloseTo(Math.PI / 4)
    expect(headRotation(RIGHT, DOWN, 0.3)).toBeCloseTo(DOWN)
    expect(headRotation(RIGHT, DOWN, 0.9)).toBeCloseTo(DOWN)
  })

  it('takes the short way round (UP → LEFT is a quarter turn, not three)', () => {
    const halfway = headRotation(DIRECTION_ANGLE.UP, DIRECTION_ANGLE.LEFT, 0.15)
    expect(halfway).toBeCloseTo(-Math.PI * 0.75)
    expect(Math.cos(headRotation(DIRECTION_ANGLE.UP, DIRECTION_ANGLE.LEFT, 1))).toBeCloseTo(-1)
  })
})

describe('dashes: robustness', () => {
  it('terminates for non-representable dash lengths and phases (cell sizes like 22.6 px)', () => {
    for (let cell = 14; cell < 30; cell += 0.37) {
      const px = cell / 24
      const pts = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ x: (i + 0.5) * cell, y: ((i % 2) + 0.5) * cell }))
      for (const phase of [0, px * 7, px * 22 * 3, 1e-13, polylineLength(pts) / 3]) {
        const on = 2 * px
        const period = 7 * px
        const dashes = dashPolyline(pts, on, 5 * px, phase)
        const total = dashes.reduce((sum, d) => sum + polylineLength(d), 0)
        expect(Math.abs(total - (polylineLength(pts) * on) / period)).toBeLessThan(on + 1e-6)
      }
    }
  })
})
