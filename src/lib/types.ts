export type PlayerId = string
export type PositionId = string

export interface Player {
  id: PlayerId
  name: string
  /** False when the player is absent for this game: kept on the roster but left out of the plan. */
  active: boolean
}

/** One inning of the fielding plan. */
export interface Inning {
  /** Enabled position id -> player in that position (or null if nobody). */
  positions: Record<PositionId, PlayerId | null>
  /** Players sitting this inning, in bench-row order. */
  bench: PlayerId[]
  /** Players whose slot in this inning must not be changed by the solver. */
  fixed: PlayerId[]
}

export type ConstraintType =
  | 'no-repeat-position'
  | 'equal-sitting'
  | 'no-consecutive-bench'
  | 'no-consecutive-same-position'
  | 'play-group-by-inning'
  | 'position-eligibility'
  | 'player-positions'

/**
 * A rule instance. The order of the constraints array is the priority: the
 * first rule outranks any number of violations of the rules below it.
 */
export interface ConstraintInstance {
  id: string
  type: ConstraintType
  enabled: boolean
  params: Record<string, unknown>
}

/** A soft wish the solver tries to honour; never flagged as a violation. */
export interface Preference {
  id: string
  enabled: boolean
  playerId: PlayerId
  positions: PositionId[]
}

export type SportId = 'baseball' | 'soccer'

export interface AppState {
  /** 2 = constraints array order is the priority (older saves are migrated once). */
  version: 2
  sport: SportId
  /** Capitalised name of one game segment: "Inning", "Half", "Quarter"… */
  periodName: string
  gameTitle: string
  players: Player[]
  inningCount: number
  /** Enabled positions in display order. */
  positions: PositionId[]
  constraints: ConstraintInstance[]
  preferences: Preference[]
  plan: Inning[]
  battingOrder: PlayerId[]
  /** Batters whose spot in the order Shuffle must not move. */
  battingFixed: PlayerId[]
}

export interface Violation {
  constraintId: string
  constraintName: string
  /** 1 = the top (highest-priority) rule in the list. */
  rank: number
  /** Solver cost of this violation, derived from the rank. */
  weight: number
  message: string
  /** Zero-based inning index the violation is attached to, if any. */
  inning?: number
  playerId?: PlayerId
}

export const BENCH = 'BENCH' as const
export type Slot = PositionId | typeof BENCH
