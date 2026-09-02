import type { AppState, ConstraintInstance, ConstraintType, Inning, Player, PlayerId, PositionId, Slot, Violation } from './types'
import { BENCH } from './types'
import { INFIELD_POSITIONS, periodNoun, type PeriodNoun } from './positions'
import { activePlayers, slotLookup } from './plan'

/** Everything a constraint needs to evaluate a (possibly partial) plan. */
export interface EvalContext {
  players: Player[]
  positions: PositionId[]
  /** Innings solved so far (may be shorter than totalInnings while solving). */
  innings: Inning[]
  totalInnings: number
  /** innings[i] -> player -> slot */
  lookup: Map<PlayerId, Slot>[]
  playerName: (id: PlayerId) => string
  /** Positions exempt from the repeated-position rules (set by "Who can play a position"). */
  repeatExempt: Set<PositionId>
  /** What one game segment is called ("inning", "quarter"…) for messages. */
  period: PeriodNoun
}

export function makeContext(state: Pick<AppState, 'players' | 'positions' | 'inningCount'> & { periodName?: string }, innings: Inning[]): EvalContext {
  const names = new Map(state.players.map((p) => [p.id, p.name]))
  return {
    players: activePlayers(state),
    positions: state.positions,
    innings,
    totalInnings: state.inningCount,
    lookup: innings.map(slotLookup),
    playerName: (id) => names.get(id) ?? '?',
    repeatExempt: new Set(),
    period: periodNoun(state.periodName),
  }
}

/** Positions that enabled eligibility rules have marked as exempt from repeat rules. */
export function repeatExemptPositions(constraints: ConstraintInstance[]): Set<PositionId> {
  const out = new Set<PositionId>()
  for (const c of constraints) {
    if (c.enabled && c.type === 'position-eligibility' && c.params.exemptFromRepeat === true) out.add(str(c.params, 'position'))
  }
  return out
}

export interface ConstraintDef {
  type: ConstraintType
  name: string
  description: string
  /** Repeatable constraints can be added many times (e.g. one per position). */
  repeatable: boolean
  /** New instances of "hard" rules (who may play where) go to the top of the list. */
  addAtTop: boolean
  defaultParams: () => Record<string, unknown>
  evaluate: (ctx: EvalContext, params: Record<string, unknown>, inst: ConstraintInstance) => Violation[]
  /** Optional look-ahead cost used only by the solver on partial plans (lower is better). */
  solverCost?: (ctx: EvalContext, params: Record<string, unknown>) => number
}

// ---------- param helpers ----------

