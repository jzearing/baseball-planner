import type { AppState } from '../lib/types'
import type { Action } from '../state'
import { dropAttrs, startDrag, useDropTarget } from './dnd'

interface Props {
  state: AppState
  dispatch: (a: Action) => void
}

export function BattingOrder({ state, dispatch }: Props) {
  const names = new Map(state.players.map((p) => [p.id, p.name]))
  return (
    <section className="batting">
      <div className="section-head">
        <h2>Batting order</h2>
        <span className="row no-print">
          {state.battingFixed.length > 0 && (
            <button type="button" className="link" onClick={() => dispatch({ type: 'clear-batting-fixed' })}>
              Unlock all
            </button>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => dispatch({ type: 'shuffle-batting' })}
            disabled={state.players.length === 0}
            title={state.battingFixed.length > 0 ? 'Shuffle everyone except the locked batters' : 'Shuffle the batting order'}
          >
            Shuffle {state.battingFixed.length > 0 && <span className="badge blue">🔒 {state.battingFixed.length}</span>}
          </button>
        </span>
      </div>
      {state.battingOrder.length === 0 ? (
        <p className="muted">Add players to build a batting order.</p>
      ) : (
        <ol className="batting-list">
          {state.battingOrder.map((pid, i) => (
            <Batter key={pid} index={i} playerId={pid} name={names.get(pid) ?? '?'} fixed={state.battingFixed.includes(pid)} dispatch={dispatch} />
          ))}
        </ol>
      )}
    </section>
  )
}

interface BatterProps {
  index: number
  playerId: string
  name: string
  fixed: boolean
  dispatch: (a: Action) => void
}

function Batter({ index, playerId, name, fixed, dispatch }: BatterProps) {
  const target = { kind: 'batter', index } as const
  const { zone, ...handlers } = useDropTarget(target, dispatch)
  return (
    <li
      className={`batter${fixed ? ' fixed' : ''}${zone ? ` zone-${zone}` : ''}`}
      draggable
      onDragStart={(e) => startDrag(e, target)}
      {...handlers}
      {...dropAttrs(target, true)}
    >
      <span className="order">{index + 1}</span>
      <span className="name">{name}</span>
      <button
        type="button"
        className={`pin no-print${fixed ? ' on' : ''}`}
        title={fixed ? 'Locked: Shuffle keeps this batter here. Click to unlock.' : 'Lock this batter here so Shuffle leaves them in place'}
        onClick={() => dispatch({ type: 'toggle-batting-fixed', playerId })}
      >
        {fixed ? '🔒' : '🔓'}
      </button>
    </li>
  )
}
