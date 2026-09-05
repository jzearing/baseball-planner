import type { Inning, PlayerId, PositionId } from '../lib/types'
import { positionDef, positionLabel, type Sport } from '../lib/positions'

interface Props {
  sport: Sport
  positions: PositionId[]
  inning: Inning | undefined
  names: Map<PlayerId, string>
  /** Dimmed while the other team is in the field. */
  dim?: boolean
}

/**
 * Overhead view of the field with each player's name where they are playing.
 * Our own end (home plate / our goal) is at the bottom.
 */
export function FieldDiagram({ sport, positions, inning, names, dim }: Props) {
  return (
    <div className={`field-box ${sport}${dim ? ' dim' : ''}`}>
      {sport === 'soccer' ? <SoccerPitch /> : <BaseballField />}
      <div className="spots">
        {positions.map((pos) => {
          const def = positionDef(pos)
          const pid = inning?.positions[pos] ?? null
          const name = pid ? (names.get(pid) ?? '?') : ''
          return (
            <div
              key={pos}
              className={`spot${name ? '' : ' empty'}`}
              style={{ left: `${def.x}%`, top: `${def.y}%` }}
              title={`${positionLabel(pos)}${name ? `: ${name}` : ' — nobody assigned'}`}
            >
              <span className="spot-pos">{pos}</span>
              <span className="spot-name">{name || '—'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BaseballField() {
  return (
    <svg className="field-art" viewBox="0 0 100 100" aria-hidden focusable="false">
      <rect x="0" y="0" width="100" height="100" fill="var(--turf-dark)" />
      {/* Fair territory: the foul lines out from home plate, closed by the outfield fence. */}
      <path d="M 50 92 L 6 48 Q 50 -30 94 48 Z" fill="var(--turf)" stroke="var(--chalk)" strokeWidth="0.6" />
      {/* Infield dirt, then the base paths on top of it. */}
      <path d="M 50 99 L 85 66 L 50 33 L 15 66 Z" fill="var(--clay)" />
      <path d="M 50 92 L 76 66 L 50 40 L 24 66 Z" fill="none" stroke="var(--chalk)" strokeWidth="0.8" />
      <circle cx="50" cy="66" r="6" fill="var(--clay-light)" />
      {[
        [76, 66],
        [50, 40],
        [24, 66],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x - 2} y={y - 2} width="4" height="4" fill="#fff" transform={`rotate(45 ${x} ${y})`} />
      ))}
      <path d="M 47 90 L 53 90 L 53 93 L 50 95.5 L 47 93 Z" fill="#fff" />
    </svg>
  )
}

/**
 * Drawn in a 72x100 box so it matches the aspect ratio of `.field-box.soccer`:
 * the art then fills the box exactly and the name chips, which are placed in
 * percentages of the box, land where the lines are.
 */
function SoccerPitch() {
  return (
    <svg className="field-art" viewBox="0 0 72 100" aria-hidden focusable="false">
      <rect x="0" y="0" width="72" height="100" fill="var(--turf)" />
      {[0, 2, 4, 6].map((i) => (
        <rect key={i} x="0" y={3 + i * 11.75} width="72" height="11.75" fill="var(--turf-dark)" />
      ))}
      <g fill="none" stroke="var(--chalk)" strokeWidth="0.6">
        <rect x="2.5" y="3" width="67" height="94" />
        <line x1="2.5" y1="50" x2="69.5" y2="50" />
        <circle cx="36" cy="50" r="9" />
        {/* Their end at the top, ours at the bottom. */}
        <rect x="16" y="3" width="40" height="15" />
        <rect x="27" y="3" width="18" height="5" />
        <rect x="16" y="82" width="40" height="15" />
        <rect x="27" y="92" width="18" height="5" />
        <rect x="32" y="0.8" width="8" height="2.2" />
        <rect x="32" y="97" width="8" height="2.2" />
      </g>
      <g fill="var(--chalk)">
        <circle cx="36" cy="50" r="0.8" />
        <circle cx="36" cy="13" r="0.8" />
        <circle cx="36" cy="87" r="0.8" />
      </g>
    </svg>
  )
}
