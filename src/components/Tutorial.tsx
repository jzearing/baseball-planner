import { useEffect } from 'react'

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Add your players',
    body: 'Type names into the Players list on the left, or paste a whole list. Untick anyone who is absent to leave them out of the plan without deleting them.',
  },
  {
    title: 'Set up the game',
    body: 'Pick the sport. Baseball plans innings with a batting order; soccer plans halves or quarters with formations like 7v7 or 11v11. Choose the game length and which positions are on the field, or tap a preset.',
  },
  {
    title: 'Pick the rules',
    body: 'Tick the rules you want on the right and adjust their numbers. Add rules for who may catch or pitch, or which positions a player can play. Tick the exemption on a catcher or pitcher rule so those players can repeat. The rule list is in priority order: when the rules cannot all be met, rules nearer the top are satisfied first, so drag the ⋮⋮ handle to reorder them. The Preferences tab holds softer wishes, like a player who would like to play shortstop, which the solver honours when the rules allow.',
  },
  {
    title: 'Randomize the lineup',
    body: 'Hit Randomize lineup. The planner fills inning 1 first and works forward, so if every rule cannot be met the trouble lands in the later innings.',
  },
  {
    title: 'Adjust by dragging',
    body: 'Drag a name onto another to swap them. Drop it between two rows to slide it in and shift the others down. Drop a name onto a name in a different inning or quarter to trade those two players in both. Drag the column headers to reorder. On a phone, press and hold a name, then drag.',
  },
  {
    title: 'Watch for warnings',
    body: 'After every change the rules are re-checked. A highlighted name with a ⚠ breaks a rule; hover or tap the icon to see which one.',
  },
  {
    title: 'Lock and randomize again',
    body: 'Use the 🔒 on a name to keep that player where they are. Randomize lineup always leaves locked players in place and re-solves everyone else around them. Unlock all clears the locks.',
  },
  {
    title: 'Batting order (baseball)',
    body: 'The batting order sits under the field table. Shuffle it, or drag names to swap or insert just like on the field. Lock a batter to keep them in their spot when you shuffle.',
  },
  {
    title: 'Game view on game day',
    body:
      'Fill in your team and the opponent under Game, then hit Game view for a full-screen dugout display: a scoreboard by ' +
      'inning or quarter, the field with every name in position, and big buttons to add runs or goals. ' +
      'Tap a box on the scoreboard to move the game to that inning or quarter — for baseball each row is one team, so tapping their ' +
      'row picks the top half and yours the bottom — or drag sideways to pull the next half-inning into view and let go to move there. For baseball, say whether ' +
      'you are home or away and the batting order shows who is up; tap a name to put that batter at the plate. On a phone the field and ' +
      'the batting order take turns, whichever the half is about. The score is saved as you go, so you can lock the screen and come back.',
  },
  {
    title: 'Print, share and save',
    body: 'Print a one-page landscape sheet, Share image to text a picture to another coach, or Export CSV. Everything is saved in this browser automatically. Share link or QR code sends the whole editable setup to someone else; Export and Import JSON keep a file copy.',
  },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function Tutorial({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-backdrop no-print" onClick={onClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="tutorial-title">How to use Lineup Planner</h2>
        <ol className="tutorial-steps">
          {STEPS.map((s) => (
            <li key={s.title}>
              <strong>{s.title}.</strong> {s.body}
            </li>
          ))}
        </ol>
        <div className="row modal-actions">
          <span className="muted small">You can reopen this any time with the Help button.</span>
          <span className="spacer" />
          <button type="button" className="primary" onClick={onClose} autoFocus>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
