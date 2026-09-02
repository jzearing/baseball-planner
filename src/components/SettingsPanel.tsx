import type { AppState } from '../lib/types'
import { POSITION_CATALOG } from '../lib/positions'
import type { Action } from '../state'

interface Props {
  state: AppState
  dispatch: (a: Action) => void
}

export function SettingsPanel({ state, dispatch }: Props) {
  return (
    <section className="panel">
      <h2>Game</h2>
      <label className="field">
        <span>Title (for the printout)</span>
        <input value={state.gameTitle} placeholder="e.g. Tigers vs. Cubs, June 4" onChange={(e) => dispatch({ type: 'set-title', title: e.target.value })} />
      </label>
      <label className="field">
        <span>Innings</span>
        <input
          type="number"
          min={1}
          max={20}
          value={state.inningCount}
          onChange={(e) => dispatch({ type: 'set-innings', count: Number(e.target.value) })}
        />
      </label>
      <div className="field">
        <span>Positions on the field</span>
        <div className="chips">
          {POSITION_CATALOG.map((p) => {
            const on = state.positions.includes(p.id)
            return (
              <label key={p.id} className={`chip${on ? ' on' : ''}`} title={p.label}>
                <input type="checkbox" checked={on} onChange={() => dispatch({ type: 'toggle-position', position: p.id })} />
                {p.id}
              </label>
            )
          })}
        </div>
        <small className="muted">
          {state.positions.length} fielders, {Math.max(0, state.players.length - state.positions.length)} on the bench each inning
        </small>
      </div>
    </section>
  )
}
