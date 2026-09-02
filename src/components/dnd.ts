import type { DragEvent } from 'react'

export type DragItem =
  | { kind: 'cell'; inning: number; index: number }
  | { kind: 'inning'; index: number }
  | { kind: 'batter'; index: number }

/** Only one drag happens at a time, so a module-level slot is enough. */
let current: DragItem | null = null

export function startDrag(e: DragEvent, item: DragItem): void {
  current = item
  e.dataTransfer.effectAllowed = 'move'
  // Firefox refuses to start a drag without data.
  e.dataTransfer.setData('text/plain', JSON.stringify(item))
}

export function endDrag(): void {
  current = null
}

export function currentDrag(): DragItem | null {
  return current
}

export type DropZone = 'before' | 'after' | 'on'

/**
 * Where over the target the pointer is: near the leading edge (insert before),
 * near the trailing edge (insert after), or in the middle (swap).
 */
export function dropZone(e: DragEvent, axis: 'x' | 'y'): DropZone {
  const rect = e.currentTarget.getBoundingClientRect()
  const frac = axis === 'y' ? (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width
  if (frac < 0.25) return 'before'
  if (frac > 0.75) return 'after'
  return 'on'
}
