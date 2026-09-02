import { useState } from 'react'
import type { Player } from '../lib/types'
import type { Action } from '../state'

interface Props {
  players: Player[]
  dispatch: (a: Action) => void
}

const SAMPLE = ['Ava', 'Ben', 'Carlos', 'Dani', 'Eli', 'Faith', 'Gus', 'Hana', 'Ivan', 'Jade', 'Kai', 'Liam']

export function RosterEditor({ players, dispatch }: Props) {
  const [draft, setDraft] = useState('')
  const [bulk, setBulk] = useState(false)

  const add = () => {
    const names = draft.split(/[\n,;]+/)
    dispatch({ type: 'add-players', names })
    setDraft('')
  }

  const playing = players.filter((p) => p.active).length
  return (
    <section className="panel">
      <h2>
        Players{' '}
        <span className="muted">
          ({playing === players.length ? players.length : `${playing} of ${players.length} playing`})
        </span>
      </h2>
      {players.length > 0 && <p className="muted small">Untick a player who is absent to leave them out of the plan without deleting them.</p>}
      <ul className="roster">
        {players.map((p) => (
          <li key={p.id} className={p.active ? '' : 'absent'}>
            <input
              type="checkbox"
              checked={p.active}
              title={p.active ? 'Playing today' : 'Absent: not in the plan'}
              aria-label={`${p.name || 'Player'} is playing today`}
              onChange={() => dispatch({ type: 'toggle-player-active', id: p.id })}
            />
            <input
              value={p.name}
              aria-label="Player name"
              onChange={(e) => dispatch({ type: 'rename-player', id: p.id, name: e.target.value })}
            />
            <button type="button" className="icon" title="Remove player" onClick={() => dispatch({ type: 'remove-player', id: p.id })}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      {bulk ? (
        <div className="stack">
          <textarea
            rows={5}
            placeholder="One name per line (or comma separated)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="row">
            <button type="button" onClick={add} disabled={!draft.trim()}>
              Add all
            </button>
            <button type="button" className="secondary" onClick={() => setBulk(false)}>
              Single
            </button>
          </div>
        </div>
      ) : (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <input placeholder="Add player name" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="New player name" />
          <button type="submit" disabled={!draft.trim()}>
            Add
          </button>
          <button type="button" className="secondary" title="Paste a whole list" onClick={() => setBulk(true)}>
            List
          </button>
        </form>
      )}
      {players.length === 0 && (
        <button type="button" className="link" onClick={() => dispatch({ type: 'add-players', names: SAMPLE })}>
          Load a sample roster
        </button>
      )}
    </section>
  )
}
