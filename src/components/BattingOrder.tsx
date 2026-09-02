import { useState, type DragEvent } from 'react'
import type { AppState } from '../lib/types'
import type { Action } from '../state'
import { currentDrag, dropZone, endDrag, startDrag, type DropZone } from './dnd'

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
  const [zone, setZone] = useState<DropZone | null>(null)
  const onDragOver = (e: DragEvent) => {
    const d = currentDrag()
    if (!d || d.kind !== 'batter') return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const z = dropZone(e, 'y')
    setZone(d.index === index && z === 'on' ? null : z)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const d = currentDrag()
    setZone(null)
    if (!d || d.kind !== 'batter') return
    const z = dropZone(e, 'y')
    if (z === 'on') {
      if (d.index !== index) dispatch({ type: 'swap-batters', a: d.index, b: index })
    } else {
      dispatch({ type: 'move-batter', from: d.index, insertBefore: z === 'before' ? index : index + 1 })
    }
    endDrag()
  }
  return (
    <li
      className={`batter${zone ? ` zone-${zone}` : ''}`}
      draggable
      onDragStart={(e) => startDrag(e, { kind: 'batter', index })}
      onDragEnd={endDrag}
      onDragOver={onDragOver}
      onDragLeave={() => setZone(null)}
      onDrop={onDrop}
    >
      <span className="order">{index + 1}</span>
      <span className="name">{name}</span>
    </li>
  )
}
