import type { AppState, ConstraintInstance, ConstraintType, Inning, Player, PlayerId, PositionId, Preference } from './lib/types'
import { constraintDef } from './lib/constraints'
import {
  clearFixed,
  moveInColumn,
  moveItem,
  swapAcrossInnings,
  normalizeBattingOrder,
  normalizePlan,
  shuffleBattingOrder,
  swapInColumn,
  swapItems,
  toggleFixed,
} from './lib/plan'
import { catalogFor, sortPositions, sportDef, type Sport } from './lib/positions'
import { newId } from './lib/rng'
import { solvePlan } from './lib/solver'
import { defaultState } from './lib/storage'

export type Action =
  | { type: 'set-title'; title: string }
  | { type: 'add-players'; names: string[] }
  | { type: 'rename-player'; id: PlayerId; name: string }
  | { type: 'toggle-player-active'; id: PlayerId }
  | { type: 'remove-player'; id: PlayerId }
  | { type: 'set-innings'; count: number }
  | { type: 'set-sport'; sport: Sport }
  | { type: 'set-period-name'; name: string; count?: number }
  | { type: 'set-positions'; positions: PositionId[] }
  | { type: 'toggle-position'; position: PositionId }
  | { type: 'toggle-constraint'; id: string }
  | { type: 'set-constraint-params'; id: string; params: Record<string, unknown> }
  | { type: 'move-constraint'; from: number; insertBefore: number }
  | { type: 'add-constraint'; constraintType: ConstraintType }
  | { type: 'remove-constraint'; id: string }
  | { type: 'add-preference' }
  | { type: 'set-preference'; id: string; patch: Partial<Omit<Preference, 'id'>> }
  | { type: 'remove-preference'; id: string }
  | { type: 'randomize-lineup' }
  | { type: 'shuffle-batting' }
  | { type: 'swap-cell'; inning: number; a: number; b: number }
  | { type: 'move-cell'; inning: number; from: number; insertBefore: number }
  | { type: 'swap-across'; fromInning: number; fromIndex: number; toInning: number; toIndex: number }
  | { type: 'swap-innings'; a: number; b: number }
  | { type: 'move-inning'; from: number; insertBefore: number }
  | { type: 'swap-batters'; a: number; b: number }
  | { type: 'move-batter'; from: number; insertBefore: number }
  | { type: 'toggle-fixed'; inning: number; playerId: PlayerId }
  | { type: 'clear-fixed' }
  | { type: 'toggle-batting-fixed'; playerId: PlayerId }
  | { type: 'clear-batting-fixed' }
  | { type: 'clear-plan' }
  | { type: 'import'; state: AppState }
  | { type: 'reset' }

function catalogHas(sport: Sport, position: PositionId): boolean {
  return catalogFor(sport).some((p) => p.id === position)
}

