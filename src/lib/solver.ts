import type { AppState, Inning, PlayerId, PositionId, Slot } from './types'
import { BENCH } from './types'
import { evaluateAll, makeContext, solverCostAll } from './constraints'
import { activePlayers, emptyInning, slotOf } from './plan'
import { positionDef } from './positions'
import { preferenceCost } from './preferences'
import { randomInt, shuffle, type Rng } from './rng'

export interface SolveOptions {
  /** Keep players marked fixed in the existing plan where they are. */
  keepFixed: boolean
  rng?: Rng
  /** Rough time budget per inning, in milliseconds. */
  timeBudgetMs?: number
  restarts?: number
  maxIterations?: number
}

/**
 * Solve inning by inning from the first inning onward. Each inning is chosen by
 * randomized local search that minimizes the number of constraint violations in
 * the plan so far (plus look-ahead costs). Earlier innings are never revisited,
 * so when the constraints cannot all be met the earlier innings come out clean
 * and violations pile up toward the end.
 */
export function solvePlan(state: AppState, opts: SolveOptions): Inning[] {
  const rng = opts.rng ?? Math.random
  const budget = opts.timeBudgetMs ?? 120
  const restarts = opts.restarts ?? 8
  const maxIter = opts.maxIterations ?? 400
  const solved: Inning[] = []
  const players = activePlayers(state)

  for (let i = 0; i < state.inningCount; i++) {
    const base = opts.keepFixed ? state.plan[i] : undefined
    const fixedIds = base ? base.fixed.filter((pid) => players.some((p) => p.id === pid)) : []
    const fixedSlots = new Map<PlayerId, Slot>()
    for (const pid of fixedIds) {
      const s = base ? slotOf(base, pid) : undefined
      fixedSlots.set(pid, s ?? BENCH)
    }
    const takenPositions = new Set([...fixedSlots.values()].filter((s) => s !== BENCH))
    const freePositions = state.positions.filter((p) => !takenPositions.has(p))
    const freePlayers = players.map((p) => p.id).filter((pid) => !fixedSlots.has(pid))
    const benchSlots = Math.max(0, freePlayers.length - freePositions.length)
    const slots: Slot[] = [...freePositions, ...Array<Slot>(benchSlots).fill(BENCH)]
    const candidates: (PlayerId | null)[] = [...freePlayers]
    while (candidates.length < slots.length) candidates.push(null)

    // Locked bench players keep their exact bench row; free bench players fill the gaps in order.
    const benchRows = Math.max(0, players.length - state.positions.length)
    const benchTemplate: (PlayerId | null)[] = Array<PlayerId | null>(benchRows).fill(null)
    for (const [pid, s] of fixedSlots) {
      if (s !== BENCH) continue
      const at = base ? base.bench.indexOf(pid) : -1
      const row = at >= 0 && at < benchRows && benchTemplate[at] === null ? at : benchTemplate.indexOf(null)
      if (row >= 0) benchTemplate[row] = pid
    }

    const build = (perm: (PlayerId | null)[]): Inning => {
      const inn = emptyInning(state.positions, [])
      inn.fixed = [...fixedIds]
      for (const [pid, s] of fixedSlots) if (s !== BENCH) inn.positions[s] = pid
      const bench = [...benchTemplate]
      let next = 0
      perm.forEach((pid, k) => {
        const s = slots[k]
        if (s === BENCH) {
          if (!pid) return
          while (next < bench.length && bench[next] !== null) next++
          if (next < bench.length) bench[next] = pid
          else bench.push(pid)
        } else {
          inn.positions[s] = pid
        }
      })
      inn.bench = bench.filter((x): x is PlayerId => x !== null)
      return inn
    }

    const cost = (perm: (PlayerId | null)[]): number => {
      const inn = build(perm)
      const ctx = makeContext(state, [...solved, inn])
      return (
        evaluateAll(ctx, state.constraints).length +
        solverCostAll(ctx, state.constraints) +
        preferenceCost(ctx, state.preferences) +
        emptyInfieldPenalty(inn, state.positions)
      )
    }

    let best: { perm: (PlayerId | null)[]; cost: number } | null = null
    const deadline = Date.now() + budget
    for (let r = 0; r < restarts; r++) {
      let perm = shuffle(candidates, rng)
      let c = cost(perm)
      let iter = 0
      while (c > 0 && iter < maxIter && Date.now() < deadline) {
        iter++
        const a = randomInt(perm.length, rng)
        const b = randomInt(perm.length, rng)
        if (a === b || perm[a] === perm[b]) continue
        const next = [...perm]
        ;[next[a], next[b]] = [next[b], next[a]]
        const c2 = cost(next)
        if (c2 <= c) {
          perm = next
          c = c2
        }
      }
      if (!best || c < best.cost) best = { perm, cost: c }
      if (best.cost === 0 || Date.now() >= deadline) break
    }
    solved.push(build(best ? best.perm : candidates))
  }
  return solved
}

/** Mild preference for leaving outfield spots empty when the roster is short. */
function emptyInfieldPenalty(inn: Inning, positions: PositionId[]): number {
  let n = 0
  for (const p of positions) if (inn.positions[p] === null && positionDef(p).group !== 'outfield') n++
  return n * 0.2
}
