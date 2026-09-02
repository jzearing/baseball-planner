import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { BattingOrder } from './components/BattingOrder'
import { ConstraintPanel } from './components/ConstraintPanel'
import { FieldTable } from './components/FieldTable'
import { RosterEditor } from './components/RosterEditor'
import { SettingsPanel } from './components/SettingsPanel'
import { ViolationList } from './components/ViolationList'
import { evaluateAll, makeContext } from './lib/constraints'
import { planToCsv } from './lib/csv'
import { defaultState, downloadText, exportJson, loadState, parseImport, saveState } from './lib/storage'
import { reducer } from './state'

function fileStem(title: string): string {
  const s = title.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  return s || 'lineup'
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState() ?? defaultState())
  const [notice, setNotice] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    saveState(state)
  }, [state])

  const violations = useMemo(() => evaluateAll(makeContext(state, state.plan), state.constraints), [state])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of violations) m.set(v.constraintId, (m.get(v.constraintId) ?? 0) + 1)
    return m
  }, [violations])

  const hasPlan = state.plan.some((inn) => Object.values(inn.positions).some(Boolean))
  const fixedCount = state.plan.reduce((n, inn) => n + inn.fixed.length, 0)
  const canSolve = state.players.length > 0

  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(null), 4000)
  }

  const onImport = async (file: File) => {
    try {
      dispatch({ type: 'import', state: parseImport(await file.text()) })
      flash(`Imported ${file.name}`)
    } catch (err) {
      flash(`Could not import: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="app">
      <aside className="sidebar no-print">
        <header className="brand">
          <h1>⚾ Lineup Planner</h1>
          <p className="muted small">Fielding rotations and batting order for youth baseball. Everything stays in your browser.</p>
        </header>
        <SettingsPanel state={state} dispatch={dispatch} />
        <RosterEditor players={state.players} dispatch={dispatch} />
        <ConstraintPanel state={state} dispatch={dispatch} counts={counts} />
        <section className="panel">
          <h2>Save &amp; load</h2>
          <div className="row wrap">
            <button type="button" className="secondary" onClick={() => downloadText(`${fileStem(state.gameTitle)}.json`, exportJson(state), 'application/json')}>
              Export JSON
            </button>
            <button type="button" className="secondary" onClick={() => fileInput.current?.click()}>
              Import JSON
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onImport(f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (window.confirm('Clear the roster, constraints and plan?')) dispatch({ type: 'reset' })
              }}
            >
              Reset
            </button>
          </div>
          <p className="muted small">Your roster, rules and plan are saved automatically in this browser.</p>
        </section>
      </aside>

      <main className="main">
        <div className="toolbar no-print">
          <button type="button" className="primary" disabled={!canSolve} onClick={() => dispatch({ type: 'randomize-lineup' })} title="Build a brand-new plan (clears fixed markers)">
            Randomize lineup
          </button>
          <button
            type="button"
            disabled={!canSolve || !hasPlan}
            onClick={() => dispatch({ type: 'resolve-keep-fixed' })}
            title="Randomize everyone except the players you have locked in place"
          >
            Re-solve unfixed {fixedCount > 0 && <span className="badge blue">🔒 {fixedCount}</span>}
          </button>
          {fixedCount > 0 && (
            <button type="button" className="link" onClick={() => dispatch({ type: 'clear-fixed' })}>
              Unlock all
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="secondary" disabled={!hasPlan} onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className="secondary" disabled={!hasPlan} onClick={() => downloadText(`${fileStem(state.gameTitle)}.csv`, planToCsv(state), 'text/csv')}>
            Export CSV
          </button>
        </div>
        {notice && <div className="notice no-print">{notice}</div>}

        <header className="print-header print-only">
          <h1>{state.gameTitle || 'Game plan'}</h1>
        </header>

        {state.players.length === 0 ? (
          <div className="empty-state">
            <p>Add your players in the sidebar, choose which rules to enforce, then hit <strong>Randomize lineup</strong>.</p>
          </div>
        ) : (
          <>
            <FieldTable state={state} dispatch={dispatch} violations={violations} />
            <p className="hint muted small no-print">
              Drag a name onto another to swap. Drop it between two rows to insert and shift the others down. Drag inning headers to reorder. Use the lock to
              keep a player in place when you re-solve.
            </p>
            <ViolationList violations={violations} hasPlan={hasPlan} />
            <BattingOrder state={state} dispatch={dispatch} />
          </>
        )}
      </main>
    </div>
  )
}
