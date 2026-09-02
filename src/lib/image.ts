import type { AppState } from './types'
import { benchRowCount, columnList } from './plan'
import { positionDef, positionLabel, type PositionGroup } from './positions'

/** Fill colours per position group, chosen to stay readable on a phone screen. */
const GROUP_FILL: Record<PositionGroup | 'bench', string> = {
  battery: '#dbeafe',
  infield: '#dcfce7',
  outfield: '#fef9c3',
  bench: '#e5e7eb',
}
const HEADER_FILL = '#1d5c3a'
const INK = '#1f2a24'
const LINE = '#9aa39d'

/** Draw the plan and batting order to a PNG blob. */
export function renderPlanImage(state: AppState): Promise<Blob> {
  const names = new Map(state.players.map((p) => [p.id, p.name]))
  const name = (id: string | null) => (id ? (names.get(id) ?? '') : '')
  const benchRows = benchRowCount(state)
  const columns = state.plan.map((inn) => columnList(inn, state.positions, benchRows))
  const rows = state.positions.length + benchRows
  const innings = state.plan.length

  const scale = 2
  const pad = 24
  const titleH = state.gameTitle ? 44 : 0
  const rowH = 34
  const headH = 38
  const labelW = 150
  const cellW = Math.max(110, Math.min(160, 900 / Math.max(1, innings)))
  const battingW = 200
  const gap = 28
  const tableW = labelW + cellW * innings
  const battingRows = state.battingOrder.length
  const width = pad * 2 + tableW + gap + battingW
  const height = pad * 2 + titleH + headH + Math.max(rows, battingRows) * rowH

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas is not available'))
  ctx.scale(scale, scale)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.textBaseline = 'middle'

  const font = (size: number, weight = 400) => {
    ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
  }
  const text = (s: string, x: number, y: number, maxW: number) => {
    let out = s
    while (out.length > 1 && ctx.measureText(out).width > maxW) out = out.slice(0, -2) + '…'
    ctx.fillText(out, x, y)
  }

  let y = pad
  if (state.gameTitle) {
    ctx.fillStyle = INK
    font(24, 700)
    text(state.gameTitle, pad, y + 16, width - pad * 2)
    y += titleH
  }

  // Header row
  const tableX = pad
  ctx.fillStyle = HEADER_FILL
  ctx.fillRect(tableX, y, tableW, headH)
  ctx.fillStyle = '#ffffff'
  font(15, 700)
  text('Position', tableX + 10, y + headH / 2, labelW - 16)
  for (let i = 0; i < innings; i++) {
    text(`Inning ${i + 1}`, tableX + labelW + i * cellW + 10, y + headH / 2, cellW - 16)
  }
  y += headH

  // Body rows
  for (let r = 0; r < rows; r++) {
    const pos = r < state.positions.length ? state.positions[r] : null
    const group = pos ? positionDef(pos).group : 'bench'
    const rowY = y + r * rowH
    ctx.fillStyle = GROUP_FILL[group]
    ctx.fillRect(tableX, rowY, tableW, rowH)
    ctx.fillStyle = INK
    font(15, 700)
    text(pos ?? 'Bench', tableX + 10, rowY + rowH / 2, pos ? 40 : labelW - 16)
    if (pos) {
      font(12, 400)
      ctx.fillStyle = '#4b5550'
      text(positionLabel(pos), tableX + 52, rowY + rowH / 2, labelW - 60)
    }
    ctx.fillStyle = INK
    font(16, 500)
    columns.forEach((col, i) => {
      const n = name(col[r] ?? null)
      text(n || '—', tableX + labelW + i * cellW + 10, rowY + rowH / 2, cellW - 16)
    })
  }

  // Grid lines
  ctx.strokeStyle = LINE
  ctx.lineWidth = 1
  const tableTop = y - headH
  const tableBottom = y + rows * rowH
  for (let r = 0; r <= rows; r++) {
    const ly = y + r * rowH + 0.5
    ctx.beginPath()
    ctx.moveTo(tableX, ly)
    ctx.lineTo(tableX + tableW, ly)
    ctx.stroke()
  }
  for (let i = 0; i <= innings + 1; i++) {
    const lx = (i === 0 ? tableX : tableX + labelW + (i - 1) * cellW) + 0.5
    ctx.beginPath()
    ctx.moveTo(lx, tableTop)
    ctx.lineTo(lx, tableBottom)
    ctx.stroke()
  }
  ctx.strokeRect(tableX + 0.5, tableTop + 0.5, tableW - 1, tableBottom - tableTop - 1)

  // Batting order
  const bx = tableX + tableW + gap
  ctx.fillStyle = HEADER_FILL
  ctx.fillRect(bx, tableTop, battingW, headH)
  ctx.fillStyle = '#ffffff'
  font(15, 700)
  text('Batting order', bx + 10, tableTop + headH / 2, battingW - 16)
  state.battingOrder.forEach((pid, i) => {
    const rowY = y + i * rowH
    ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f3f4f6'
    ctx.fillRect(bx, rowY, battingW, rowH)
    ctx.fillStyle = HEADER_FILL
    font(15, 700)
    text(`${i + 1}.`, bx + 10, rowY + rowH / 2, 30)
    ctx.fillStyle = INK
    font(16, 500)
    text(name(pid), bx + 42, rowY + rowH / 2, battingW - 50)
  })
  ctx.strokeRect(bx + 0.5, tableTop + 0.5, battingW - 1, headH + battingRows * rowH - 1)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not render the image'))), 'image/png')
  })
}
