import type { PositionId } from './types'

export type Sport = 'baseball' | 'soccer'

export type PositionGroup = 'battery' | 'infield' | 'outfield' | 'goalkeeper' | 'defense' | 'midfield' | 'forward'

export interface PositionDef {
  id: PositionId
  label: string
  group: PositionGroup
  sport: Sport
}

/** Every position of every sport. Ids are unique across sports. */
export const POSITION_CATALOG: PositionDef[] = [
  { id: 'C', label: 'Catcher', group: 'battery', sport: 'baseball' },
  { id: 'P', label: 'Pitcher', group: 'battery', sport: 'baseball' },
  { id: '1B', label: 'First base', group: 'infield', sport: 'baseball' },
  { id: '2B', label: 'Second base', group: 'infield', sport: 'baseball' },
  { id: 'SS', label: 'Shortstop', group: 'infield', sport: 'baseball' },
  { id: '3B', label: 'Third base', group: 'infield', sport: 'baseball' },
  { id: 'LF', label: 'Left field', group: 'outfield', sport: 'baseball' },
  { id: 'LCF', label: 'Left-center field', group: 'outfield', sport: 'baseball' },
  { id: 'CF', label: 'Center field', group: 'outfield', sport: 'baseball' },
  { id: 'RCF', label: 'Right-center field', group: 'outfield', sport: 'baseball' },
  { id: 'RF', label: 'Right field', group: 'outfield', sport: 'baseball' },

  { id: 'GK', label: 'Goalkeeper', group: 'goalkeeper', sport: 'soccer' },
  { id: 'LB', label: 'Left back', group: 'defense', sport: 'soccer' },
  { id: 'LCB', label: 'Left center back', group: 'defense', sport: 'soccer' },
  { id: 'CB', label: 'Center back', group: 'defense', sport: 'soccer' },
  { id: 'RCB', label: 'Right center back', group: 'defense', sport: 'soccer' },
  { id: 'RB', label: 'Right back', group: 'defense', sport: 'soccer' },
  { id: 'DM', label: 'Defensive mid', group: 'midfield', sport: 'soccer' },
  { id: 'LM', label: 'Left mid', group: 'midfield', sport: 'soccer' },
  { id: 'LCM', label: 'Left center mid', group: 'midfield', sport: 'soccer' },
  { id: 'CM', label: 'Center mid', group: 'midfield', sport: 'soccer' },
  { id: 'RCM', label: 'Right center mid', group: 'midfield', sport: 'soccer' },
  { id: 'RM', label: 'Right mid', group: 'midfield', sport: 'soccer' },
  { id: 'AM', label: 'Attacking mid', group: 'midfield', sport: 'soccer' },
  { id: 'LW', label: 'Left wing', group: 'forward', sport: 'soccer' },
  { id: 'ST', label: 'Striker', group: 'forward', sport: 'soccer' },
  { id: 'LS', label: 'Left striker', group: 'forward', sport: 'soccer' },
  { id: 'RS', label: 'Right striker', group: 'forward', sport: 'soccer' },
  { id: 'RW', label: 'Right wing', group: 'forward', sport: 'soccer' },
]

export interface Formation {
  label: string
  positions: PositionId[]
}

export interface SportDef {
  id: Sport
  name: string
  icon: string
  /** Name of one game segment, capitalised, e.g. "Inning" or "Quarter". */
  defaultPeriodName: string
  /** Period names the user may pick from (baseball only has innings). */
  periodChoices: { name: string; count: number }[]
  defaultPeriodCount: number
  defaultPositions: PositionId[]
  /** Positions the "everyone plays a group" rule targets by default. */
  defaultGroup: PositionId[]
  formations: Formation[]
  hasBattingOrder: boolean
  /** Extra solver cost for leaving this position empty on a short roster. */
  emptyPenalty: (id: PositionId) => number
}

