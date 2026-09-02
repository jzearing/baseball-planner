import { describe, expect, it } from 'vitest'
import { evaluateAll, makeContext } from './constraints'
import type { ConstraintInstance, Inning, Player } from './types'

const players: Player[] = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase() }))
const positions = ['P', 'C', '1B']

function inning(pos: Record<string, string | null>, bench: string[]): Inning {
  return { positions: pos, bench, fixed: [] }
}

const c = (type: ConstraintInstance['type'], params: Record<string, unknown> = {}): ConstraintInstance => ({
  id: `t_${type}`,
  type,
  enabled: true,
  params,
})

describe('constraints', () => {
  it('no-repeat-position flags both innings where a player repeats', () => {
    const innings = [inning({ P: 'a', C: 'b', '1B': 'c' }, ['d']), inning({ P: 'a', C: 'd', '1B': 'b' }, ['c'])]
    const ctx = makeContext({ players, positions, inningCount: 2 }, innings)
    const v = evaluateAll(ctx, [c('no-repeat-position', { maxTimes: 1 })])
    expect(v.map((x) => [x.inning, x.playerId])).toEqual([
      [0, 'a'],
      [1, 'a'],
    ])
    expect(v[0].message).toContain('plays P 2 times')
  })

  it('equal-sitting respects tolerance', () => {
    const innings = [inning({ P: 'a', C: 'b', '1B': 'c' }, ['d']), inning({ P: 'a', C: 'b', '1B': 'c' }, ['d'])]
    const ctx = makeContext({ players, positions, inningCount: 2 }, innings)
    expect(evaluateAll(ctx, [c('equal-sitting', { tolerance: 2 })])).toHaveLength(0)
    const v = evaluateAll(ctx, [c('equal-sitting', { tolerance: 1 })])
    expect(v.some((x) => x.playerId === 'd' && x.inning === 1)).toBe(true)
  })

  it('no-consecutive-bench flags the extra innings of a streak', () => {
    const innings = [inning({ P: 'a', C: 'b', '1B': 'c' }, ['d']), inning({ P: 'a', C: 'b', '1B': 'c' }, ['d'])]
    const ctx = makeContext({ players, positions, inningCount: 2 }, innings)
    const v = evaluateAll(ctx, [c('no-consecutive-bench', { maxConsecutive: 1 })])
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ inning: 1, playerId: 'd' })
  })

  it('play-group-by-inning only fires once the deadline has passed', () => {
    const one = [inning({ P: 'a', C: 'b', '1B': 'c' }, ['d'])]
    const two = [...one, inning({ P: 'a', C: 'b', '1B': 'c' }, ['d'])]
    const inst = c('play-group-by-inning', { positions: ['P', 'C'], times: 1, byInning: 3 })
    expect(evaluateAll(makeContext({ players, positions, inningCount: 4 }, one), [inst])).toHaveLength(0)
    const v = evaluateAll(makeContext({ players, positions, inningCount: 4 }, two), [inst])
    expect(v.map((x) => x.playerId).sort()).toEqual(['c', 'd'])
    expect(v[0].inning).toBe(1)
  })

  it('position-eligibility and player-positions', () => {
    const innings = [inning({ P: 'a', C: 'b', '1B': 'c' }, ['d'])]
    const ctx = makeContext({ players, positions, inningCount: 1 }, innings)
    expect(evaluateAll(ctx, [c('position-eligibility', { position: 'P', playerIds: ['b'] })])).toMatchObject([{ playerId: 'a', inning: 0 }])
    expect(evaluateAll(ctx, [c('position-eligibility', { position: 'P', playerIds: ['a'] })])).toHaveLength(0)
    expect(evaluateAll(ctx, [c('player-positions', { playerId: 'c', positions: ['P'] })])).toMatchObject([{ playerId: 'c' }])
    expect(evaluateAll(ctx, [c('player-positions', { playerId: 'd', positions: [] })])).toHaveLength(0)
  })
})