function withRoster(state: AppState, players: Player[]): AppState {
  const next = { ...state, players }
  next.plan = normalizePlan(next)
  next.battingOrder = normalizeBattingOrder(players, state.battingOrder)
  next.battingFixed = state.battingFixed.filter((pid) => next.battingOrder.includes(pid))
  return next
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'set-title':
      return { ...state, gameTitle: action.title }
    case 'add-players': {
      const added = action.names.map((n) => n.trim()).filter(Boolean).map((name) => ({ id: newId('p'), name, active: true }))
      if (added.length === 0) return state
      return withRoster(state, [...state.players, ...added])
    }
    case 'rename-player':
      return { ...state, players: state.players.map((p) => (p.id === action.id ? { ...p, name: action.name } : p)) }
    case 'toggle-player-active':
      return withRoster(
        state,
        state.players.map((p) => (p.id === action.id ? { ...p, active: !p.active } : p)),
      )
    case 'remove-player': {
      const next = withRoster(state, state.players.filter((p) => p.id !== action.id))
      next.constraints = next.constraints.map((c) => {
        const params = { ...c.params }
        if (Array.isArray(params.playerIds)) params.playerIds = params.playerIds.filter((x) => x !== action.id)
        if (params.playerId === action.id) params.playerId = ''
        return { ...c, params }
      })
      next.preferences = next.preferences.map((p) => (p.playerId === action.id ? { ...p, playerId: '' } : p))
      return next
    }
    case 'set-innings': {
      const count = Math.min(20, Math.max(1, Math.floor(action.count) || 1))
      const next = { ...state, inningCount: count }
      next.plan = normalizePlan(next)
      return next
    }
    case 'set-sport': {
      if (action.sport === state.sport) return state
      const def = sportDef(action.sport)
      const next: AppState = {
        ...state,
        sport: action.sport,
        periodName: def.defaultPeriodName,
        inningCount: def.defaultPeriodCount,
        positions: [...def.defaultPositions],
        // Position lists from the other sport no longer apply.
        preferences: state.preferences.map((p) => ({ ...p, positions: p.positions.filter((pos) => catalogHas(action.sport, pos)) })),
        constraints: state.constraints.map((c) => {
          const params = { ...c.params }
          if (Array.isArray(params.positions)) {
            const kept = params.positions.filter((pos) => typeof pos === 'string' && catalogHas(action.sport, pos))
            params.positions = kept.length === 0 && c.type === 'play-group-by-inning' ? [...def.defaultGroup] : kept
          }
          if (typeof params.position === 'string' && !catalogHas(action.sport, params.position)) params.position = def.defaultPositions[0]
          return { ...c, params }
        }),
      }
      next.plan = normalizePlan(next)
      return next
    }
    case 'set-period-name': {
      const next = { ...state, periodName: action.name }
      if (action.count) {
        next.inningCount = Math.min(20, Math.max(1, action.count))
        next.plan = normalizePlan(next)
      }
      return next
    }
    case 'set-positions': {
      const positions = sortPositions(action.positions.filter((p, i, arr) => arr.indexOf(p) === i && catalogHas(state.sport, p)))
      if (positions.length === 0) return state
      const next = { ...state, positions }
      next.plan = normalizePlan(next)
      return next
    }
    case 'toggle-position': {
      const has = state.positions.includes(action.position)
      const positions = has ? state.positions.filter((p) => p !== action.position) : sortPositions([...state.positions, action.position])
      if (positions.length === 0) return state
      const next = { ...state, positions }
      next.plan = normalizePlan(next)
      return next
    }
    case 'toggle-constraint':
      return { ...state, constraints: state.constraints.map((c) => (c.id === action.id ? { ...c, enabled: !c.enabled } : c)) }
    case 'set-constraint-params':
      return {
        ...state,
        constraints: state.constraints.map((c) => (c.id === action.id ? { ...c, params: { ...c.params, ...action.params } } : c)),
      }
    case 'move-constraint':
      return { ...state, constraints: moveItem(state.constraints, action.from, action.insertBefore) }
    case 'add-constraint': {
      const def = constraintDef(action.constraintType)
      const params = def.defaultParams()
      if (def.type === 'play-group-by-inning') params.positions = [...sportDef(state.sport).defaultGroup]
      if (def.type === 'position-eligibility') params.position = state.positions[0] ?? ''
      const inst: ConstraintInstance = { id: newId('c'), type: def.type, enabled: true, params }
      return { ...state, constraints: def.addAtTop ? [inst, ...state.constraints] : [...state.constraints, inst] }
    }
    case 'remove-constraint':
      return { ...state, constraints: state.constraints.filter((c) => c.id !== action.id) }
    case 'add-preference':
      return { ...state, preferences: [...state.preferences, { id: newId('pref'), enabled: true, playerId: '', positions: [] }] }
    case 'set-preference':
      return { ...state, preferences: state.preferences.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) }
    case 'remove-preference':
      return { ...state, preferences: state.preferences.filter((p) => p.id !== action.id) }
    case 'randomize-lineup':
      // Locked players stay where they are; everyone else is re-solved from inning 1.
      return { ...state, plan: solvePlan(state, { keepFixed: true }) }
    case 'shuffle-batting':
      return { ...state, battingOrder: shuffleBattingOrder(state.battingOrder, state.battingFixed) }
    case 'swap-cell':
      return { ...state, plan: swapInColumn(state, action.inning, action.a, action.b) }
    case 'move-cell':
      return { ...state, plan: moveInColumn(state, action.inning, action.from, action.insertBefore) }
    case 'swap-across':
      return { ...state, plan: swapAcrossInnings(state, action.fromInning, action.fromIndex, action.toInning, action.toIndex) }
    case 'swap-innings':
      return { ...state, plan: swapItems<Inning>(state.plan, action.a, action.b) }
    case 'move-inning':
      return { ...state, plan: moveItem<Inning>(state.plan, action.from, action.insertBefore) }
    case 'swap-batters':
      return { ...state, battingOrder: swapItems(state.battingOrder, action.a, action.b) }
    case 'move-batter':
      return { ...state, battingOrder: moveItem(state.battingOrder, action.from, action.insertBefore) }
    case 'toggle-fixed':
      return { ...state, plan: toggleFixed(state.plan, action.inning, action.playerId) }
    case 'clear-fixed':
      return { ...state, plan: clearFixed(state.plan) }
    case 'toggle-batting-fixed':
      return {
        ...state,
        battingFixed: state.battingFixed.includes(action.playerId)
          ? state.battingFixed.filter((p) => p !== action.playerId)
          : [...state.battingFixed, action.playerId],
      }
    case 'clear-batting-fixed':
      return { ...state, battingFixed: [] }
    case 'clear-plan': {
      const next = { ...state, plan: [] as Inning[] }
      next.plan = normalizePlan(next)
      return next
    }
    case 'import':
      return action.state
    case 'reset':
      return defaultState()
    default:
      return state
  }
}
