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
        <button type="button" className="secondary no-print" onClick={() => dispatch({ type: 'shuffle-batting' })} disabled={state.players.length === 0}>
          Shuffle
        </button>
      </div>
      {state.battingOrder.length === 0 ? (
        <p className="muted">Add players to build a batting order.</p>
      ) : (
        <ol className="batting-list">
          {state.battingOrder.map((pid, i) => (
            <Batter key={pid} index={i} name={names.get(pid) ?? '?'} dispatch={dispatch} />
          ))}
        </ol>
      )}
    </section>
  )
}

function Batter({ index, name, dispatch }: { index: number; name: string; dispatch: (a: Action) => void }) {
  const target = { kind: 'batter', index } as const
  const { zone, ...handlers } = useDropTarget(target, dispatch)
  return (
    <li className={`batter${zone ? ` zone-${zone}` : ''}`} draggable onDragStart={(e) => startDrag(e, target)} {...handlers} {...dropAttrs(target, true)}>
      <span className="order">{index + 1}</span>
      <span className="name">{name}</span>
    </li>
  )
}
