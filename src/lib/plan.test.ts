import { describe, expect, it } from 'vitest'
import { columnList, moveItem, normalizeInning, swapItems, writeColumn } from './plan'
import type { Inning, Player } from './types'

const players: Player[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id.toUpperCase(), active: true }))
const positions = ['P', 'C', '1B']

describe('moveItem', () => {
  it('moves forward and shifts others up', () => {
    expect(moveItem([1, 2, 3, 4, 5], 0, 3)).toEqual([2, 3, 1, 4, 5])
  })
  it('moves backward and shifts others down', () => {
    expect(moveItem([1, 2, 3, 4, 5], 4, 1)).toEqual([1, 5, 2, 3, 4])
  })
  it('appends when inserting past the end', () => {
    expect(moveItem([1, 2, 3], 0, 3)).toEqual([2, 3, 1])
  })
  it('is a no-op when inserting at its own slot', () => {
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 2, 3])
    expect(moveItem([1, 2, 3], 1, 2)).toEqual([1, 2, 3])
  })
})

describe('swapItems', () => {
  it('swaps two entries', () => {
    expect(swapItems([1, 2, 3], 0, 2)).toEqual([3, 2, 1])
  })
})

describe('normalizeInning', () => {
  it('puts every player exactly once, dropping unknown/duplicate ids', () => {
    const raw: Inning = { positions: { P: 'a', C: 'a', SS: 'b', '1B': 'zzz' }, bench: ['c', 'c'], fixed: ['a', 'zzz'] }
    const inn = normalizeInning(raw, positions, players)
    expect(inn.positions).toEqual({ P: 'a', C: null, '1B': null })
    expect(inn.bench).toEqual(['c', 'b', 'd', 'e'])
    expect(inn.fixed).toEqual(['a'])
  })
})

describe('columnList / writeColumn', () => {
  it('round-trips and supports insert-shift into the bench', () => {
    const inn: Inning = { positions: { P: 'a', C: 'b', '1B': 'c' }, bench: ['d', 'e'], fixed: [] }
    const list = columnList(inn, positions, 2)
    expect(list).toEqual(['a', 'b', 'c', 'd', 'e'])
    // Drag the bench player E and insert before P: everyone shifts down one slot.
    const next = writeColumn(inn, positions, moveItem(list, 4, 0))
    expect(next.positions).toEqual({ P: 'e', C: 'a', '1B': 'b' })
    expect(next.bench).toEqual(['c', 'd'])
  })
})
