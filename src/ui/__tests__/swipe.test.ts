import { describe, it, expect } from 'vitest'
import { swipeDirection } from '../swipe'

describe('swipeDirection', () => {
  it('ignores movement under the 24px threshold', () => {
    expect(swipeDirection(10, -20)).toBeNull()
    expect(swipeDirection(23, 0)).toBeNull()
  })

  it('picks the dominant axis', () => {
    expect(swipeDirection(30, 5)).toBe('RIGHT')
    expect(swipeDirection(-30, 12)).toBe('LEFT')
    expect(swipeDirection(4, -26)).toBe('UP')
    expect(swipeDirection(-10, 40)).toBe('DOWN')
  })
})
