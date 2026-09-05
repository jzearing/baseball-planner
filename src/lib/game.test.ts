import { describe, expect, it } from 'vitest'
import { addScore, emptyGame, normalizeGame, ordinal, periodStatus, stepBatter, stepGame, totalScore, weAreBatting } from './game'
import { coerceState, defaultState } from './storage'
import { reducer } from '../state'
import type { GameState } from './types'

const game = (patch: Partial<GameState> = {}): GameState => ({ ...emptyGame(6), ...patch })

describe('stepGame with halves', () => {
  it('runs top to bottom to the next top', () => {
    let g = game()
    expect([g.period, g.half]).toEqual([0, 'top'])
    g = stepGame(g, 6, true, 1)
    expect([g.period, g.half]).toEqual([0, 'bottom'])
    g = stepGame(g, 6, true, 1)
    expect([g.period, g.half]).toEqual([1, 'top'])
  })

  it('walks back the same way', () => {
    const g = stepGame(stepGame(game(), 6, true, 1), 6, true, 1)
    const back = stepGame(g, 6, true, -1)
    expect([back.period, back.half]).toEqual([0, 'bottom'])
  })

  it('stops at both ends of the game', () => {
    expect(stepGame(game(), 6, true, -1)).toEqual(game())
    const last = game({ period: 5, half: 'bottom' })
    expect(stepGame(last, 6, true, 1)).toBe(last)
  })
})

describe('stepGame without halves', () => {
  it('moves one period at a time and clamps', () => {
    const g = stepGame(game({ period: 0 }), 4, false, 1)
    expect(g.period).toBe(1)
    expect(stepGame(game({ period: 3 }), 4, false, 1).period).toBe(3)
    expect(stepGame(game({ period: 0 }), 4, false, -1).period).toBe(0)
  })
})

describe('weAreBatting', () => {
  it('has the home team batting in the bottom half', () => {
    expect(weAreBatting('home', 'bottom')).toBe(true)
    expect(weAreBatting('home', 'top')).toBe(false)
  })
  it('has the away team batting in the top half', () => {
    expect(weAreBatting('away', 'top')).toBe(true)
    expect(weAreBatting('away', 'bottom')).toBe(false)
  })
})

describe('addScore', () => {
  it('adds to the period in play only', () => {
    const g = addScore(game({ period: 2 }), 'us', 3)
    expect(g.us).toEqual([0, 0, 3, 0, 0, 0])
    expect(totalScore(g.us)).toBe(3)
  })
  it('never goes below zero, and leaves the game untouched when it would', () => {
    const start = game()
    const g = addScore(start, 'them', -1)
    expect(g.them[0]).toBe(0)
    expect(g).toBe(start)
  })
  it('keeps the two teams separate', () => {
    const g = addScore(addScore(game(), 'us', 1), 'them', 2)
    expect([totalScore(g.us), totalScore(g.them)]).toEqual([1, 2])
  })
})

describe('stepBatter', () => {
  it('wraps around the bottom of the order', () => {
    expect(stepBatter(game({ atBat: 8 }), 9, 1).atBat).toBe(0)
    expect(stepBatter(game({ atBat: 0 }), 9, -1).atBat).toBe(8)
  })
  it('does nothing with an empty order', () => {
    const g = game()
    expect(stepBatter(g, 0, 1)).toBe(g)
  })
})

describe('normalizeGame', () => {
  it('pads and trims the per-period scores to the game length', () => {
    const g = normalizeGame(game({ us: [1, 2], them: [3, 4, 5, 6, 7, 8, 9, 9] }), 4, 9)
    expect(g.us).toEqual([1, 2, 0, 0])
    expect(g.them).toEqual([3, 4, 5, 6])
  })
  it('pulls the cursors back inside the game', () => {
    const g = normalizeGame(game({ period: 9, atBat: 20 }), 3, 5)
    expect(g.period).toBe(2)
    expect(g.atBat).toBe(4)
  })
  it('returns the same object when nothing needs changing', () => {
    const g = game()
    expect(normalizeGame(g, 6, 9)).toBe(g)
  })
})

