import { describe, expect, it } from 'vitest'
import { coerceState, defaultState } from './storage'

describe('coerceState rule order migration', () => {
  it('moves who-may-play-where rules to the top once for saves without a version 2 marker', () => {
    const old = {
      version: 1,
      players: [{ id: 'a', name: 'A' }],
      constraints: [
        { id: 'r1', type: 'no-repeat-position', enabled: true, params: {} },
        { id: 'r2', type: 'equal-sitting', enabled: true, params: {} },
        { id: 'r3', type: 'position-eligibility', enabled: true, params: { position: 'C', playerIds: ['a'] } },
      ],
    }
    const s = coerceState(old)
    expect(s.version).toBe(2)
    expect(s.constraints.slice(0, 3).map((c) => c.id)).toEqual(['r3', 'r1', 'r2'])
  })

  it('sorts by a saved numeric priority when one is present', () => {
    const old = {
      version: 1,
      constraints: [
        { id: 'r1', type: 'no-repeat-position', enabled: true, priority: 1, params: {} },
        { id: 'r2', type: 'equal-sitting', enabled: true, priority: 4, params: {} },
        { id: 'r3', type: 'no-consecutive-bench', enabled: true, priority: 2, params: {} },
      ],
    }
    expect(coerceState(old).constraints.slice(0, 3).map((c) => c.id)).toEqual(['r2', 'r3', 'r1'])
  })

  it('leaves the order of a version 2 save alone', () => {
    const s = defaultState()
    s.constraints = [
      { id: 'r1', type: 'no-repeat-position', enabled: true, params: {} },
      { id: 'r3', type: 'position-eligibility', enabled: true, params: { position: 'C', playerIds: [] } },
      { id: 'r2', type: 'equal-sitting', enabled: true, params: {} },
    ]
    expect(coerceState(JSON.parse(JSON.stringify(s))).constraints.slice(0, 3).map((c) => c.id)).toEqual(['r1', 'r3', 'r2'])
  })
})
