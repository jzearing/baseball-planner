import type { AppState, Inning, Player, PlayerId, PositionId, Slot } from './types'
import { BENCH } from './types'

export function emptyInning(positions: PositionId[], players: Player[]): Inning {
  const pos: Record<PositionId, PlayerId | null> = {}
  for (const p of positions) pos[p] = null
  return { positions: pos, bench: players.map((p) => p.id), fixed: [] }
}

/** Number of bench rows shown under the positions. */
export function benchRowCount(state: Pick<AppState, 'players' | 'positions'>): number {
  return Math.max(0, state.players.length - state.positions.length)
}

/** Where a player is in an inning: a position id, BENCH, or undefined if absent. */
export function slotOf(inning: Inning, playerId: PlayerId): Slot | undefined {
  for (const [pos, pid] of Object.entries(inning.positions)) if (pid === playerId) return pos
  if (inning.bench.includes(playerId)) return BENCH
  return undefined
}

/** Map of player -> slot for one inning. */
export function slotLookup(inning: Inning): Map<PlayerId, Slot> {
  const m = new Map<PlayerId, Slot>()
  for (const [pos, pid] of Object.entries(inning.positions)) if (pid) m.set(pid, pos)
  for (const pid of inning.bench) if (!m.has(pid)) m.set(pid, BENCH)
  return m
}

/**
 * Make one inning consistent with the roster/positions: only enabled positions,
 * every roster player exactly once (position or bench), no unknown players.
 */
export function normalizeInning(inning: Inning | undefined, positions: PositionId[], players: Player[]): Inning {
  const known = new Set(players.map((p) => p.id))
  const seen = new Set<PlayerId>()
  const pos: Record<PositionId, PlayerId | null> = {}
  for (const p of positions) {
    const pid = inning?.positions[p] ?? null
    if (pid && known.has(pid) && !seen.has(pid)) {
      pos[p] = pid
      seen.add(pid)
    } else {
      pos[p] = null
    }
  }
  const bench: PlayerId[] = []
  for (const pid of inning?.bench ?? []) {
    if (known.has(pid) && !seen.has(pid)) {
      bench.push(pid)
      seen.add(pid)
    }
  }
  // Players from positions that are no longer enabled, or brand-new players, go to the bench.
  for (const p of players) if (!seen.has(p.id)) bench.push(p.id)
  const fixed = (inning?.fixed ?? []).filter((pid) => known.has(pid))
  return { positions: pos, bench, fixed }
}

export function normalizePlan(state: AppState): Inning[] {
  const out: Inning[] = []
  for (let i = 0; i < state.inningCount; i++) {
    out.push(normalizeInning(state.plan[i], state.positions, state.players))
  }
  return out
}

export function normalizeBattingOrder(players: Player[], order: PlayerId[]): PlayerId[] {
  const known = new Set(players.map((p) => p.id))
  const out: PlayerId[] = []
  for (const pid of order) if (known.has(pid) && !out.includes(pid)) out.push(pid)
  for (const p of players) if (!out.includes(p.id)) out.push(p.id)
  return out
}

/** The players of one inning as a vertical list: positions in order, then bench rows. */
export function columnList(inning: Inning, positions: PositionId[], benchRows: number): (PlayerId | null)[] {
  const list: (PlayerId | null)[] = positions.map((p) => inning.positions[p] ?? null)
  for (let i = 0; i < benchRows; i++) list.push(inning.bench[i] ?? null)
  return list
}

export function writeColumn(inning: Inning, positions: PositionId[], list: (PlayerId | null)[]): Inning {
  const pos: Record<PositionId, PlayerId | null> = {}
  positions.forEach((p, i) => {
    pos[p] = list[i] ?? null
  })
  const bench = list.slice(positions.length).filter((x): x is PlayerId => x !== null)
  return { positions: pos, bench, fixed: inning.fixed }
}

export function swapItems<T>(list: T[], a: number, b: number): T[] {
  const out = [...list]
  ;[out[a], out[b]] = [out[b], out[a]]
  return out
}

/**
 * Remove item at `from` and insert it so that it lands at index `insertBefore`
 * of the original list (i.e. before the item currently at that index).
 */
export function moveItem<T>(list: T[], from: number, insertBefore: number): T[] {
  const out = [...list]
  const [item] = out.splice(from, 1)
  const target = from < insertBefore ? insertBefore - 1 : insertBefore
  out.splice(target, 0, item)
  return out
}

export function swapInColumn(state: AppState, inningIdx: number, a: number, b: number): Inning[] {
  const rows = benchRowCount(state)
  return state.plan.map((inn, i) => {
    if (i !== inningIdx) return inn
    return writeColumn(inn, state.positions, swapItems(columnList(inn, state.positions, rows), a, b))
  })
}

export function moveInColumn(state: AppState, inningIdx: number, from: number, insertBefore: number): Inning[] {
  const rows = benchRowCount(state)
  return state.plan.map((inn, i) => {
    if (i !== inningIdx) return inn
    return writeColumn(inn, state.positions, moveItem(columnList(inn, state.positions, rows), from, insertBefore))
  })
}

export function toggleFixed(plan: Inning[], inningIdx: number, playerId: PlayerId): Inning[] {
  return plan.map((inn, i) => {
    if (i !== inningIdx) return inn
    const fixed = inn.fixed.includes(playerId) ? inn.fixed.filter((p) => p !== playerId) : [...inn.fixed, playerId]
    return { ...inn, fixed }
  })
}

export function clearFixed(plan: Inning[]): Inning[] {
  return plan.map((inn) => ({ ...inn, fixed: [] }))
}

/** Human-readable label for a slot. */
export function slotLabel(slot: Slot | undefined): string {
  if (slot === undefined) return '—'
  if (slot === BENCH) return 'Bench'
  return slot
}
