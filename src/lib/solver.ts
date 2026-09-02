import type { AppState, Inning, PlayerId, Slot } from './types'
import { BENCH } from './types'
import { evaluateAll, makeContext, solverCostAll } from './constraints'
import { activePlayers, emptyInning, slotOf } from './plan'
import { sportDef } from './positions'
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
  /** Whole-plan attempts; the plan with the fewest violations wins. */
  attempts?: number
  /** Overall time budget across attempts, in milliseconds. */
  totalBudgetMs?: number
}

/**
 * Solve the whole game. Each attempt solves inning by inning from the first
 * inning onward, so earlier innings come out clean and any trouble lands late.
 * Because a greedy early inning can paint a later one into a corner (for
 * example, both eligible goalkeepers due to sit in the last quarter), the whole
 * solve is repeated a few times and the plan with the fewest violations is kept.
 */
export function solvePlan(state: AppState, opts: SolveOptions): Inning[] {
  const attempts = Math.max(1, opts.attempts ?? 6)
  const deadline = Date.now() + (opts.totalBudgetMs ?? 2500)
  let best: { plan: Inning[]; score: number } | null = null
  for (let a = 0; a < attempts; a++) {
    const plan = solveOnce(state, opts)
    const violations = evaluateAll(makeContext(state, plan), state.constraints)
    // Weight late-inning violations slightly less so a clean start is preferred on ties.
    const score = violations.reduce((acc, v) => acc + 1 + (state.inningCount - (v.inning ?? state.inningCount)) * 0.01, 0)
    if (!best || score < best.score) best = { plan, score }
    if (best.score === 0 || Date.now() >= deadline) break
  }
  return best ? best.plan : solveOnce(state, opts)
}

function solveOnce(state: AppState, opts: SolveOptions): Inning[] {
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
        emptyPenalty(inn, state)
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

/** Mild preference about which spots to leave empty when the roster is short (sport-specific). */
function emptyPenalty(inn: Inning, state: AppState): number {
  const penalty = sportDef(state.sport).emptyPenalty
  let cost = 0
  for (const p of state.positions) if (inn.positions[p] === null) cost += penalty(p)
  return cost
}
