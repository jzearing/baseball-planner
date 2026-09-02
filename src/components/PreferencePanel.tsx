import type { AppState } from '../lib/types'
import { makeContext } from '../lib/constraints'
import { positionLabel } from '../lib/positions'
import { scorePreference } from '../lib/preferences'
import type { Action } from '../state'
import { MultiSelect } from './MultiSelect'

interface Props {
  state: AppState
  dispatch: (a: Action) => void
}

export function PreferencePanel({ state, dispatch }: Props) {
  const ctx = makeContext(state, state.plan)
  const hasPlan = state.plan.some((inn) => Object.values(inn.positions).some(Boolean))
  const positionOptions = state.positions.map((pos) => ({ value: pos, label: `${pos} – ${positionLabel(pos)}` }))
  return (
    <section className="panel">
      <h2>Preferences</h2>
      <p className="muted small">
        Preferences are wishes, not rules. The solver honours them whenever the constraints allow, and nothing is flagged when it cannot. Re-run
        Randomize lineup after changing them.
      </p>
      {state.preferences.length === 0 && <p className="muted small">No preferences yet.</p>}
      <ul className="constraints">
        {state.preferences.map((pref) => {
          const score = hasPlan && pref.playerId ? scorePreference(ctx, pref) : null
          return (
            <li key={pref.id} className={`constraint${pref.enabled ? '' : ' off'}`}>
              <div className="constraint-head">
                <label>
                  <input
                    type="checkbox"
                    checked={pref.enabled}
                    onChange={() => dispatch({ type: 'set-preference', id: pref.id, patch: { enabled: !pref.enabled } })}
                  />
                  <span className="constraint-name">Preferred position</span>
                </label>
                {score && pref.positions.length > 0 && (
                  <span className={`badge ${score.hits === score.fielded ? 'green' : 'grey'}`} title="Innings at a preferred position out of innings on the field">
                    {score.hits}/{score.fielded}
                  </span>
                )}
                <button type="button" className="icon" title="Remove preference" onClick={() => dispatch({ type: 'remove-preference', id: pref.id })}>
                  ✕
                </button>
              </div>
              <div className="constraint-body">
                <span className="inline">
                  <select value={pref.playerId} onChange={(e) => dispatch({ type: 'set-preference', id: pref.id, patch: { playerId: e.target.value } })}>
                    <option value="">Choose a player…</option>
                    {state.players.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name || '(unnamed)'}
                      </option>
                    ))}
                  </select>{' '}
                  would like to play{' '}
                  <MultiSelect
                    options={positionOptions}
                    selected={pref.positions}
                    onChange={(v) => dispatch({ type: 'set-preference', id: pref.id, patch: { positions: v } })}
                    noun="positions"
                    placeholder="positions…"
                  />
                  .
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      <button type="button" className="secondary" onClick={() => dispatch({ type: 'add-preference' })} disabled={state.players.length === 0}>
        + Add preference
      </button>
    </section>
  )
}
