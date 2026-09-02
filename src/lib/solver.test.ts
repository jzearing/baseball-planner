import { describe, expect, it } from 'vitest'
import { evaluateAll, makeContext } from './constraints'
import { seededRng } from './rng'
import { solvePlan } from './solver'
import { coerceState, defaultState } from './storage'
import { slotOf } from './plan'
import { BENCH } from './types'
import type { AppState } from './types'

function roster(n: number): AppState {
  const s = defaultState()
  s.players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i + 1}` }))
  s.constraints = s.constraints.map((c) => ({ ...c, enabled: true }))
  s.constraints.push({ id: 'elig', type: 'position-eligibility', enabled: true, params: { position: 'P', playerIds: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'] } })
  return coerceState(s)
}

describe('solvePlan', () => {
  it('produces a complete plan with every player once per inning', () => {
    const s = roster(12)
    const plan = solvePlan(s, { keepFixed: false, rng: seededRng(1) })
    expect(plan).toHaveLength(6)
    for (const inn of plan) {
      const ids = [...Object.values(inn.positions).filter(Boolean), ...inn.bench]
      expect(new Set(ids).size).toBe(12)
      expect(inn.bench).toHaveLength(3)
    }
  })

  it('satisfies all default constraints for a normal roster', () => {
    const s = roster(12)
    const plan = solvePlan(s, { keepFixed: false, rng: seededRng(7), timeBudgetMs: 2000 })
    const v = evaluateAll(makeContext(s, plan), s.constraints)
    expect(v).toEqual([])
  })

  it('keeps fixed players where they are', () => {
    const s = roster(11)
    s.plan = solvePlan(s, { keepFixed: false, rng: seededRng(3) })
    s.plan[2].fixed = ['p4']
    s.plan[2].positions.C = 'p4'
    s.plan[2].bench = s.plan[2].bench.filter((p) => p !== 'p4')
    for (const pos of Object.keys(s.plan[2].positions)) if (pos !== 'C' && s.plan[2].positions[pos] === 'p4') s.plan[2].positions[pos] = null
    s.plan = coerceState(s).plan
    s.plan[2].fixed = ['p4', 'p9']
    const benchOrPos = slotOf(s.plan[2], 'p9')
    const next = solvePlan(s, { keepFixed: true, rng: seededRng(4) })
    expect(next[2].positions.C).toBe('p4')
    expect(slotOf(next[2], 'p9')).toBe(benchOrPos)
    expect(next[2].fixed).toEqual(['p4', 'p9'])
  })

  it('handles a roster smaller than the number of positions', () => {
    const s = roster(7)
    const plan = solvePlan(s, { keepFixed: false, rng: seededRng(5) })
    for (const inn of plan) {
      expect(inn.bench).toHaveLength(0)
      expect(Object.values(inn.positions).filter(Boolean)).toHaveLength(7)
      expect(slotOf(inn, 'p0')).not.toBe(BENCH)
    }
  })
})
