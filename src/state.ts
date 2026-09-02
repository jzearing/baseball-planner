import type { AppState, ConstraintInstance, ConstraintType, Inning, Player, PlayerId, PositionId } from './lib/types'
import { constraintDef } from './lib/constraints'
import {
  clearFixed,
  moveInColumn,
  moveItem,
  normalizeBattingOrder,
  normalizePlan,
  swapInColumn,
  swapItems,
  toggleFixed,
} from './lib/plan'
import { sortPositions } from './lib/positions'
import { newId, shuffle } from './lib/rng'
import { solvePlan } from './lib/solver'
import { defaultState } from './lib/storage'

export type Action =
  | { type: 'set-title'; title: string }
  | { type: 'add-players'; names: string[] }
  | { type: 'rename-player'; id: PlayerId; name: string }
  | { type: 'toggle-player-active'; id: PlayerId }
  | { type: 'remove-player'; id: PlayerId }
  | { type: 'set-innings'; count: number }
  | { type: 'toggle-position'; position: PositionId }
  | { type: 'toggle-constraint'; id: string }
  | { type: 'set-constraint-params'; id: string; params: Record<string, unknown> }
  | { type: 'add-constraint'; constraintType: ConstraintType }
  | { type: 'remove-constraint'; id: string }
  | { type: 'randomize-lineup' }
  | { type: 'resolve-keep-fixed' }
  | { type: 'shuffle-batting' }
  | { type: 'swap-cell'; inning: number; a: number; b: number }
  | { type: 'move-cell'; inning: number; from: number; insertBefore: number }
  | { type: 'swap-innings'; a: number; b: number }
  | { type: 'move-inning'; from: number; insertBefore: number }
  | { type: 'swap-batters'; a: number; b: number }
  | { type: 'move-batter'; from: number; insertBefore: number }
  | { type: 'toggle-fixed'; inning: number; playerId: PlayerId }
  | { type: 'clear-fixed' }
  | { type: 'clear-plan' }
  | { type: 'import'; state: AppState }
  | { type: 'reset' }

function withRoster(state: AppState, players: Player[]): AppState {
  const next = { ...state, players }
  next.plan = normalizePlan(next)
  next.battingOrder = normalizeBattingOrder(players, state.battingOrder)
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
      return next
    }
    case 'set-innings': {
      const count = Math.min(20, Math.max(1, Math.floor(action.count) || 1))
      const next = { ...state, inningCount: count }
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
    case 'add-constraint': {
      const def = constraintDef(action.constraintType)
      const inst: ConstraintInstance = { id: newId('c'), type: def.type, enabled: true, params: def.defaultParams() }
      return { ...state, constraints: [...state.constraints, inst] }
    }
    case 'remove-constraint':
      return { ...state, constraints: state.constraints.filter((c) => c.id !== action.id) }
    case 'randomize-lineup': {
      const cleared = { ...state, plan: clearFixed(state.plan) }
      return { ...cleared, plan: solvePlan(cleared, { keepFixed: false }) }
    }
    case 'resolve-keep-fixed':
      return { ...state, plan: solvePlan(state, { keepFixed: true }) }
    case 'shuffle-batting':
      return { ...state, battingOrder: shuffle(state.battingOrder) }
    case 'swap-cell':
      return { ...state, plan: swapInColumn(state, action.inning, action.a, action.b) }
    case 'move-cell':
      return { ...state, plan: moveInColumn(state, action.inning, action.from, action.insertBefore) }
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
