import type { AppState } from './types'
import { benchRowCount, columnList } from './plan'

function cell(text: string): string {
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function planToCsv(state: AppState): string {
  const names = new Map(state.players.map((p) => [p.id, p.name]))
  const name = (id: string | null) => (id ? (names.get(id) ?? '') : '')
  const rows: string[][] = []
  if (state.gameTitle) rows.push([state.gameTitle])
  rows.push(['Position', ...state.plan.map((_, i) => `Inning ${i + 1}`)])
  const benchRows = benchRowCount(state)
  const columns = state.plan.map((inn) => columnList(inn, state.positions, benchRows))
  const labels = [...state.positions, ...Array(benchRows).fill('Bench')]
  labels.forEach((label, r) => rows.push([label, ...columns.map((col) => name(col[r] ?? null))]))
  rows.push([])
  rows.push(['Batting order'])
  state.battingOrder.forEach((pid, i) => rows.push([String(i + 1), name(pid)]))
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}
