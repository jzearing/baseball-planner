import { useState, type DragEvent } from 'react'
import type { AppState, PlayerId, Violation } from '../lib/types'
import { benchRowCount, columnList } from '../lib/plan'
import { positionLabel } from '../lib/positions'
import type { Action } from '../state'
import { currentDrag, dropZone, endDrag, startDrag, type DropZone } from './dnd'

interface Props {
  state: AppState
  dispatch: (a: Action) => void
  violations: Violation[]
}

function violationKey(inning: number, playerId: PlayerId): string {
  return `${inning}|${playerId}`
}

export function FieldTable({ state, dispatch, violations }: Props) {
  const names = new Map(state.players.map((p) => [p.id, p.name]))
  const benchRows = benchRowCount(state)
  const columns = state.plan.map((inn) => columnList(inn, state.positions, benchRows))
  const byCell = new Map<string, Violation[]>()
  for (const v of violations) {
    if (v.inning === undefined || !v.playerId) continue
    const k = violationKey(v.inning, v.playerId)
    byCell.set(k, [...(byCell.get(k) ?? []), v])
  }
  const rowCount = state.positions.length + benchRows

  return (
    <div className="table-wrap">
      <table className="plan">
        <thead>
          <tr>
            <th className="label-col">Position</th>
            {state.plan.map((_, i) => (
              <InningHeader key={i} index={i} dispatch={dispatch} />
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, r) => {
            const isBench = r >= state.positions.length
            const pos = isBench ? null : state.positions[r]
            return (
              <tr key={r} className={isBench ? 'bench-row' : ''}>
                <th className="label-col" scope="row">
                  {pos ? (
                    <>
                      <span className="pos-id">{pos}</span> <span className="pos-label">{positionLabel(pos)}</span>
                    </>
                  ) : (
                    <span className="pos-id bench">Bench</span>
                  )}
                </th>
                {columns.map((col, i) => {
                  const pid = col[r] ?? null
                  return (
                    <Cell
                      key={i}
                      inning={i}
                      index={r}
                      playerId={pid}
                      name={pid ? (names.get(pid) ?? '?') : ''}
                      fixed={!!pid && state.plan[i].fixed.includes(pid)}
                      violations={pid ? (byCell.get(violationKey(i, pid)) ?? []) : []}
                      dispatch={dispatch}
                    />
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function InningHeader({ index, dispatch }: { index: number; dispatch: (a: Action) => void }) {
  const [zone, setZone] = useState<DropZone | null>(null)

  const onDragOver = (e: DragEvent) => {
    const d = currentDrag()
    if (!d || d.kind !== 'inning') return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const z = dropZone(e, 'x')
    setZone(d.index === index && z === 'on' ? null : z)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const d = currentDrag()
    setZone(null)
    if (!d || d.kind !== 'inning') return
    const z = dropZone(e, 'x')
    if (z === 'on') {
      if (d.index !== index) dispatch({ type: 'swap-innings', a: d.index, b: index })
    } else {
      dispatch({ type: 'move-inning', from: d.index, insertBefore: z === 'before' ? index : index + 1 })
    }
    endDrag()
  }

  return (
    <th
      className={`inning-head${zone ? ` zone-${zone}` : ''}`}
      draggable
      title="Drag to reorder innings: drop between headers to insert, on a header to swap"
      onDragStart={(e) => startDrag(e, { kind: 'inning', index })}
      onDragEnd={endDrag}
      onDragOver={onDragOver}
      onDragLeave={() => setZone(null)}
      onDrop={onDrop}
    >
      <span className="grip" aria-hidden>
        ⋮⋮
      </span>
      Inning {index + 1}
    </th>
  )
}

interface CellProps {
  inning: number
  index: number
  playerId: PlayerId | null
  name: string
  fixed: boolean
  violations: Violation[]
  dispatch: (a: Action) => void
}

function Cell({ inning, index, playerId, name, fixed, violations, dispatch }: CellProps) {
  const [zone, setZone] = useState<DropZone | null>(null)

  const onDragOver = (e: DragEvent) => {
    const d = currentDrag()
    if (!d || d.kind !== 'cell' || d.inning !== inning) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const z = dropZone(e, 'y')
    setZone(d.index === index && z === 'on' ? null : z)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const d = currentDrag()
    setZone(null)
    if (!d || d.kind !== 'cell' || d.inning !== inning) return
    const z = dropZone(e, 'y')
    if (z === 'on') {
      if (d.index !== index) dispatch({ type: 'swap-cell', inning, a: d.index, b: index })
    } else {
      dispatch({ type: 'move-cell', inning, from: d.index, insertBefore: z === 'before' ? index : index + 1 })
    }
    endDrag()
  }

  const classes = ['cell']
  if (!playerId) classes.push('empty')
  if (violations.length > 0) classes.push('violation')
  if (fixed) classes.push('fixed')
  if (zone) classes.push(`zone-${zone}`)
  const tip = violations.map((v) => `${v.constraintName}: ${v.message}`).join('\n')

  return (
    <td>
      <div
        className={classes.join(' ')}
        draggable={!!playerId}
        onDragStart={(e) => {
          if (!playerId) return
          startDrag(e, { kind: 'cell', inning, index })
        }}
        onDragEnd={endDrag}
        onDragOver={onDragOver}
        onDragLeave={() => setZone(null)}
        onDrop={onDrop}
      >
        <span className="name">{playerId ? name : '—'}</span>
        {violations.length > 0 && (
          <span className="warn" title={tip} aria-label={tip} role="img">
            ⚠
          </span>
        )}
        {playerId && (
          <button
            type="button"
            className={`pin${fixed ? ' on' : ''}`}
            title={fixed ? 'Fixed: the solver will not move this player. Click to unfix.' : 'Fix this player here so the solver leaves them in place'}
            onClick={() => dispatch({ type: 'toggle-fixed', inning, playerId })}
          >
            {fixed ? '🔒' : '🔓'}
          </button>
        )}
      </div>
    </td>
  )
}
