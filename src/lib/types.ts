export type PlayerId = string
export type PositionId = string

export interface Player {
  id: PlayerId
  name: string
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

export interface ConstraintInstance {
  id: string
  type: ConstraintType
  enabled: boolean
  params: Record<string, unknown>
}

export interface AppState {
  version: 1
  gameTitle: string
  players: Player[]
  inningCount: number
  /** Enabled positions in display order. */
  positions: PositionId[]
  constraints: ConstraintInstance[]
  plan: Inning[]
  battingOrder: PlayerId[]
}

export interface Violation {
  constraintId: string
  constraintName: string
  message: string
  /** Zero-based inning index the violation is attached to, if any. */
  inning?: number
  playerId?: PlayerId
}

export const BENCH = 'BENCH' as const
export type Slot = PositionId | typeof BENCH
