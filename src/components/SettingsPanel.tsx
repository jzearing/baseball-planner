import type { AppState, HomeAway } from '../lib/types'
import { benchRowCount } from '../lib/plan'
import { catalogFor, periodNoun, SPORTS, sportDef, type Sport } from '../lib/positions'
import type { Action } from '../state'

interface Props {
  state: AppState
  dispatch: (a: Action) => void
}

export function SettingsPanel({ state, dispatch }: Props) {
  const sport = sportDef(state.sport)
  const period = periodNoun(state.periodName)
  const periodCount = state.inningCount
  const currentFormation = sport.formations.find((f) => f.positions.length === state.positions.length && f.positions.every((p) => state.positions.includes(p)))
  return (
    <section className="panel">
      <h2>Game</h2>
      <div className="field">
        <span>Sport</span>
        <div className="segmented" role="radiogroup" aria-label="Sport">
          {(Object.keys(SPORTS) as Sport[]).map((id) => {
            const def = SPORTS[id]
            const on = state.sport === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                className={on ? 'on' : ''}
                onClick={() => {
                  if (on) return
                  const hasPlan = state.plan.some((inn) => Object.values(inn.positions).some(Boolean))
                  if (hasPlan && !window.confirm(`Switch to ${def.name}? The positions change, so the current plan will be cleared.`)) return
                  dispatch({ type: 'set-sport', sport: id })
                }}
              >
                {def.icon} {def.name}
              </button>
            )
          })}
        </div>
      </div>
      <div className="field">
        <span>Teams (for Game view)</span>
        <div className="row">
          <input
            value={state.teamName}
            aria-label="Your team"
            placeholder="Your team"
            onChange={(e) => dispatch({ type: 'set-team-name', name: e.target.value })}
          />
          <span className="muted small">vs.</span>
          <input value={state.opponent} aria-label="Opponent" placeholder="Opponent" onChange={(e) => dispatch({ type: 'set-opponent', name: e.target.value })} />
        </div>
      </div>
      {sport.hasBattingOrder && (
        <div className="field">
          <span>Home or away</span>
          <div className="segmented" role="radiogroup" aria-label="Home or away">
            {(['home', 'away'] as HomeAway[]).map((side) => (
              <button
                key={side}
                type="button"
                role="radio"
                aria-checked={state.homeAway === side}
                className={state.homeAway === side ? 'on' : ''}
                onClick={() => dispatch({ type: 'set-home-away', homeAway: side })}
              >
                {side === 'home' ? 'Home' : 'Away'}
              </button>
            ))}
          </div>
          <small className="muted">{state.homeAway === 'home' ? 'You field the top of each inning and bat the bottom.' : 'You bat the top of each inning and field the bottom.'}</small>
        </div>
      )}
      <label className="field">
        <span>Title (for the printout)</span>
        <input value={state.gameTitle} placeholder="e.g. Tigers vs. Cubs, June 4" onChange={(e) => dispatch({ type: 'set-title', title: e.target.value })} />
      </label>
      <div className="field">
        <span>Game length</span>
        <div className="row">
          {sport.periodChoices.length > 1 && (
            <select
              value={state.periodName}
              aria-label="Period type"
              onChange={(e) => {
                const choice = sport.periodChoices.find((c) => c.name === e.target.value)
                dispatch({ type: 'set-period-name', name: e.target.value, count: choice?.count })
              }}
            >
              {sport.periodChoices.map((c) => (
                <option key={c.name} value={c.name}>
                  {periodNoun(c.name).plural.replace(/^./, (ch) => ch.toUpperCase())}
                </option>
              ))}
            </select>
          )}
          <input
            type="number"
            min={1}
            max={20}
            value={periodCount}
            aria-label={`Number of ${period.plural}`}
            onChange={(e) => dispatch({ type: 'set-innings', count: Number(e.target.value) })}
          />
          <span className="muted small">{period.plural}</span>
        </div>
      </div>
      <div className="field">
        <span>Positions on the field</span>
        <div className="chips">
          {catalogFor(state.sport).map((p) => {
            const on = state.positions.includes(p.id)
            return (
              <label key={p.id} className={`chip${on ? ' on' : ''}`} title={p.label}>
                <input type="checkbox" checked={on} onChange={() => dispatch({ type: 'toggle-position', position: p.id })} />
                {p.id}
              </label>
            )
          })}
        </div>
        <div className="row wrap presets">
          <span className="muted small">Presets:</span>
          {sport.formations.map((f) => (
            <button
              key={f.label}
              type="button"
              className={`link${currentFormation?.label === f.label ? ' current' : ''}`}
              onClick={() => dispatch({ type: 'set-positions', positions: f.positions })}
            >
              {f.label}
            </button>
          ))}
        </div>
        <small className="muted">
          {state.positions.length} on the field, {benchRowCount(state)} on the bench each {period.singular}
        </small>
      </div>
    </section>
  )
}