describe('periodStatus', () => {
  it('names the half for baseball and the period for soccer', () => {
    expect(periodStatus({ sport: 'baseball', periodName: 'Inning', game: game({ period: 2, half: 'bottom' }) })).toBe('Bottom 3rd')
    expect(periodStatus({ sport: 'soccer', periodName: 'Quarter', game: game({ period: 1 }) })).toBe('Quarter 2')
  })
  it('spells the teens correctly', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st'])
  })
})

describe('game state through the reducer', () => {
  it('re-fits the score when the game gets shorter', () => {
    let state = defaultState()
    state = reducer(state, { type: 'step-period', delta: 1 })
    state = reducer(state, { type: 'step-period', delta: 1 })
    state = reducer(state, { type: 'score', team: 'us', delta: 2 })
    expect(state.game.us).toEqual([0, 2, 0, 0, 0, 0])

    state = reducer(state, { type: 'set-innings', count: 2 })
    expect(state.game.us).toEqual([0, 2])
    expect(state.game.period).toBe(1)
  })

  it('keeps the at-bat cursor on a real batter when the roster shrinks', () => {
    let state = defaultState()
    state = reducer(state, { type: 'add-players', names: ['Ava', 'Ben', 'Cal'] })
    state = reducer(state, { type: 'set-at-bat', index: 2 })
    expect(state.game.atBat).toBe(2)

    const last = state.players[2]
    state = reducer(state, { type: 'remove-player', id: last.id })
    expect(state.game.atBat).toBe(1)
  })

  it('starts a fresh game when the sport changes', () => {
    let state = defaultState()
    state = reducer(state, { type: 'score', team: 'us', delta: 4 })
    state = reducer(state, { type: 'set-sport', sport: 'soccer' })
    expect(totalScore(state.game.us)).toBe(0)
    expect(state.game.us).toHaveLength(4)
  })

  it('clears the score but keeps the plan on a new game', () => {
    let state = defaultState()
    state = reducer(state, { type: 'add-players', names: ['Ava', 'Ben'] })
    state = reducer(state, { type: 'score', team: 'them', delta: 3 })
    state = reducer(state, { type: 'step-period', delta: 1 })
    state = reducer(state, { type: 'reset-game' })
    expect(totalScore(state.game.them)).toBe(0)
    expect(state.game.period).toBe(0)
    expect(state.game.half).toBe('top')
    expect(state.players).toHaveLength(2)
  })
})

describe('loading older saves', () => {
  it('gives a save with no game block a fresh one', () => {
    const state = coerceState({ version: 2, sport: 'baseball', players: [], inningCount: 6 })
    expect(state.game).toEqual(emptyGame(6))
    expect(state.teamName).toBe('')
    expect(state.homeAway).toBe('home')
  })

  it('fits a stored game to the saved game length', () => {
    const state = coerceState({
      version: 2,
      sport: 'baseball',
      inningCount: 3,
      players: [{ id: 'a', name: 'Ava', active: true }],
      game: { period: 7, half: 'bottom', us: [1, 0, 2, 9, 9], them: [0], atBat: 6 },
    })
    expect(state.game.us).toEqual([1, 0, 2])
    expect(state.game.them).toEqual([0, 0, 0])
    expect(state.game.period).toBe(2)
    expect(state.game.atBat).toBe(0)
  })

  it('drops nonsense values rather than failing to load', () => {
    const state = coerceState({ version: 2, inningCount: 2, players: [], game: { period: 'x', half: 'sideways', us: ['a', 3], them: null, atBat: -4 } })
    expect(state.game).toEqual({ period: 0, half: 'top', us: [0, 3], them: [0, 0], atBat: 0 })
  })
})
