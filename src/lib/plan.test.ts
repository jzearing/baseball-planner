import { describe, expect, it } from 'vitest'
import { columnList, moveItem, normalizeInning, swapAcrossInnings, swapItems, writeColumn } from './plan'
import { coerceState, defaultState } from './storage'
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

describe('swapAcrossInnings', () => {
  function state() {
    const s = defaultState()
    s.positions = ['C', 'P', '1B']
    s.inningCount = 2
    s.players = ['eli', 'lee', 'ann', 'bob'].map((id) => ({ id, name: id, active: true }))
    s.plan = [
      { positions: { C: 'eli', P: 'ann', '1B': 'bob' }, bench: ['lee'], fixed: [] },
      { positions: { C: 'lee', P: 'eli', '1B': 'ann' }, bench: ['bob'], fixed: ['lee'] },
    ]
    return coerceState(s)
  }
  it('trades the two players in both innings', () => {
    // Drag Eli (C, inning 1) onto Lee (C, inning 2).
    const plan = swapAcrossInnings(state(), 0, 0, 1, 0)
    expect(plan[0].positions).toEqual({ C: 'lee', P: 'ann', '1B': 'bob' })
    expect(plan[0].bench).toEqual(['eli'])
    expect(plan[1].positions).toEqual({ C: 'eli', P: 'lee', '1B': 'ann' })
    expect(plan[1].bench).toEqual(['bob'])
    expect(plan[1].fixed).toEqual(['lee'])
  })
  it('moves into an empty slot and empties the old one', () => {
    const s = state()
    s.plan[1].positions['1B'] = null
    s.plan[1].bench = ['ann', 'bob']
    // Drag Eli (C, inning 1) onto the empty 1B in inning 2: inning 1 unchanged, inning 2 Eli -> 1B, P empty.
    const plan = swapAcrossInnings(s, 0, 0, 1, 2)
    expect(plan[0]).toEqual(s.plan[0])
    expect(plan[1].positions).toEqual({ C: 'lee', P: null, '1B': 'eli' })
  })
  it('falls back to an in-inning swap when both cells are in the same inning', () => {
    const plan = swapAcrossInnings(state(), 0, 0, 0, 3)
    expect(plan[0].positions.C).toBe('lee')
    expect(plan[0].bench).toEqual(['eli'])
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
