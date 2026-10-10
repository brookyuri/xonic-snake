import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GraphicsGuard, RESTORE_RETRY_MS, RESTORE_TIMEOUT_MS, type GraphicsGuardHooks } from '../graphicsGuard'

function setup(results: (boolean | 'throw')[], hidden = false) {
  const log: string[] = []
  const state = { hidden }
  const hooks: GraphicsGuardHooks = {
    mount: async () => {
      const next = results.length > 1 ? results.shift()! : results[0]
      log.push('mount')
      if (next === 'throw') throw new Error('no context')
      return next
    },
    teardown: () => log.push('teardown'),
    hidden: () => state.hidden,
    onLost: () => log.push('lost'),
    onRestored: () => log.push('restored'),
    onGiveUp: () => log.push('giveUp'),
  }
  return { guard: new GraphicsGuard(hooks), log, state }
}

describe('GraphicsGuard', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('контекст потерян на видимой вкладке: рендерер пересоздаётся сразу', async () => {
    const { guard, log } = setup([true])
    guard.lost()
    await vi.advanceTimersByTimeAsync(0)
    expect(log).toEqual(['teardown', 'lost', 'mount', 'restored'])
    expect(guard.status).toBe('ok')
    // Таймер 3 с снят: перехода на 1986 нет.
    await vi.advanceTimersByTimeAsync(RESTORE_TIMEOUT_MS * 2)
    expect(log).not.toContain('giveUp')
  })

  it('потерян в фоне: ждём возврата на вкладку, потом пересоздаём', async () => {
    const { guard, log, state } = setup([true], true)
    guard.lost()
    await vi.advanceTimersByTimeAsync(RESTORE_TIMEOUT_MS * 3)
    expect(log).toEqual(['teardown', 'lost'])
    state.hidden = false
    guard.visible()
    await vi.advanceTimersByTimeAsync(0)
    expect(log).toEqual(['teardown', 'lost', 'mount', 'restored'])
  })

  it('первые попытки рисуют пусто или падают — повторяет, пока не выйдет', async () => {
    const { guard, log } = setup(['throw', false, true])
    guard.lost()
    await vi.advanceTimersByTimeAsync(RESTORE_RETRY_MS * 2)
    expect(log.filter((e) => e === 'mount')).toHaveLength(3)
    expect(log[log.length - 1]).toBe('restored')
  })

  it('контекст не вернулся за 3 с — переход на 1986, игра не ломается', async () => {
    const { guard, log } = setup(['throw'])
    guard.lost()
    await vi.advanceTimersByTimeAsync(RESTORE_TIMEOUT_MS - 1)
    expect(log).not.toContain('giveUp')
    await vi.advanceTimersByTimeAsync(1)
    expect(log[log.length - 1]).toBe('giveUp')
    expect(guard.status).toBe('failed')
    const mounts = log.filter((e) => e === 'mount').length
    await vi.advanceTimersByTimeAsync(RESTORE_TIMEOUT_MS)
    expect(log.filter((e) => e === 'mount')).toHaveLength(mounts)
  })

  it('повторная потеря во время восстановления не запускает второй цикл', async () => {
    const { guard, log } = setup([true], true)
    guard.lost()
    guard.lost()
    expect(log).toEqual(['teardown', 'lost'])
  })
})
