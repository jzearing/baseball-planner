import { describe, expect, it } from 'vitest'
import { decodeShareFragment, encodeShareFragment } from './share'
import { coerceState, defaultState } from './storage'
import { solvePlan } from './solver'
import { seededRng } from './rng'

describe('share links', () => {
  it('round-trips a full setup through a compact fragment', async () => {
    const s = defaultState()
    s.gameTitle = 'Tigers vs. Cubs'
    s.players = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, name: `Player ${i + 1}`, active: i !== 3 }))
    const state = coerceState(s)
    state.plan = solvePlan(state, { keepFixed: false, rng: seededRng(1) })
    state.plan[1].fixed = ['p2']
    const frag = await encodeShareFragment(state)
    expect(frag.startsWith('s=1.')).toBe(true)
    expect(frag).toMatch(/^[A-Za-z0-9._=-]+$/)
    expect(frag.length).toBeLessThan(JSON.stringify(state).length / 2)
    const back = await decodeShareFragment(`#${frag}`)
    expect(back).toEqual(state)
  })

  it('ignores fragments that are not share links', async () => {
    expect(await decodeShareFragment('')).toBeNull()
    expect(await decodeShareFragment('#top')).toBeNull()
  })

  it('rejects malformed links', async () => {
    await expect(decodeShareFragment('#s=9.abc')).rejects.toThrow()
    await expect(decodeShareFragment('#s=1.notvalid')).rejects.toThrow()
  })
})
