import { describe, it, expect } from 'vitest'
import { createFrameRecorder, perfReport, summarizeFrames, summarizePerf, type TickSample } from '../perf'

const sample = (tick: number, at: number, botMs = 2, commitMs = 3): TickSample => ({
  tick,
  at,
  costMs: 1,
  botMs,
  commitMs,
})

describe('summarizePerf', () => {
  it('is all zeros with no ticks', () => {
    expect(summarizePerf([], 180)).toEqual({ ticks: 0, avgInterval: 0, lateTicksPct: 0, p95Work: 0, maxWork: 0 })
  })

  it('averages intervals and counts ticks later than 1.5 × tickMs', () => {
    // Интервалы: 180, 180, 300 (опоздал), 170.
    const samples = [sample(1, 0), sample(2, 180), sample(3, 360), sample(4, 660), sample(5, 830)]
    const s = summarizePerf(samples, 180)
    expect(s.ticks).toBe(5)
    expect(s.avgInterval).toBe(207.5)
    expect(s.lateTicksPct).toBe(25)
  })

  it('work = bot + tick + render; reports p95 and max', () => {
    const samples = Array.from({ length: 20 }, (_, i) => sample(i + 1, i * 180, i, 10))
    const s = summarizePerf(samples, 180)
    expect(s.maxWork).toBe(29)
    expect(s.p95Work).toBe(29)
  })

  it('exactly 1.5 × tickMs is not late', () => {
    expect(summarizePerf([sample(1, 0), sample(2, 270)], 180).lateTicksPct).toBe(0)
  })
})

describe('summarizePerf: breaks', () => {
  it('the interval into the first tick after a break (countdown, pause, lost life) is not counted', () => {
    const samples = [sample(1, 0), sample(2, 180), { ...sample(3, 5000), afterBreak: true }, sample(4, 5180)]
    const s = summarizePerf(samples, 180)
    expect(s.lateTicksPct).toBe(0)
    expect(s.avgInterval).toBe(180)
  })
})

describe('createFrameRecorder', () => {
  it('fps over the last second, frame() average and max', () => {
    const r = createFrameRecorder()
    for (let i = 0; i < 120; i++) r.record(i === 50 ? 12 : 2, i * (1000 / 60))
    const s = r.summary()
    expect(s.frames).toBe(120)
    expect(s.fps).toBe(60)
    expect(s.frameMax).toBe(12)
    expect(s.frameAvg).toBeCloseTo((119 * 2 + 12) / 120, 1)
  })
})

describe('summarizeFrames', () => {
  it('fps: average over the run and the worst full 5-second window; frame() p95', () => {
    const samples: [number, number][] = []
    let t = 0
    // 5 с по 60 FPS, затем 5 с по 20 FPS, затем ещё 2 с по 60 (неполное окно — не в минимуме).
    for (let i = 0; i < 300; i++) samples.push([1, (t += 1000 / 60)])
    for (let i = 0; i < 100; i++) samples.push([i < 10 ? 20 : 2, (t += 50)])
    for (let i = 0; i < 120; i++) samples.push([1, (t += 1000 / 60)])
    const s = summarizeFrames(samples)
    expect(s.fpsMin5s).toBeCloseTo(20, 0)
    expect(s.fpsAvg).toBeCloseTo((519 * 1000) / (t - samples[0][1]), 0)
    expect(s.frameP95).toBe(2)
    expect(s.frameMax).toBe(20)
  })

  it('no full window yet: the minimum is the average', () => {
    const samples: [number, number][] = Array.from({ length: 60 }, (_, i) => [1, i * 20])
    const s = summarizeFrames(samples)
    expect(s.fpsMin5s).toBe(s.fpsAvg)
  })
})

describe('perfReport', () => {
  it('has theme, fps avg/min over 5 s, frameAvg, frameP95 and device', () => {
    ;(globalThis as { navigator?: unknown }).navigator ??= { userAgent: 'test' }
    ;(globalThis as { screen?: unknown }).screen ??= { width: 375, height: 667 }
    ;(globalThis as { window?: unknown }).window ??= { devicePixelRatio: 2 }
    const frames = summarizeFrames(Array.from({ length: 400 }, (_, i) => [1 + (i % 10), i * 16.7] as [number, number]))
    const json = JSON.parse(perfReport(summarizePerf([], 180), { mode: 'solo', speed: 'fast', difficulty: 'easy', theme: '2026' }, frames))
    expect(json.theme).toBe('2026')
    expect(json.fps).toEqual({ avg: frames.fpsAvg, min5s: frames.fpsMin5s })
    expect(json.frameAvg).toBe(frames.frameAvg)
    expect(json.frameP95).toBe(frames.frameP95)
    expect(json.device).toHaveProperty('model')
  })
})
