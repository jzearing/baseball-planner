import type { Violation } from '../lib/types'
import { periodTitle } from '../lib/positions'

export function ViolationList({ violations, hasPlan, periodName }: { violations: Violation[]; hasPlan: boolean; periodName: string }) {
  if (!hasPlan) return null
  if (violations.length === 0) {
    return (
      <section className="violations ok">
        <strong>✓ All enabled constraints are satisfied.</strong>
      </section>
    )
  }
  const unique = new Map<string, Violation>()
  for (const v of violations) unique.set(`${v.constraintId}|${v.message}`, v)
  const list = [...unique.values()].sort((a, b) => (a.inning ?? 99) - (b.inning ?? 99))
  return (
    <section className="violations">
      <strong>
        ⚠ {list.length} constraint problem{list.length === 1 ? '' : 's'}
      </strong>
      <ul>
        {list.map((v, i) => (
          <li key={i}>
            {v.inning !== undefined && <span className="muted">{periodTitle(periodName, v.inning)}: </span>}
            {v.message} <span className="muted">({v.constraintName})</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
