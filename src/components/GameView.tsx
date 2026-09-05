import { useEffect, useMemo, useRef } from 'react'
import type { AppState, Half, PlayerId } from '../lib/types'
import { battingFrom, hasHalves, periodStatus, totalScore, weAreBatting } from '../lib/game'
import { periodNoun, periodTitle, sportDef } from '../lib/positions'
import type { Action } from '../state'
import { FieldDiagram } from './FieldDiagram'

interface Props {
  state: AppState
  dispatch: (a: Action) => void
  onClose: () => void
}

/** Full-screen dugout display: live score, the field as it stands, and who is up. */
export function GameView({ state, dispatch, onClose }: Props) {
  const sport = sportDef(state.sport)
  const period = periodNoun(state.periodName)
  const halves = hasHalves(state)
  const { game } = state
  const names = useMemo(() => new Map(state.players.map((p) => [p.id, p.name])), [state.players])

  const usName = state.teamName.trim() || 'Us'
  const themName = state.opponent.trim() || 'Opponent'
  const batting = halves ? weAreBatting(state.homeAway, game.half) : false
  const inning = state.plan[game.period]
  const bench = (inning?.bench ?? []).map((pid) => names.get(pid) ?? '?').filter(Boolean)

  useWakeLock()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const atEnd = game.period === state.inningCount - 1 && (!halves || game.half === 'bottom')

  return (
    <div className="game-view no-print" role="dialog" aria-modal="true" aria-label="Game view">
      <header className="gv-head">
        <button type="button" className="gv-exit" onClick={onClose}>
          ✕ Exit
        </button>
        <h2 className="gv-title">
          <span aria-hidden>{sport.icon}</span> {usName} <span className="muted">vs.</span> {themName}
        </h2>
        <button
          type="button"
          className="gv-reset"
          onClick={() => {
            if (window.confirm('Clear the score and go back to the start of the game?')) dispatch({ type: 'reset-game' })
          }}
          title="Start a new game: clears the score and returns to the first period"
        >
          New game
        </button>
      </header>

      <Scoreboard state={state} dispatch={dispatch} usName={usName} themName={themName} />

      <div className="gv-body">
        <section className="gv-field">
          <h3 className="gv-caption">
            {periodTitle(state.periodName, game.period)} defense
            {halves && <span className={`gv-pill${batting ? ' batting' : ''}`}>{batting ? 'We are batting' : 'We are in the field'}</span>}
          </h3>
          <FieldDiagram sport={sport.id} positions={state.positions} inning={inning} names={names} dim={batting} />
          {bench.length > 0 && (
            <p className="gv-bench">
              <span className="gv-bench-label">Bench</span> {bench.join(' · ')}
            </p>
          )}
        </section>

        {sport.hasBattingOrder && state.battingOrder.length > 0 && (
          <BattingCard state={state} dispatch={dispatch} names={names} active={batting} />
        )}
      </div>

      <footer className="gv-controls">
        <div className="gv-group">
          <span className="gv-now">{periodStatus(state)}</span>
          <button type="button" className="gv-btn" disabled={atEnd} onClick={() => dispatch({ type: 'step-period', delta: 1 })} title="Move on to the next half or period">
            Next ›
          </button>
        </div>

        {halves ? (
          <ScoreStepper
            label={`${batting ? usName : themName} batting`}
            value={(batting ? game.us : game.them)[game.period] ?? 0}
            unit="run"
            onChange={(delta) => dispatch({ type: 'score', team: batting ? 'us' : 'them', delta })}
          />
        ) : (
          <>
            <ScoreStepper label={usName} value={game.us[game.period] ?? 0} unit="goal" onChange={(delta) => dispatch({ type: 'score', team: 'us', delta })} />
            <ScoreStepper label={themName} value={game.them[game.period] ?? 0} unit="goal" onChange={(delta) => dispatch({ type: 'score', team: 'them', delta })} />
          </>
        )}

        {sport.hasBattingOrder && batting && state.battingOrder.length > 0 && (
          <div className="gv-group">
            <button type="button" className="gv-btn primary" onClick={() => dispatch({ type: 'step-batter', delta: 1 })} title="Move on to the next batter">
              Next batter ›
            </button>
          </div>
        )}
      </footer>
      <p className="gv-foot muted small">
        Tap a box on the scoreboard to move to that {halves ? 'half' : period.singular}; the score you add goes in the highlighted one. Everything is
        saved in this browser, so you can lock the screen and come back.
      </p>
    </div>
  )
}

function ScoreStepper({ label, value, unit, onChange }: { label: string; value: number; unit: string; onChange: (delta: number) => void }) {
  return (
    <div className="gv-group score-stepper">
      <span className="gv-stepper-label">{label}</span>
      <button type="button" className="gv-btn round" onClick={() => onChange(-1)} disabled={value === 0} title={`Take back a ${unit}`} aria-label={`${label}: one ${unit} fewer`}>
        −
      </button>
      <span className="gv-stepper-value" aria-live="polite">
        {value}
      </span>
      <button type="button" className="gv-btn round primary" onClick={() => onChange(1)} title={`Add a ${unit}`} aria-label={`${label}: one ${unit} more`}>
        +
      </button>
    </div>
  )
}

