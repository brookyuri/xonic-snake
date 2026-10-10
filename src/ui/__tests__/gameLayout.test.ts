import { describe, expect, it } from 'vitest'
import { gameLayout, MIN_CELL_PX, MIN_PAD_PX, PAUSE_GAP_PX, type Insets } from '../gameLayout'
import { BOARD_SIZE } from '../../engine/constants'
import { SOLO_BOARD_SIZE } from '../../engine/solo'

/** Видимые области реальных браузеров (ширина × высота без адресной строки и панелей). */
const VIEWPORTS: [number, number][] = [
  [360, 560],
  [360, 640],
  [375, 553],
  [375, 667],
  [390, 664],
  [390, 844],
  [412, 732],
  [412, 780],
  [412, 839],
]

/** Шапка с запасом: замеры 2026 — 80…94px (Duel / Solo), 1986 — 68px. */
const HEADER = { '2026': 96, '1986': 70 } as const
const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
/** Телефон с вырезом и панелью жестов. */
const NOTCH: Insets = { top: 24, right: 0, bottom: 24, left: 0 }

describe('gameLayout', () => {
  for (const theme of ['2026', '1986'] as const) {
    for (const [mode, cols] of [
      ['solo', SOLO_BOARD_SIZE],
      ['duel', BOARD_SIZE],
    ] as const) {
      for (const [width, height] of VIEWPORTS) {
        for (const insets of [NO_INSETS, NOTCH]) {
          const label = `${theme} ${mode} ${width}×${height}${insets === NOTCH ? ' с вырезом' : ''}`
          it(`${label}: блоки помещаются, клетка ≥ ${MIN_CELL_PX}px (или пэд минимальный)`, () => {
            const l = gameLayout({ theme, width, height, insets, headerPx: HEADER[theme], cols })
            expect(l.usedPx).toBeLessThanOrEqual(height)
            // С вырезом на самых низких экранах 12px не помещаются и при пэде 132 — тогда
            // пэд минимальный, а прокрутки всё равно нет.
            if (insets === NO_INSETS || l.padPx > MIN_PAD_PX) expect(l.cellPx).toBeGreaterThanOrEqual(MIN_CELL_PX)
            expect(l.gridPx).toBe(l.cellPx * cols)
            expect(l.boardPx).toBeLessThanOrEqual(Math.min(480, width) - 32 + (theme === '2026' ? 18 : 0))
            expect(l.padPx).toBeGreaterThanOrEqual(MIN_PAD_PX)
            expect(l.padTopPx).toBeGreaterThanOrEqual((height * 2) / 3)
            if (theme === '2026') expect(l.pauseGapPx).toBeGreaterThanOrEqual(PAUSE_GAP_PX)
          })
        }
      }
    }
  }

  it('большой экран: пэд в полный размер, поле во всю ширину колонки', () => {
    const l = gameLayout({ theme: '2026', width: 412, height: 839, insets: NO_INSETS, headerPx: 96, cols: SOLO_BOARD_SIZE })
    expect(l.padPx).toBe(168)
    expect(l.boardPx).toBe(412 - 32 + 18)
  })

  it('клетка меньше 12px — пэд уменьшается, но не ниже 132px и без выхода за экран', () => {
    const l = gameLayout({ theme: '2026', width: 375, height: 553, insets: NO_INSETS, headerPx: 96, cols: SOLO_BOARD_SIZE })
    expect(l.padPx).toBeLessThan(168)
    expect(l.cellPx).toBeGreaterThanOrEqual(MIN_CELL_PX)
    const tiny = gameLayout({ theme: '2026', width: 320, height: 420, insets: NO_INSETS, headerPx: 96, cols: SOLO_BOARD_SIZE })
    expect(tiny.padPx).toBe(MIN_PAD_PX)
    expect(tiny.usedPx).toBeLessThanOrEqual(420)
  })

  it('пауза над правой стрелкой при любом пэде: зазор ≥ 24px', () => {
    for (let height = 420; height <= 900; height += 7) {
      for (const width of [320, 360, 375, 412]) {
        const l = gameLayout({ theme: '2026', width, height, insets: NO_INSETS, headerPx: 96, cols: SOLO_BOARD_SIZE })
        expect(l.pauseGapPx).toBeGreaterThanOrEqual(PAUSE_GAP_PX)
        expect(l.usedPx).toBeLessThanOrEqual(height)
      }
    }
  })
})
