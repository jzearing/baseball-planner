import type { AppState, ConstraintInstance, Inning, Player } from './types'
import { normalizeConstraints } from './constraints'
import { normalizeBattingOrder, normalizePlan } from './plan'
import { DEFAULT_POSITIONS, INFIELD_POSITIONS, POSITION_CATALOG, sortPositions } from './positions'

export const STORAGE_KEY = 'little-league-planner:v1'
export const TUTORIAL_KEY = 'little-league-planner:tutorial-seen'

export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1'
  } catch {
    return true
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1')
  } catch {
    // Storage unavailable; the tutorial will simply show again next time.
  }
}

export function defaultState(): AppState {
  const base: AppState = {
    version: 1,
    gameTitle: '',
    players: [],
    inningCount: 6,
    positions: [...DEFAULT_POSITIONS],
    constraints: [],
    preferences: [],
    plan: [],
    battingOrder: [],
  }
  base.constraints = normalizeConstraints([]).map((c) =>
    c.type === 'no-repeat-position' || c.type === 'equal-sitting' || c.type === 'no-consecutive-bench' ? { ...c, enabled: true } : c,
  )
  base.constraints.push({
    id: 'c_infield_default',
    type: 'play-group-by-inning',
    enabled: false,
    params: { positions: [...INFIELD_POSITIONS], times: 1, byInning: 4 },
  })
  base.plan = normalizePlan(base)
  return base
}

/** Bring any shape of persisted/imported data into a valid AppState. */
export function coerceState(raw: unknown): AppState {
  const d = defaultState()
  if (!raw || typeof raw !== 'object') return d
  const r = raw as Record<string, unknown>
  const valid = new Set(POSITION_CATALOG.map((p) => p.id))

  const players: Player[] = Array.isArray(r.players)
    ? r.players
        .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
        .map((p, i) => ({
          id: typeof p.id === 'string' ? p.id : `p_${i}`,
          name: typeof p.name === 'string' ? p.name : '',
          active: p.active !== false,
        }))
        .filter((p, i, arr) => arr.findIndex((q) => q.id === p.id) === i)
    : []

  const inningCount = typeof r.inningCount === 'number' && r.inningCount >= 1 && r.inningCount <= 20 ? Math.floor(r.inningCount) : d.inningCount
  const positions = Array.isArray(r.positions)
    ? sortPositions(r.positions.filter((p): p is string => typeof p === 'string' && valid.has(p)))
    : d.positions
  const constraints = normalizeConstraints(
    Array.isArray(r.constraints)
      ? r.constraints
          .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object' && typeof c.type === 'string')
          .map(
            (c, i): ConstraintInstance => ({
              id: typeof c.id === 'string' ? c.id : `c_${i}`,
              type: c.type as ConstraintInstance['type'],
              enabled: c.enabled === true,
              params: c.params && typeof c.params === 'object' ? (c.params as Record<string, unknown>) : {},
            }),
          )
      : d.constraints,
  )
  const plan = Array.isArray(r.plan)
    ? r.plan.map(
        (inn): Inning => {
          const o = (inn && typeof inn === 'object' ? inn : {}) as Record<string, unknown>
          const pos = o.positions && typeof o.positions === 'object' ? (o.positions as Record<string, unknown>) : {}
          const positionsClean: Record<string, string | null> = {}
          for (const [k, val] of Object.entries(pos)) positionsClean[k] = typeof val === 'string' ? val : null
          return {
            positions: positionsClean,
            bench: Array.isArray(o.bench) ? o.bench.filter((x): x is string => typeof x === 'string') : [],
            fixed: Array.isArray(o.fixed) ? o.fixed.filter((x): x is string => typeof x === 'string') : [],
          }
        },
      )
    : []

  const preferences = Array.isArray(r.preferences)
    ? r.preferences
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x, i) => ({
          id: typeof x.id === 'string' ? x.id : `pref_${i}`,
          enabled: x.enabled !== false,
          playerId: typeof x.playerId === 'string' ? x.playerId : '',
          positions: Array.isArray(x.positions) ? x.positions.filter((v): v is string => typeof v === 'string' && valid.has(v)) : [],
        }))
    : []

  const state: AppState = {
    version: 1,
    gameTitle: typeof r.gameTitle === 'string' ? r.gameTitle : '',
    players,
    inningCount,
    positions: positions.length > 0 ? positions : d.positions,
    constraints,
    preferences,
    plan,
    battingOrder: Array.isArray(r.battingOrder) ? r.battingOrder.filter((x): x is string => typeof x === 'string') : [],
  }
  state.plan = normalizePlan(state)
  state.battingOrder = normalizeBattingOrder(state.players, state.battingOrder)
  return state
}

export function loadState(): AppState | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    if (!text) return null
    return coerceState(JSON.parse(text))
  } catch {
    return null
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage may be unavailable (private mode, quota); the app still works in memory.
  }
}

export function exportJson(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

export function parseImport(text: string): AppState {
  const raw: unknown = JSON.parse(text)
  if (!raw || typeof raw !== 'object') throw new Error('File does not contain a planner configuration.')
  return coerceState(raw)
}

export function downloadText(filename: string, content: string | Blob, mime: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
