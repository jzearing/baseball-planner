import type { AppState, GameState, Half, HomeAway, PlayerId } from './types'
import { sportDef } from './positions'

export function emptyGame(periodCount: number): GameState {
  return { period: 0, half: 'top', us: zeros(periodCount), them: zeros(periodCount), atBat: 0 }
}

function zeros(n: number): number[] {
  return Array.from({ length: Math.max(0, n) }, () => 0)
}

function sameNumbers(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/** Trim or pad the per-period scores to the game length and clamp the cursors. */
export function normalizeGame(game: GameState, periodCount: number, battingCount: number): GameState {
  const fit = (list: number[]) =>
    Array.from({ length: Math.max(0, periodCount) }, (_, i) => {
      const v = list[i]
      return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
    })
  const us = fit(game.us)
  const them = fit(game.them)
  const period = clamp(game.period, 0, Math.max(0, periodCount - 1))
  // An empty order parks the cursor at 0; otherwise it must point at a real batter.
  const atBat = battingCount === 0 ? 0 : clamp(game.atBat, 0, battingCount - 1)
  const half: Half = game.half === 'bottom' ? 'bottom' : 'top'
  if (period === game.period && half === game.half && atBat === game.atBat && sameNumbers(us, game.us) && sameNumbers(them, game.them)) {
    return game
  }
  return { period, half, us, them, atBat }
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  return Math.min(hi, Math.max(lo, Math.floor(n)))
}

/** True when our team is the one batting right now. Soccer has no batting half. */
export function weAreBatting(homeAway: HomeAway, half: Half): boolean {
  return homeAway === 'home' ? half === 'bottom' : half === 'top'
}

/**
 * Step the game on by one half-inning (baseball) or one period (soccer) — what a
 * swipe does. Baseball runs top -> bottom -> next top; both stop at the ends.
 */
export function stepGame(game: GameState, periodCount: number, hasHalves: boolean, delta: 1 | -1): GameState {
  const last = Math.max(0, periodCount - 1)
  if (!hasHalves) {
    const period = clamp(game.period + delta, 0, last)
    return period === game.period ? game : { ...game, period }
  }
  // Count half-innings from the top of the first, then split back apart.
  const total = game.period * 2 + (game.half === 'bottom' ? 1 : 0) + delta
  const capped = clamp(total, 0, last * 2 + 1)
  const period = Math.floor(capped / 2)
  const half: Half = capped % 2 === 1 ? 'bottom' : 'top'
  return period === game.period && half === game.half ? game : { ...game, period, half }
}

/**
 * Jump straight to a period, and for baseball to one half of it — what tapping a
 * box on the scoreboard does, since each row there is one team's half.
 */
export function goToPeriod(game: GameState, periodCount: number, hasHalves: boolean, period: number, half: Half): GameState {
  const p = clamp(period, 0, Math.max(0, periodCount - 1))
  const h = hasHalves ? half : game.half
  return p === game.period && h === game.half ? game : { ...game, period: p, half: h }
}

/** Add (or take back) runs in the period in play. Scores never go below zero. */
export function addScore(game: GameState, team: 'us' | 'them', delta: number): GameState {
  const list = [...game[team]]
  if (game.period < 0 || game.period >= list.length) return game
  const next = Math.max(0, list[game.period] + delta)
  if (next === list[game.period]) return game
  list[game.period] = next
  return { ...game, [team]: list }
}

export function totalScore(list: number[]): number {
  return list.reduce((a, b) => a + b, 0)
}

export function setBatter(game: GameState, battingCount: number, index: number): GameState {
  if (battingCount <= 0) return game
  const atBat = clamp(index, 0, battingCount - 1)
  return atBat === game.atBat ? game : { ...game, atBat }
}

/** The batter at the plate plus the next few, for the on-deck list. */
export function battingFrom(order: PlayerId[], atBat: number, count: number): PlayerId[] {
  if (order.length === 0) return []
  return Array.from({ length: Math.min(count, order.length) }, (_, i) => order[(atBat + i) % order.length])
}

/** True when this sport splits a period into a batting half and a fielding half. */
export function hasHalves(state: Pick<AppState, 'sport'>): boolean {
  return sportDef(state.sport).hasBattingOrder
}

/** "Top 3rd" / "Quarter 2" — what the controls call the moment in play. */
export function periodStatus(state: Pick<AppState, 'sport' | 'periodName' | 'game'>): string {
  const { game } = state
  const n = game.period + 1
  if (!hasHalves(state)) return `${state.periodName} ${n}`
  return `${game.half === 'top' ? 'Top' : 'Bottom'} ${ordinal(n)}`
}

export function ordinal(n: number): string {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}