export const SPORTS: Record<Sport, SportDef> = {
  baseball: {
    id: 'baseball',
    name: 'Baseball',
    icon: '⚾',
    defaultPeriodName: 'Inning',
    periodChoices: [{ name: 'Inning', count: 6 }],
    defaultPeriodCount: 6,
    defaultPositions: ['C', 'P', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'],
    defaultGroup: ['C', 'P', '1B', '2B', 'SS', '3B'],
    formations: [
      { label: '9 fielders', positions: ['C', 'P', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'] },
      { label: '10 fielders (4 OF)', positions: ['C', 'P', '1B', '2B', 'SS', '3B', 'LF', 'LCF', 'RCF', 'RF'] },
    ],
    hasBattingOrder: true,
    emptyPenalty: (id) => (positionDef(id).group === 'outfield' ? 0 : 0.2),
  },
  soccer: {
    id: 'soccer',
    name: 'Soccer',
    icon: '⚽',
    defaultPeriodName: 'Quarter',
    periodChoices: [
      { name: 'Half', count: 2 },
      { name: 'Third', count: 3 },
      { name: 'Quarter', count: 4 },
      { name: 'Period', count: 4 },
    ],
    defaultPeriodCount: 4,
    defaultPositions: ['GK', 'LB', 'RB', 'LM', 'CM', 'RM', 'ST'],
    defaultGroup: ['LM', 'LCM', 'CM', 'RCM', 'RM', 'DM', 'AM', 'LW', 'ST', 'LS', 'RS', 'RW'],
    formations: [
      { label: '7v7 · 2-3-1', positions: ['GK', 'LB', 'RB', 'LM', 'CM', 'RM', 'ST'] },
      { label: '7v7 · 3-2-1', positions: ['GK', 'LB', 'CB', 'RB', 'LM', 'RM', 'ST'] },
      { label: '9v9 · 3-3-2', positions: ['GK', 'LB', 'CB', 'RB', 'LM', 'CM', 'RM', 'LS', 'RS'] },
      { label: '9v9 · 3-2-3', positions: ['GK', 'LB', 'CB', 'RB', 'LCM', 'RCM', 'LW', 'ST', 'RW'] },
      { label: '11v11 · 4-3-3', positions: ['GK', 'LB', 'LCB', 'RCB', 'RB', 'LCM', 'CM', 'RCM', 'LW', 'ST', 'RW'] },
      { label: '11v11 · 4-4-2', positions: ['GK', 'LB', 'LCB', 'RCB', 'RB', 'LM', 'LCM', 'RCM', 'RM', 'LS', 'RS'] },
    ],
    hasBattingOrder: false,
    emptyPenalty: (id) => (id === 'GK' ? 1 : 0.2),
  },
}

export function sportDef(sport: Sport): SportDef {
  return SPORTS[sport] ?? SPORTS.baseball
}

export function catalogFor(sport: Sport): PositionDef[] {
  return POSITION_CATALOG.filter((p) => p.sport === sport)
}

const byId = new Map(POSITION_CATALOG.map((p) => [p.id, p]))

export function positionDef(id: PositionId): PositionDef {
  return byId.get(id) ?? { id, label: id, group: 'outfield', sport: 'baseball' }
}

export function positionLabel(id: PositionId): string {
  return positionDef(id).label
}

/** Sort a list of position ids into catalog order. */
export function sortPositions(ids: PositionId[]): PositionId[] {
  const order = new Map(POSITION_CATALOG.map((p, i) => [p.id, i]))
  return [...ids].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
}

/** Kept for existing callers and tests: the baseball infield group. */
export const INFIELD_POSITIONS: PositionId[] = SPORTS.baseball.defaultGroup
export const DEFAULT_POSITIONS: PositionId[] = SPORTS.baseball.defaultPositions

// ---------- game periods ----------

export interface PeriodNoun {
  /** e.g. "inning" */
  singular: string
  /** e.g. "innings" */
  plural: string
  /** e.g. "Inning" */
  title: string
}

const PLURALS: Record<string, string> = { Half: 'halves' }

export function periodNoun(periodName: string | undefined): PeriodNoun {
  const title = periodName && periodName.trim() ? periodName.trim() : 'Inning'
  const singular = title.toLowerCase()
  const plural = PLURALS[title] ?? `${singular}s`
  return { singular, plural, title }
}

export function periodTitle(periodName: string | undefined, index: number): string {
  return `${periodNoun(periodName).title} ${index + 1}`
}
