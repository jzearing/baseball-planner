import { describe, expect, it } from 'vitest'
import { activePlayers, benchRowCount, benchSize, columnList, moveItem, normalizeInning, shuffleBattingOrder, swapAcrossInnings, swapItems, writeColumn } from './plan'
import { seededRng } from './rng'
import { coerceState, defaultState } from './storage'
import type { AppState, Inning, Player, PlayerId } from './types'
import { reducer } from '../state'
import { solvePlan } from './solver'

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

describe('shuffleBattingOrder', () => {
  it('keeps locked batters in their exact spots and shuffles the rest', () => {
    const order = ['a', 'b', 'c', 'd', 'e', 'f']
    let movedSomething = false
    for (let seed = 1; seed <= 5; seed++) {
      const out = shuffleBattingOrder(order, ['b', 'e'], seededRng(seed))
      expect(out[1]).toBe('b')
      expect(out[4]).toBe('e')
      expect([...out].sort()).toEqual([...order].sort())
      if (out.join() !== order.join()) movedSomething = true
    }
    expect(movedSomething).toBe(true)
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

/**
 * Marking a player absent used to pull a different player out of the lineup.
 *
 * The absent player's fielding slot is vacated rather than backfilled, so the
 * inning sits one more player than `activePlayers - positions` — but the grid
 * drew only that many bench rows, so the extra one was not shown. A coach then
 * saw the wrong name missing, and the next drag in that inning wrote the column
 * back from what the grid showed, deleting the hidden player for real.
 */
describe('marking a fielder absent', () => {
  function solved(playerCount: number): AppState {
    let s = defaultState('baseball')
    s = reducer(s, { type: 'add-players', names: Array.from({ length: playerCount }, (_, i) => `P${i}`) })
    return { ...s, plan: solvePlan(s, { keepFixed: false }) }
  }

  function inInning(state: AppState, inning: number): PlayerId[] {
    const inn = state.plan[inning]
    return [...Object.values(inn.positions).filter((x): x is PlayerId => !!x), ...inn.bench]
  }

  it('leaves every remaining player visible in the grid', () => {
    const before = solved(10)
    const absent = before.plan[0].positions[before.positions[0]]
    expect(absent).toBeTruthy()

    const after = reducer(before, { type: 'toggle-player-active', id: absent! })
    const rows = benchRowCount(after)
    const shown = columnList(after.plan[0], after.positions, rows).filter(Boolean)

    // One more row than the arithmetic, because a fielding slot is now empty.
    expect(rows).toBe(benchSize(after) + 1)
    for (const player of activePlayers(after)) expect(shown).toContain(player.id)
    expect(shown).not.toContain(absent)
  })

  it('vacates only that slot and moves nobody else', () => {
    const before = solved(10)
    const position = before.positions[0]
    const absent = before.plan[0].positions[position]!

    const after = reducer(before, { type: 'toggle-player-active', id: absent })
    expect(after.plan[0].positions[position]).toBeNull()
    for (const pos of after.positions.slice(1)) {
      expect(after.plan[0].positions[pos]).toBe(before.plan[0].positions[pos])
    }
  })

  it('keeps everyone through a later drag in that inning', () => {
    const before = solved(10)
    const absent = before.plan[0].positions[before.positions[0]]!
    const after = reducer(before, { type: 'toggle-player-active', id: absent })

    const dragged = reducer(after, { type: 'swap-cell', inning: 0, a: 1, b: 2 })
    expect(inInning(dragged, 0).sort()).toEqual(inInning(after, 0).sort())
  })
})

describe('writeColumn', () => {
  // Belt and braces for the bug above: a short list must not lose a player.
  it('re-benches a player the list leaves out rather than dropping them', () => {
    const inn: Inning = { positions: { P: 'a', C: 'b', '1B': 'c' }, bench: ['d', 'e'], fixed: [] }
    const next = writeColumn(inn, positions, ['a', 'b', 'c', 'd'])
    expect(next.bench).toEqual(['d', 'e'])
  })
})