export function num(params: Record<string, unknown>, key: string, fallback: number): number {
  const v = params[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export function str(params: Record<string, unknown>, key: string, fallback = ''): string {
  const v = params[key]
  return typeof v === 'string' ? v : fallback
}

export function bool(params: Record<string, unknown>, key: string, fallback = false): boolean {
  const v = params[key]
  return typeof v === 'boolean' ? v : fallback
}

export function strList(params: Record<string, unknown>, key: string): string[] {
  const v = params[key]
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function v(inst: ConstraintInstance, def: ConstraintDef, message: string, inning?: number, playerId?: PlayerId): Violation {
  // rank and weight are filled in by evaluateAll, which knows the rule's place in the list.
  return { constraintId: inst.id, constraintName: def.name, rank: 0, weight: 1, message, inning, playerId }
}

/**
 * Cost of one violation of the rule at `index` in a list of `total` rules.
 * Each step up the list is worth ten of the step below, so the solver fixes
 * higher rules first and only then trades off lower ones.
 */
export function rankWeight(index: number, total: number): number {
  return 10 ** Math.max(0, total - 1 - index)
}

/** Sum of weights over a set of violations. */
export function weightedCost(violations: Violation[]): number {
  let cost = 0
  for (const v of violations) cost += v.weight
  return cost
}

function plural(n: number, word: string): string {
  if (n === 1) return `1 ${word}`
  return `${n} ${word === 'half' ? 'halves' : `${word}s`}`
}

// ---------- definitions ----------

const noRepeatPosition: ConstraintDef = {
  type: 'no-repeat-position',
  name: 'No repeated positions',
  description: 'No player plays the same position more than a set number of times.',
  repeatable: false,
  addAtTop: false,
  defaultParams: () => ({ maxTimes: 1 }),
  evaluate(ctx, params, inst) {
    const max = Math.max(1, num(params, 'maxTimes', 1))
    const out: Violation[] = []
    for (const p of ctx.players) {
      const where = new Map<PositionId, number[]>()
      ctx.lookup.forEach((lk, i) => {
        const s = lk.get(p.id)
        if (s && s !== BENCH && !ctx.repeatExempt.has(s)) where.set(s, [...(where.get(s) ?? []), i])
      })
      for (const [pos, innings] of where) {
        if (innings.length > max) {
          for (const i of innings) {
            out.push(v(inst, this, `${ctx.playerName(p.id)} plays ${pos} ${plural(innings.length, 'time')} (max ${max})`, i, p.id))
          }
        }
      }
    }
    return out
  },
}

const equalSitting: ConstraintDef = {
  type: 'equal-sitting',
  name: 'Equal bench time',
  description: 'Every player sits the same number of innings, within a tolerance.',
  repeatable: false,
  addAtTop: false,
  defaultParams: () => ({ tolerance: 1 }),
  evaluate(ctx, params, inst) {
    const tol = Math.max(0, num(params, 'tolerance', 1))
    if (ctx.players.length === 0) return []
    const sits = sitCounts(ctx)
    const values = [...sits.values()]
    const min = Math.min(...values)
    const max = Math.max(...values)
    if (max - min <= tol) return []
    const out: Violation[] = []
    for (const p of ctx.players) {
      const n = sits.get(p.id) ?? 0
      if (n > min + tol) {
        // Flag the bench innings beyond what is allowed.
        let seen = 0
        ctx.lookup.forEach((lk, i) => {
          if (lk.get(p.id) === BENCH) {
            seen++
            if (seen > min + tol) {
              out.push(v(inst, this, `${ctx.playerName(p.id)} sits ${plural(n, ctx.period.singular)} while others sit only ${min}`, i, p.id))
            }
          }
        })
      } else if (n < max - tol) {
        // Flag the last inning this player was on the field.
        let last = -1
        ctx.lookup.forEach((lk, i) => {
          const s = lk.get(p.id)
          if (s && s !== BENCH) last = i
        })
        out.push(v(inst, this, `${ctx.playerName(p.id)} sits only ${plural(n, ctx.period.singular)} while others sit ${max}`, last >= 0 ? last : undefined, p.id))
      }
    }
    return out
  },
  solverCost(ctx) {
    const sits = [...sitCounts(ctx).values()]
    if (sits.length === 0) return 0
    const mean = sits.reduce((a, b) => a + b, 0) / sits.length
    return sits.reduce((acc, s) => acc + (s - mean) * (s - mean), 0) * 0.05
  },
}

function sitCounts(ctx: EvalContext): Map<PlayerId, number> {
  const sits = new Map<PlayerId, number>()
  for (const p of ctx.players) sits.set(p.id, 0)
  for (const lk of ctx.lookup) {
    for (const [pid, s] of lk) if (s === BENCH) sits.set(pid, (sits.get(pid) ?? 0) + 1)
  }
  return sits
}

const noConsecutiveBench: ConstraintDef = {
  type: 'no-consecutive-bench',
  name: 'No long bench streaks',
  description: 'No player sits more than a set number of innings in a row.',
  repeatable: false,
  addAtTop: false,
  defaultParams: () => ({ maxConsecutive: 1 }),
  evaluate(ctx, params, inst) {
    const max = Math.max(1, num(params, 'maxConsecutive', 1))
    const out: Violation[] = []
    for (const p of ctx.players) {
      let run = 0
      ctx.lookup.forEach((lk, i) => {
        if (lk.get(p.id) === BENCH) {
          run++
          if (run > max) out.push(v(inst, this, `${ctx.playerName(p.id)} sits ${plural(run, ctx.period.singular)} in a row (max ${max})`, i, p.id))
        } else {
          run = 0
        }
      })
    }
    return out
  },
}

const noConsecutiveSamePosition: ConstraintDef = {
  type: 'no-consecutive-same-position',
  name: 'No back-to-back same position',
  description: 'No player plays the same position in two consecutive innings.',
  repeatable: false,
  addAtTop: false,
  defaultParams: () => ({}),
  evaluate(ctx, _params, inst) {
    const out: Violation[] = []
    for (const p of ctx.players) {
      for (let i = 1; i < ctx.lookup.length; i++) {
        const a = ctx.lookup[i - 1].get(p.id)
        const b = ctx.lookup[i].get(p.id)
        if (a && a === b && a !== BENCH && !ctx.repeatExempt.has(a)) {
          const msg = `${ctx.playerName(p.id)} plays ${a} in ${ctx.period.plural} ${i} and ${i + 1}`
          out.push(v(inst, this, msg, i - 1, p.id), v(inst, this, msg, i, p.id))
        }
      }
    }
    return out
  },
}

const playGroupByInning: ConstraintDef = {
  type: 'play-group-by-inning',
  name: 'Everyone plays a position group early',
  description: 'Every player plays one of the chosen positions at least N times before a given point in the game.',
  repeatable: true,
  addAtTop: false,
  defaultParams: () => ({ positions: [...INFIELD_POSITIONS], times: 1, byInning: 4 }),
  evaluate(ctx, params, inst) {
    const { group, times, deadline } = groupParams(ctx, params)
    if (group.length === 0 || deadline <= 0 || ctx.innings.length < deadline) return []
    const out: Violation[] = []
    for (const p of ctx.players) {
      const n = groupCount(ctx, p.id, group, deadline)
      if (n < times) {
        const byText = deadline >= ctx.totalInnings ? 'by the end of the game' : `before ${ctx.period.singular} ${deadline + 1}`
        out.push(v(inst, this, `${ctx.playerName(p.id)} plays ${group.join('/')} only ${plural(n, 'time')} ${byText} (needs ${times})`, deadline - 1, p.id))
      }
    }
    return out
  },
  solverCost(ctx, params) {
    const { group, times, deadline } = groupParams(ctx, params)
    if (group.length === 0 || deadline <= 0 || ctx.innings.length >= deadline) return 0
    let needed = 0
    for (const p of ctx.players) needed += Math.max(0, times - groupCount(ctx, p.id, group, ctx.innings.length))
    const capacity = (deadline - ctx.innings.length) * group.length
    return Math.max(0, needed - capacity) + (capacity > 0 ? (needed / capacity) * 0.5 : 0)
  },
}

function groupParams(ctx: EvalContext, params: Record<string, unknown>) {
  const enabled = new Set(ctx.positions)
  const group = strList(params, 'positions').filter((p) => enabled.has(p))
  const times = Math.max(1, num(params, 'times', 1))
  // "before inning K" => innings 1..K-1 must be complete; clamp to the game length.
  const deadline = Math.min(Math.max(0, num(params, 'byInning', 4) - 1), ctx.totalInnings)
  return { group, times, deadline }
}

function groupCount(ctx: EvalContext, pid: PlayerId, group: PositionId[], upTo: number): number {
  let n = 0
  for (let i = 0; i < Math.min(upTo, ctx.lookup.length); i++) {
    const s = ctx.lookup[i].get(pid)
    if (s && s !== BENCH && group.includes(s)) n++
  }
  return n
}

const positionEligibility: ConstraintDef = {
  type: 'position-eligibility',
  name: 'Who can play a position',
  description: 'Only the checked players may play the chosen position.',
  repeatable: true,
  addAtTop: true,
  defaultParams: () => ({ position: 'C', playerIds: [], exemptFromRepeat: false }),
  evaluate(ctx, params, inst) {
    const pos = str(params, 'position')
    if (!ctx.positions.includes(pos)) return []
    const allowed = new Set(strList(params, 'playerIds'))
    const out: Violation[] = []
    ctx.innings.forEach((inn, i) => {
      const pid = inn.positions[pos]
      if (pid && !allowed.has(pid)) out.push(v(inst, this, `${ctx.playerName(pid)} is not eligible to play ${pos}`, i, pid))
    })
    return out
  },
}

const playerPositions: ConstraintDef = {
  type: 'player-positions',
  name: 'Positions a player can play',
  description: 'The chosen player may only play the checked positions.',
  repeatable: true,
  addAtTop: true,
  defaultParams: () => ({ playerId: '', positions: [] }),
  evaluate(ctx, params, inst) {
    const pid = str(params, 'playerId')
    if (!pid || !ctx.players.some((p) => p.id === pid)) return []
    const allowed = new Set(strList(params, 'positions'))
    const out: Violation[] = []
    ctx.lookup.forEach((lk, i) => {
      const s = lk.get(pid)
      if (s && s !== BENCH && !allowed.has(s)) out.push(v(inst, this, `${ctx.playerName(pid)} may not play ${s}`, i, pid))
    })
    return out
  },
}

export const CONSTRAINT_DEFS: ConstraintDef[] = [
  noRepeatPosition,
  equalSitting,
  noConsecutiveBench,
  noConsecutiveSamePosition,
  playGroupByInning,
  positionEligibility,
  playerPositions,
]

const defByType = new Map(CONSTRAINT_DEFS.map((d) => [d.type, d]))

export function constraintDef(type: ConstraintType): ConstraintDef {
  const d = defByType.get(type)
  if (!d) throw new Error(`Unknown constraint type: ${type}`)
  return d
}

/** Evaluate every enabled constraint against the given innings. */
export function evaluateAll(ctx: EvalContext, constraints: ConstraintInstance[]): Violation[] {
  ctx.repeatExempt = repeatExemptPositions(constraints)
  const out: Violation[] = []
  constraints.forEach((inst, index) => {
    if (!inst.enabled) return
    const def = defByType.get(inst.type)
    if (!def) return
    const rank = index + 1
    const weight = rankWeight(index, constraints.length)
    for (const violation of def.evaluate(ctx, inst.params, inst)) out.push({ ...violation, rank, weight })
  })
  return out
}

/** Total look-ahead cost of all enabled constraints (solver only). */
export function solverCostAll(ctx: EvalContext, constraints: ConstraintInstance[]): number {
  ctx.repeatExempt = repeatExemptPositions(constraints)
  let cost = 0
  for (const inst of constraints) {
    if (!inst.enabled) continue
    const def = defByType.get(inst.type)
    if (def?.solverCost) cost += def.solverCost(ctx, inst.params)
  }
  return cost
}

/** Order singletons are created in when missing: bench fairness first, then rotation rules. */
const DEFAULT_ORDER: ConstraintType[] = ['equal-sitting', 'no-consecutive-bench', 'no-repeat-position', 'no-consecutive-same-position']

/**
 * Ensure every non-repeatable constraint exists exactly once (disabled if newly
 * added) and that the list order is a sensible priority. Saved setups from
 * before priorities existed get their "who may play where" rules moved to the
 * top; setups that carried a numeric `priority` are sorted by it.
 */
export function normalizeConstraints(list: (ConstraintInstance & { priority?: unknown })[], migrateOrder = false): ConstraintInstance[] {
  const kept: { inst: ConstraintInstance; priority: number | null; addAtTop: boolean }[] = []
  const seenSingle = new Set<ConstraintType>()
  for (const inst of list) {
    const def = defByType.get(inst.type)
    if (!def) continue
    if (!def.repeatable) {
      if (seenSingle.has(inst.type)) continue
      seenSingle.add(inst.type)
    }
    const { priority, ...rest } = inst
    kept.push({
      inst: { ...rest, params: { ...def.defaultParams(), ...(inst.params ?? {}) } },
      priority: typeof priority === 'number' && Number.isFinite(priority) ? priority : null,
      addAtTop: def.addAtTop,
    })
  }
  let ordered = kept
  if (migrateOrder) {
    ordered = kept.some((k) => k.priority !== null)
      ? [...kept].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      : [...kept.filter((k) => k.addAtTop), ...kept.filter((k) => !k.addAtTop)]
  }
  const out = ordered.map((k) => k.inst)
  for (const type of DEFAULT_ORDER) {
    if (!seenSingle.has(type)) {
      const def = defByType.get(type)
      if (def) out.push({ id: `c_${def.type}`, type: def.type, enabled: false, params: def.defaultParams() })
    }
  }
  return out
}
