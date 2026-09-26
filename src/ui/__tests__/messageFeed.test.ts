import { describe, it, expect } from 'vitest'
import { HeldFlag, MessageFeed } from '../messageFeed'

describe('MessageFeed', () => {
  it('keeps a message for at least 1.2 s even if the next ticks are silent', () => {
    const feed = new MessageFeed(1200)
    feed.push(['RED left home'], 0)
    expect(feed.visible(0)).toEqual(['RED left home'])
    expect(feed.visible(180)).toEqual(['RED left home'])
    expect(feed.visible(1199)).toEqual(['RED left home'])
    expect(feed.visible(1200)).toEqual([])
  })

  it('a shown message is never pushed out early by newer ones', () => {
    const feed = new MessageFeed(1200, 2)
    feed.push(['RED left home'], 0)
    expect(feed.visible(0)).toEqual(['RED left home'])
    feed.push(['You captured 4 cells'], 180)
    expect(feed.visible(180)).toEqual(['RED left home', 'You captured 4 cells'])
    feed.push(['RED captured 6 cells'], 360)
    // Нет места: третье ждёт, первые два остаются на экране.
    expect(feed.visible(360)).toEqual(['RED left home', 'You captured 4 cells'])
    expect(feed.visible(1200)).toEqual(['You captured 4 cells', 'RED captured 6 cells'])
  })

  it('a repeat of a shown message extends it instead of flickering', () => {
    const feed = new MessageFeed(1200, 2)
    feed.push(['RED left home'], 0)
    feed.visible(0)
    feed.push(['RED left home'], 1000)
    expect(feed.visible(1500)).toEqual(['RED left home'])
    expect(feed.visible(2200)).toEqual([])
  })

  it('drops the oldest waiting message when too many pile up', () => {
    const feed = new MessageFeed(1200, 1, 2)
    feed.push(['a'], 0)
    feed.visible(0)
    feed.push(['b', 'c', 'd'], 100)
    expect(feed.visible(1200)).toEqual(['c'])
    expect(feed.visible(2400)).toEqual(['d'])
  })
})

describe('HeldFlag', () => {
  it('stays on for the hold time after the last true', () => {
    const flag = new HeldFlag(1200)
    expect(flag.update(true, 0)).toBe(true)
    expect(flag.update(false, 180)).toBe(true)
    expect(flag.update(true, 360)).toBe(true)
    expect(flag.update(false, 1559)).toBe(true)
    expect(flag.update(false, 1560)).toBe(false)
  })
})
