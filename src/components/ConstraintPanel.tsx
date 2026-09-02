import type { AppState, ConstraintInstance } from '../lib/types'
import { CONSTRAINT_DEFS, constraintDef, num, str, strList } from '../lib/constraints'
import { positionLabel } from '../lib/positions'
import type { Action } from '../state'
import { MultiSelect } from './MultiSelect'

interface Props {
  state: AppState
  dispatch: (a: Action) => void
  /** Number of current violations per constraint id. */
  counts: Map<string, number>
}

export function ConstraintPanel({ state, dispatch, counts }: Props) {
  const repeatable = CONSTRAINT_DEFS.filter((d) => d.repeatable)
  return (
    <section className="panel">
      <h2>Constraints</h2>
      <p className="muted small">Checked rules are enforced by the solver and checked after every manual change.</p>
      <ul className="constraints">
        {state.constraints.map((inst) => (
          <ConstraintRow key={inst.id} inst={inst} state={state} dispatch={dispatch} count={counts.get(inst.id) ?? 0} />
        ))}
      </ul>
      <label className="field">
        <span>Add a rule</span>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) dispatch({ type: 'add-constraint', constraintType: e.target.value as ConstraintInstance['type'] })
          }}
        >
          <option value="">Choose a rule type…</option>
          {repeatable.map((d) => (
            <option key={d.type} value={d.type}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}

interface RowProps {
  inst: ConstraintInstance
  state: AppState
  dispatch: (a: Action) => void
  count: number
}

function ConstraintRow({ inst, state, dispatch, count }: RowProps) {
  const def = constraintDef(inst.type)
  const set = (params: Record<string, unknown>) => dispatch({ type: 'set-constraint-params', id: inst.id, params })
  return (
    <li className={`constraint${inst.enabled ? '' : ' off'}${count > 0 && inst.enabled ? ' broken' : ''}`}>
      <div className="constraint-head">
        <label>
          <input type="checkbox" checked={inst.enabled} onChange={() => dispatch({ type: 'toggle-constraint', id: inst.id })} />
          <span className="constraint-name">{def.name}</span>
        </label>
        {inst.enabled && count > 0 && (
          <span className="badge" title={`${count} violation${count === 1 ? '' : 's'}`}>
            ⚠ {count}
          </span>
        )}
        {def.repeatable && (
          <button type="button" className="icon" title="Remove rule" onClick={() => dispatch({ type: 'remove-constraint', id: inst.id })}>
            ✕
          </button>
        )}
      </div>
      <div className="constraint-body">
        <ParamEditor inst={inst} state={state} set={set} />
      </div>
    </li>
  )
}

interface ParamProps {
  inst: ConstraintInstance
  state: AppState
  set: (params: Record<string, unknown>) => void
}

function NumberInput({ value, min, onChange }: { value: number; min: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      className="tiny"
      min={min}
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value)
        if (Number.isFinite(n)) onChange(Math.max(min, Math.floor(n)))
      }}
    />
  )
}

function ParamEditor({ inst, state, set }: ParamProps) {
  const p = inst.params
  const playerOptions = state.players.map((pl) => ({ value: pl.id, label: pl.name || '(unnamed)' }))
  const positionOptions = state.positions.map((pos) => ({ value: pos, label: `${pos} – ${positionLabel(pos)}` }))

  switch (inst.type) {
    case 'no-repeat-position':
      return (
        <span className="inline">
          No player plays the same position more than <NumberInput value={num(p, 'maxTimes', 1)} min={1} onChange={(n) => set({ maxTimes: n })} /> time(s).
        </span>
      )
    case 'equal-sitting':
      return (
        <span className="inline">
          Everyone sits the same number of innings, within ± <NumberInput value={num(p, 'tolerance', 1)} min={0} onChange={(n) => set({ tolerance: n })} /> inning(s).
        </span>
      )
    case 'no-consecutive-bench':
      return (
        <span className="inline">
          No player sits more than <NumberInput value={num(p, 'maxConsecutive', 1)} min={1} onChange={(n) => set({ maxConsecutive: n })} /> inning(s) in a row.
        </span>
      )
    case 'no-consecutive-same-position':
      return <span className="inline muted">No player plays the same position two innings in a row.</span>
    case 'play-group-by-inning':
      return (
        <span className="inline">
          Every player plays one of{' '}
          <MultiSelect options={positionOptions} selected={strList(p, 'positions')} onChange={(v) => set({ positions: v })} noun="positions" placeholder="positions…" />{' '}
          at least <NumberInput value={num(p, 'times', 1)} min={1} onChange={(n) => set({ times: n })} /> time(s) before inning{' '}
          <NumberInput value={num(p, 'byInning', 4)} min={2} onChange={(n) => set({ byInning: n })} />.
        </span>
      )
    case 'position-eligibility':
      return (
        <span className="inline">
          Only{' '}
          <MultiSelect options={playerOptions} selected={strList(p, 'playerIds')} onChange={(v) => set({ playerIds: v })} noun="players" placeholder="players…" />{' '}
          may play{' '}
          <select value={str(p, 'position')} onChange={(e) => set({ position: e.target.value })}>
            {state.positions.map((pos) => (
              <option key={pos} value={pos}>
                {pos} – {positionLabel(pos)}
              </option>
            ))}
          </select>
          .
        </span>
      )
    case 'player-positions':
      return (
        <span className="inline">
          <select value={str(p, 'playerId')} onChange={(e) => set({ playerId: e.target.value })}>
            <option value="">Choose a player…</option>
            {state.players.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.name || '(unnamed)'}
              </option>
            ))}
          </select>{' '}
          may only play{' '}
          <MultiSelect options={positionOptions} selected={strList(p, 'positions')} onChange={(v) => set({ positions: v })} noun="positions" placeholder="positions…" />
          .
        </span>
      )
    default:
      return null
  }
}