function Scoreboard({ state, dispatch, usName, themName }: { state: AppState; dispatch: (a: Action) => void; usName: string; themName: string }) {
  const { game } = state
  const halves = hasHalves(state)
  // Baseball scoreboards list the visitors on top; soccer just puts us first.
  const usIsHome = halves && state.homeAway === 'home'
  const rows = usIsHome
    ? [
        { name: themName, runs: game.them, mine: false },
        { name: usName, runs: game.us, mine: true },
      ]
    : [
        { name: usName, runs: game.us, mine: true },
        { name: themName, runs: game.them, mine: false },
      ]

  // Either way round, the second row is the home team, who bat in the bottom.
  const half = (rowIndex: number): Half => (rowIndex === 1 ? 'bottom' : 'top')
  const liveRow = halves ? (game.half === 'bottom' ? 1 : 0) : -1

  /** Innings still to come are left blank, the way a real scoreboard leaves them. */
  const played = (rowIndex: number, i: number): boolean => {
    if (i < game.period) return true
    if (i > game.period) return false
    if (!halves) return true
    return rowIndex === 1 ? game.half === 'bottom' : true
  }

  return (
    <div className="scoreboard-wrap">
      <table className="scoreboard">
        <thead>
          <tr>
            <th className="sb-team" scope="col">
              <span className="sr-only">Team</span>
            </th>
            {game.us.map((_, i) => (
              <th key={i} scope="col" className={i === game.period ? 'now' : ''}>
                {i + 1}
              </th>
            ))}
            <th className="sb-total" scope="col">
              {state.sport === 'soccer' ? 'G' : 'R'}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={row.name + r} className={row.mine ? 'mine' : ''}>
              <th scope="row" className="sb-team">
                {row.name}
              </th>
              {row.runs.map((n, i) => {
                const live = i === game.period && (halves ? r === liveRow : true)
                return (
                  <td key={i} className={`pick${i === game.period ? ' now' : ''}${live ? ' live' : ''}`}>
                    <button
                      type="button"
                      className="sb-cell"
                      aria-pressed={live}
                      title={`Go to ${halves ? `the ${half(r)} of ` : ''}${periodTitle(state.periodName, i).toLowerCase()}`}
                      onClick={() => dispatch({ type: 'set-period', period: i, half: half(r) })}
                    >
                      {played(r, i) || n > 0 ? n : <span className="sb-blank">·</span>}
                    </button>
                  </td>
                )
              })}
              <td className="sb-total">{totalScore(row.runs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface BattingCardProps {
  state: AppState
  dispatch: (a: Action) => void
  names: Map<PlayerId, string>
  active: boolean
}

function BattingCard({ state, dispatch, names, active }: BattingCardProps) {
  const { battingOrder, game } = state
  const listRef = useRef<HTMLOListElement>(null)
  const [onDeck, inTheHole] = battingFrom(battingOrder, game.atBat, 3).slice(1)

  // Keep the batter at the plate in view as the order moves on.
  useEffect(() => {
    listRef.current?.querySelector('.at-bat')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [game.atBat])

  return (
    <section className={`gv-batting${active ? ' active' : ''}`}>
      <h3 className="gv-caption">
        Batting order
        {!active && <span className="gv-pill">Up when we bat</span>}
      </h3>
      <p className="gv-updeck">
        <span className="gv-updeck-label">On deck</span> {onDeck ? (names.get(onDeck) ?? '?') : '—'}
        <span className="gv-updeck-label">Then</span> {inTheHole ? (names.get(inTheHole) ?? '?') : '—'}
      </p>
      <p className="gv-hint">Tap a name to put them at the plate.</p>
      <ol className="gv-order" ref={listRef}>
        {battingOrder.map((pid, i) => (
          <li key={pid} className={i === game.atBat ? 'at-bat' : ''}>
            <button type="button" onClick={() => dispatch({ type: 'set-at-bat', index: i })} title="Put this batter at the plate">
              <span className="gv-num">{i + 1}</span>
              <span className="gv-name">{names.get(pid) ?? '?'}</span>
              {i === game.atBat && <span className="gv-tag">At bat</span>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Keep the screen awake while the view is open; harmless where unsupported. */
function useWakeLock(): void {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> }
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock
    if (!wakeLock) return
    let sentinel: Sentinel | null = null
    let dropped = false
    const acquire = () => {
      wakeLock
        .request('screen')
        .then((s) => {
          if (dropped) void s.release()
          else sentinel = s
        })
        .catch(() => {
          // Denied (battery saver, no permission); the screen just dims as usual.
        })
    }
    // A tab switch releases the lock, so take it again on the way back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire()
    }
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      dropped = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => {})
    }
  }, [])
}
