import type { EvalContext } from './constraints'
import { BENCH } from './types'
import type { Preference } from './types'

/** Cost added per fielding inning where a preferred player is not at a preferred position. */
export const PREFERENCE_WEIGHT = 0.25

/** Solver cost for a (possibly partial) plan; strictly below one hard violation per inning. */
export function preferenceCost(ctx: EvalContext, preferences: Preference[]): number {
  let cost = 0
  for (const pref of preferences) {
    if (!pref.enabled || !pref.playerId) continue
    const wanted = pref.positions.filter((p) => ctx.positions.includes(p))
    if (wanted.length === 0) continue
    for (const lk of ctx.lookup) {
      const s = lk.get(pref.playerId)
      if (s && s !== BENCH && !wanted.includes(s)) cost += PREFERENCE_WEIGHT
    }
  }
  return cost
}

export interface PreferenceScore {
  /** Innings the player fielded at one of the preferred positions. */
  hits: number
  /** Innings the player was on the field at all. */
  fielded: number
}

/** How well the current plan honours one preference, for display. */
export function scorePreference(ctx: EvalContext, pref: Preference): PreferenceScore {
  let hits = 0
  let fielded = 0
  for (const lk of ctx.lookup) {
    const s = lk.get(pref.playerId)
    if (!s || s === BENCH) continue
    fielded++
    if (pref.positions.includes(s)) hits++
  }
  return { hits, fielded }
}
