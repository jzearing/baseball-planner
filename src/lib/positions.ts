import type { PositionId } from './types'

export type PositionGroup = 'battery' | 'infield' | 'outfield'

export interface PositionDef {
  id: PositionId
  label: string
  group: PositionGroup
}

export const POSITION_CATALOG: PositionDef[] = [
  { id: 'C', label: 'Catcher', group: 'battery' },
  { id: 'P', label: 'Pitcher', group: 'battery' },
  { id: '1B', label: 'First base', group: 'infield' },
  { id: '2B', label: 'Second base', group: 'infield' },
  { id: 'SS', label: 'Shortstop', group: 'infield' },
  { id: '3B', label: 'Third base', group: 'infield' },
  { id: 'LF', label: 'Left field', group: 'outfield' },
  { id: 'LCF', label: 'Left-center field', group: 'outfield' },
  { id: 'CF', label: 'Center field', group: 'outfield' },
  { id: 'RCF', label: 'Right-center field', group: 'outfield' },
  { id: 'RF', label: 'Right field', group: 'outfield' },
]

export const DEFAULT_POSITIONS: PositionId[] = ['C', 'P', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF']

/** Positions that count as "infield" for the play-group constraint default. */
export const INFIELD_POSITIONS: PositionId[] = ['C', 'P', '1B', '2B', 'SS', '3B']
export const OUTFIELD_POSITIONS: PositionId[] = ['LF', 'LCF', 'CF', 'RCF', 'RF']

const byId = new Map(POSITION_CATALOG.map((p) => [p.id, p]))

export function positionDef(id: PositionId): PositionDef {
  return byId.get(id) ?? { id, label: id, group: 'outfield' }
}

export function positionLabel(id: PositionId): string {
  return positionDef(id).label
}

/** Sort a list of position ids into catalog order. */
export function sortPositions(ids: PositionId[]): PositionId[] {
  const order = new Map(POSITION_CATALOG.map((p, i) => [p.id, i]))
  return [...ids].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
}
