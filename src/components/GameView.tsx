import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppState, Half, PlayerId } from '../lib/types'
import { battingFrom, hasHalves, periodStatus, slideAt, slideCount, slideOf, totalScore, weAreBatting } from '../lib/game'
import { periodTitle, sportDef } from '../lib/positions'
import type { Action } from '../state'
import { FieldDiagram } from './FieldDiagram'

interface Props {
  state: AppState
  dispatch: (a: Action) => void
  onClose: () => void
}

/** Full-screen dugout display: live score, the field as it stands, and who is up. */
export function GameView({ state, dispatch, onClose }: Props) {
  const sport = sportDef(state.sport)
  const halves = hasHalves(state)
  const { game } = state
  const names = useMemo(() => new Map(state.players.map((p) => [p.id, p.name])), [state.players])

  const usName = state.teamName.trim() || 'Us'
  const themName = state.opponent.trim() || 'Opponent'
  const batting = halves ? weAreBatting(state.homeAway, game.half) : false

  const count = slideCount(state.inningCount, halves)
  const index = slideOf(game, halves)
  const { viewportRef, trackStyle, moving, onSettled } = useCarousel(index, count, dispatch)

  useWakeLock()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="game-view no-print" role="dialog" aria-modal="true" aria-label="Game view">
      <header className="gv-head">
        <button type="button" className="gv-exit" onClick={onClose}>
          ✕ Exit
        </button>
        <h2 className="gv-title">
          <span aria-hidden>{sport.icon}</span> {usName} <span className="muted">vs.</span> {themName}
        </h2>
        <button
          type="button"
          className="gv-reset"
          onClick={() => {
            if (window.confirm('Clear the score and go back to the start of the game?')) dispatch({ type: 'reset-game' })
          }}
          title="Start a new game: clears the score and returns to the first period"
        >
          New game
        </button>
      </header>

      <div className="gv-topbar">
        <Scoreboard state={state} dispatch={dispatch} usName={usName} themName={themName} />
        <div className="gv-score-panel">
          <span className="gv-now">{periodStatus(state)}</span>
          {halves ? (
            <ScoreStepper
              label={`${batting ? usName : themName} batting`}
              value={(batting ? game.us : game.them)[game.period] ?? 0}
              unit="run"
              onChange={(delta) => dispatch({ type: 'score', team: batting ? 'us' : 'them', delta })}
            />
          ) : (
            <>
              <ScoreStepper label={usName} value={game.us[game.period] ?? 0} unit="goal" onChange={(delta) => dispatch({ type: 'score', team: 'us', delta })} />
              <ScoreStepper label={themName} value={game.them[game.period] ?? 0} unit="goal" onChange={(delta) => dispatch({ type: 'score', team: 'them', delta })} />
            </>
          )}
        </div>
      </div>

      {/* One slide per half-inning, dragged sideways with the finger. */}
      <div className="gv-viewport" ref={viewportRef}>
        <div className="gv-track" data-moving={moving} style={trackStyle} onTransitionEnd={onSettled}>
          {Array.from({ length: count }, (_, s) => {
            const { period, half } = slideAt(s, halves)
            const slideBatting = halves ? weAreBatting(state.homeAway, half) : false
            const current = s === index
            return (
              <div key={s} className="gv-slide" data-focus={slideBatting ? 'batting' : 'field'} aria-hidden={!current} inert={!current}>
                {/* Only the slide in view and its two neighbours are built; nothing else can be seen. */}
                {Math.abs(s - index) <= 1 && (
                  <Half
                    state={state}
                    dispatch={dispatch}
                    names={names}
                    period={period}
                    batting={slideBatting}
                    showStatus={halves}
                    active={current}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <p className="gv-foot muted small">
        Tap a box on the scoreboard, or swipe sideways, to move the game along{sport.hasBattingOrder && '; tap a name in the order to change the batter'}.
        Everything is saved in this browser, so you can lock the screen and come back.
      </p>
    </div>
  )
}

interface HalfProps {
  state: AppState
  dispatch: (a: Action) => void
  names: Map<PlayerId, string>
  period: number
  batting: boolean
  showStatus: boolean
  active: boolean
}

/** What one half-inning shows: the field for that period, and the order for baseball. */
function Half({ state, dispatch, names, period, batting, showStatus, active }: HalfProps) {
  const sport = sportDef(state.sport)
  const inning = state.plan[period]
  const bench = (inning?.bench ?? []).map((pid) => names.get(pid) ?? '?').filter(Boolean)
  return (
    <>
      <section className="gv-field">
        <h3 className="gv-caption">
          {periodTitle(state.periodName, period)} defense
          {showStatus && <span className={`gv-pill${batting ? ' batting' : ''}`}>{batting ? 'We are batting' : 'We are in the field'}</span>}
        </h3>
        <FieldDiagram sport={sport.id} positions={state.positions} inning={inning} names={names} dim={batting} />
        {bench.length > 0 && (
          <p className="gv-bench">
            <span className="gv-bench-label">Bench</span> {bench.join(' · ')}
          </p>
        )}
      </section>

      {sport.hasBattingOrder && state.battingOrder.length > 0 && (
        <BattingCard state={state} dispatch={dispatch} names={names} active={batting} scrollToPlate={active} />
      )}
    </>
  )
}

interface Carousel {
  viewportRef: React.RefObject<HTMLDivElement | null>
  trackStyle: React.CSSProperties
  /** True while the track is off its resting position, i.e. mid-drag or settling. */
  moving: boolean
  onSettled: () => void
}

/** Release past this share of the width and the game moves on; below it, it springs back. */
const SNAP_FRACTION = 0.3
/** How far a finger travels before we decide it is a swipe rather than a scroll. */
const AXIS_LOCK_PX = 8
/** Past the first or last half-inning there is nothing to show, so the drag drags back. */
const EDGE_RESISTANCE = 0.25
/** A quick flick also moves the game on, since 30% of a wide screen is a long haul. */
const FLICK_SPEED = 0.4
const FLICK_MIN_PX = 40
/** Speed is read over the tail of the gesture, not the last move, which is too jumpy. */
const FLICK_WINDOW_MS = 120

/**
 * Slides the half-innings sideways under the finger, so the next one comes into
 * view as it is pulled rather than appearing all at once.
 */
function useCarousel(index: number, count: number, dispatch: (a: Action) => void): Carousel {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [drag, setDrag] = useState(0)
  const [animating, setAnimating] = useState(false)
  const dragRef = useRef(0)

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el || width === 0) return
    let startX = 0
    let startY = 0
    let trail: { x: number; at: number }[] = []
    let axis: 'x' | 'y' | null = null
    let tracking = false

    const move = (to: number) => {
      dragRef.current = to
      setDrag(to)
    }

    const onStart = (e: TouchEvent) => {
      axis = null
      tracking = false
      if (e.touches.length !== 1) return
      // A sideways drag on the scoreboard is scrolling it, not a swipe.
      if ((e.target as Element | null)?.closest('.scoreboard-wrap')) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      trail = [{ x: startX, at: performance.now() }]
      tracking = true
      setAnimating(false)
    }

    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY
      if (!axis) {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return
        // Mostly upright means they are scrolling the order, so let go of the gesture.
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
        if (axis === 'y') {
          tracking = false
          return
        }
      }
      e.preventDefault()
      const at = performance.now()
      trail.push({ x: e.touches[0].clientX, at })
      while (trail.length > 2 && at - trail[0].at > FLICK_WINDOW_MS) trail.shift()
      const past = (dx > 0 && index === 0) || (dx < 0 && index === count - 1)
      move(past ? dx * EDGE_RESISTANCE : dx)
    }

    const onEnd = () => {
      if (!tracking) return
      tracking = false
      const travelled = dragRef.current
      setAnimating(true)
      move(0)
      const first = trail[0]
      const last = trail[trail.length - 1]
      const span = last && first ? last.at - first.at : 0
      const speed = span > 0 ? (last.x - first.x) / span : 0
      // A flick counts only if it was still heading the way the drag went, so a
      // pull that is yanked back at the last moment stays put.
      const flicked = Math.abs(speed) > FLICK_SPEED && Math.abs(travelled) > FLICK_MIN_PX && Math.sign(speed) === Math.sign(travelled)
      if (Math.abs(travelled) > width * SNAP_FRACTION || flicked) dispatch({ type: 'step-period', delta: travelled < 0 ? 1 : -1 })
    }

    // touchmove cannot be passive: a sideways drag has to stop the page scrolling with it.
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [width, index, count, dispatch])

  return {
    viewportRef,
    trackStyle: {
      transform: `translate3d(${-index * width + drag}px, 0, 0)`,
      transition: animating ? 'transform 260ms cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
    },
    moving: drag !== 0 || animating,
    onSettled: () => setAnimating(false),
  }
}

function ScoreStepper({ label, value, unit, onChange }: { label: string; value: number; unit: string; onChange: (delta: number) => void }) {
  return (
    <div className="gv-group score-stepper">
      <span className="gv-stepper-label">{label}</span>
      <button type="button" className="gv-btn round" onClick={() => onChange(-1)} disabled={value === 0} title={`Take back a ${unit}`} aria-label={`${label}: one ${unit} fewer`}>
        −
      </button>
      <span className="gv-stepper-value" aria-live="polite">
        {value}
      </span>
      <button type="button" className="gv-btn round primary" onClick={() => onChange(1)} title={`Add a ${unit}`} aria-label={`${label}: one ${unit} more`}>
        +
      </button>
    </div>
  )
}

function Scoreboard({ state, dispatch, usName, themName }: { state: AppState; dispatch: (a: Action) => void; usName: string; themName: string }) {
  const { game } = state
  const halves = hasHalves(state)
  // Baseball scoreboards list the visitors on top; soccer just puts us first.
  const usIsHome = halves && state.homeAway === 'home'
  const rows = usIsHome
    ? [
        { name: themName, runs: game.them, mine: false },
        { name: usName, runs: game.us, mine: true },
      ]
    : [
        { name: usName, runs: game.us, mine: true },
        { name: themName, runs: game.them, mine: false },
      ]

  // Either way round, the second row is the home team, who bat in the bottom.
  const half = (rowIndex: number): Half => (rowIndex === 1 ? 'bottom' : 'top')
  const liveRow = halves ? (game.half === 'bottom' ? 1 : 0) : -1

  /** Innings still to come are left blank, the way a real scoreboard leaves them. */
  const played = (rowIndex: number, i: number): boolean => {
    if (i < game.period) return true
    if (i > game.period) return false
    if (!halves) return true
    return rowIndex === 1 ? game.half === 'bottom' : true
  }

  return (
    <div className="scoreboard-wrap">
      <table className="scoreboard">
        <thead>
          <tr>
            <th className="sb-team" scope="col">
              <span className="sr-only">Team</span>
            </th>
            {game.us.map((_, i) => (
              <th key={i} scope="col" className={i === game.period ? 'now' : ''}>
                {i + 1}
              </th>
            ))}
            <th className="sb-total" scope="col">
              {state.sport === 'soccer' ? 'G' : 'R'}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={row.name + r} className={row.mine ? 'mine' : ''}>
              <th scope="row" className="sb-team">
                {row.name}
              </th>
              {row.runs.map((n, i) => {
                const live = i === game.period && (halves ? r === liveRow : true)
                return (
                  <td key={i} className={`pick${i === game.period ? ' now' : ''}${live ? ' live' : ''}`}>
                    <button
                      type="button"
                      className="sb-cell"
                      aria-pressed={live}
                      title={`Go to ${halves ? `the ${half(r)} of ` : ''}${periodTitle(state.periodName, i).toLowerCase()}`}
                      onClick={() => dispatch({ type: 'set-period', period: i, half: half(r) })}
                    >
                      {played(r, i) || n > 0 ? n : <span className="sb-blank">·</span>}
                    </button>
                  </td>
                )
              })}
              <td className="sb-total">{totalScore(row.runs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface BattingCardProps {
  state: AppState
  dispatch: (a: Action) => void
  names: Map<PlayerId, string>
  active: boolean
  scrollToPlate: boolean
}

function BattingCard({ state, dispatch, names, active, scrollToPlate }: BattingCardProps) {
  const { battingOrder, game } = state
  const listRef = useRef<HTMLOListElement>(null)
  const [onDeck, inTheHole] = battingFrom(battingOrder, game.atBat, 3).slice(1)

  // Centre the batter at the plate as the order moves on. Set scrollTop rather than
  // calling scrollIntoView, which would also scroll the carousel sideways.
  useEffect(() => {
    if (!scrollToPlate) return
    const list = listRef.current
    const row = list?.querySelector<HTMLElement>('.at-bat')
    if (!list || !row) return
    list.scrollTo({ top: row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2, behavior: 'smooth' })
  }, [game.atBat, scrollToPlate])

  return (
    <section className={`gv-batting${active ? ' active' : ''}`}>
      <h3 className="gv-caption">
        Batting order
        {!active && <span className="gv-pill">Up when we bat</span>}
      </h3>
      <p className="gv-updeck">
        <span className="gv-updeck-label">On deck</span> {onDeck ? (names.get(onDeck) ?? '?') : '—'}
        <span className="gv-updeck-label">Then</span> {inTheHole ? (names.get(inTheHole) ?? '?') : '—'}
      </p>
      <p className="gv-hint">Tap a name to put them at the plate.</p>
      <ol className="gv-order" ref={listRef}>
        {battingOrder.map((pid, i) => (
          <li key={pid} className={i === game.atBat ? 'at-bat' : ''}>
            <button type="button" onClick={() => dispatch({ type: 'set-at-bat', index: i })} title="Put this batter at the plate">
              <span className="gv-num">{i + 1}</span>
              <span className="gv-name">{names.get(pid) ?? '?'}</span>
              {i === game.atBat && <span className="gv-tag">At bat</span>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Keep the screen awake while the view is open; harmless where unsupported. */
function useWakeLock(): void {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> }
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock
    if (!wakeLock) return
    let sentinel: Sentinel | null = null
    let dropped = false
    const acquire = () => {
      wakeLock
        .request('screen')
        .then((s) => {
          if (dropped) void s.release()
          else sentinel = s
        })
        .catch(() => {
          // Denied (battery saver, no permission); the screen just dims as usual.
        })
    }
    // A tab switch releases the lock, so take it again on the way back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire()
    }
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      dropped = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => {})
    }
  }, [])
}
