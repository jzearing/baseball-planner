import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { BattingOrder } from './components/BattingOrder'
import { ConstraintPanel } from './components/ConstraintPanel'
import { installTouchDnd } from './components/dnd'
import { FieldTable } from './components/FieldTable'
import { PreferencePanel } from './components/PreferencePanel'
import { QrModal } from './components/QrModal'
import { RosterEditor } from './components/RosterEditor'
import { SettingsPanel } from './components/SettingsPanel'
import { Tutorial } from './components/Tutorial'
import { ViolationList } from './components/ViolationList'
import { evaluateAll, makeContext } from './lib/constraints'
import { planToCsv } from './lib/csv'
import { renderPlanImage } from './lib/image'
import { activePlayers } from './lib/plan'
import { decodeShareFragment, encodeShareFragment, shareUrl } from './lib/share'
import { defaultState, downloadText, exportJson, loadState, markTutorialSeen, parseImport, saveState, tutorialSeen } from './lib/storage'
import { reducer } from './state'

function fileStem(title: string): string {
  const s = title.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  return s || 'lineup'
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState() ?? defaultState())
  const [notice, setNotice] = useState<string | null>(null)
  const [showTutorial, setShowTutorial] = useState(() => !tutorialSeen())
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [railTab, setRailTab] = useState<'constraints' | 'preferences'>('constraints')
  const fileInput = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    saveState(state)
  }, [state])


  // Touch devices get no native drag events; this adds press-and-hold dragging.
  useEffect(() => {
    if (!rootRef.current) return
    return installTouchDnd(rootRef.current, dispatch)
  }, [])

  const violations = useMemo(() => evaluateAll(makeContext(state, state.plan), state.constraints), [state])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of violations) m.set(v.constraintId, (m.get(v.constraintId) ?? 0) + 1)
    return m
  }, [violations])

  const hasPlan = state.plan.some((inn) => Object.values(inn.positions).some(Boolean))
  const fixedCount = state.plan.reduce((n, inn) => n + inn.fixed.length, 0)
  const canSolve = activePlayers(state).length > 0

  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(null), 4000)
  }

  // Opened from a share link: load the setup it carries, then drop the fragment
  // so a reload does not overwrite later edits.
  useEffect(() => {
    let cancelled = false
    const openFromHash = () => {
      const fragment = window.location.hash
      if (!fragment.startsWith('#s=')) return
      decodeShareFragment(fragment)
        .then((shared) => {
          if (cancelled || !shared) return
          const current = loadState()
          const hasOwn = !!current && current.players.length > 0
          if (hasOwn && !window.confirm('This link contains a shared lineup. Replace your current roster, rules and plan with it?')) return
          dispatch({ type: 'import', state: shared })
          flash('Loaded the shared lineup.')
        })
        .catch((err: unknown) => flash(`Could not open the share link: ${err instanceof Error ? err.message : String(err)}`))
        .finally(() => {
          if (!cancelled) window.history.replaceState(null, '', window.location.pathname + window.location.search)
        })
    }
    openFromHash()
    window.addEventListener('hashchange', openFromHash)
    return () => {
      cancelled = true
      window.removeEventListener('hashchange', openFromHash)
    }
  }, [])

  const onShareLink = async () => {
    try {
      const url = shareUrl(await encodeShareFragment(state))
      const title = state.gameTitle || 'Lineup plan'
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ url, title, text: `${title} – open this link to see and edit the lineup` })
          return
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return
          // Sharing failed (e.g. desktop browser without share targets); fall back to the clipboard.
        }
      }
      await navigator.clipboard.writeText(url)
      flash('Share link copied. Paste it into a text or email; it opens the full setup on any phone or computer.')
    } catch (err) {
      flash(`Could not build the share link: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const onShowQr = async () => {
    try {
      setQrUrl(shareUrl(await encodeShareFragment(state)))
    } catch (err) {
      flash(`Could not build the share link: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const closeTutorial = () => {
    markTutorialSeen()
    setShowTutorial(false)
  }

  const onShare = async () => {
    try {
      const blob = await renderPlanImage(state)
      const file = new File([blob], `${fileStem(state.gameTitle)}.png`, { type: 'image/png' })
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
      if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: state.gameTitle || 'Game plan' })
        return
      }
      downloadText(file.name, blob, 'image/png')
      flash('Sharing is not available in this browser, so the image was downloaded instead. Attach it to a text or email.')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      flash(`Could not share: ${err instanceof Error ? err.message : String(err)}`)
    }
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
    <div className="app" ref={rootRef}>
      <aside className="sidebar rail-left no-print">
        <header className="brand">
          <div className="row">
            <h1>⚾ Lineup Planner</h1>
            <span className="spacer" />
            <button type="button" className="secondary small-btn" onClick={() => setShowTutorial(true)} title="Show the how-to guide">
              Help
            </button>
          </div>
          <p className="muted small">Fielding rotations and batting order for youth baseball. Everything stays in your browser.</p>
        </header>
        <SettingsPanel state={state} dispatch={dispatch} />
        <RosterEditor players={state.players} dispatch={dispatch} />
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
          <button type="button" className="secondary" onClick={() => void onShareLink()} disabled={state.players.length === 0} title="A link that carries the whole setup; whoever opens it gets an editable copy">
            Share link
          </button>
          <button type="button" className="secondary" onClick={() => void onShowQr()} disabled={state.players.length === 0} title="Show the share link as a QR code to scan">
            QR code
          </button>
          <button type="button" className="secondary" disabled={!hasPlan} onClick={() => void onShare()} title="Send a picture of the plan to another coach">
            Share image
          </button>
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
            <p>Add your players in the left panel, choose which rules to enforce on the right, then hit <strong>Randomize lineup</strong>.</p>
          </div>
        ) : (
          <>
            <div className="plan-area">
              <FieldTable state={state} dispatch={dispatch} violations={violations} />
              <p className="hint muted small no-print">
                Drag a name onto another to swap. Drop it between two rows to insert and shift the others down. Drop a name onto a name in another inning
                to trade those two players in both innings. Drag inning headers to reorder. On a touch screen, press and hold a name, then drag. Use the
                lock to keep a player in place when you re-solve.
              </p>
              <ViolationList violations={violations} hasPlan={hasPlan} />
            </div>
            <div className="batting-wrap">
              <BattingOrder state={state} dispatch={dispatch} />
            </div>
          </>
        )}
      </main>

      <aside className="sidebar rail-right no-print">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={railTab === 'constraints'} className={railTab === 'constraints' ? 'active' : ''} onClick={() => setRailTab('constraints')}>
            Constraints{violations.length > 0 && <span className="badge">⚠ {violations.length}</span>}
          </button>
          <button type="button" role="tab" aria-selected={railTab === 'preferences'} className={railTab === 'preferences' ? 'active' : ''} onClick={() => setRailTab('preferences')}>
            Preferences{state.preferences.length > 0 && <span className="badge grey">{state.preferences.filter((p) => p.enabled).length}</span>}
          </button>
        </div>
        {railTab === 'constraints' ? <ConstraintPanel state={state} dispatch={dispatch} counts={counts} /> : <PreferencePanel state={state} dispatch={dispatch} />}
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
          <p className="muted small">
            Your roster, rules and plan are saved automatically in this browser. Export JSON keeps a file copy you can import later or on another device.
            To send the setup to another coach, use Share link or QR code in the toolbar above the plan.
          </p>
        </section>
      </aside>
      <Tutorial open={showTutorial} onClose={closeTutorial} />
      <QrModal key={qrUrl ?? ''} url={qrUrl} title={state.gameTitle} onClose={() => setQrUrl(null)} />
    </div>
  )
}
