import { useState, type DragEvent } from 'react'
import type { Action } from '../state'

export type DragItem =
  | { kind: 'cell'; inning: number; index: number }
  | { kind: 'inning'; index: number }
  | { kind: 'batter'; index: number }

export type DropTarget = DragItem
export type DropZone = 'before' | 'after' | 'on'

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

/** Insert axis for a target: inning headers sit side by side, everything else is vertical. */
function axisOf(target: DropTarget): 'x' | 'y' {
  return target.kind === 'inning' ? 'x' : 'y'
}

/**
 * Where over the target the pointer is: near the leading edge (insert before),
 * near the trailing edge (insert after), or in the middle (swap).
 */
export function zoneFromRect(rect: DOMRect, x: number, y: number, axis: 'x' | 'y'): DropZone {
  const frac = axis === 'y' ? (y - rect.top) / rect.height : (x - rect.left) / rect.width
  if (frac < 0.25) return 'before'
  if (frac > 0.75) return 'after'
  return 'on'
}

/** Can `item` be dropped on `target` at all? */
export function compatible(item: DragItem, target: DropTarget): boolean {
  return item.kind === target.kind
}

function crossInning(item: DragItem, target: DropTarget): boolean {
  return item.kind === 'cell' && target.kind === 'cell' && item.inning !== target.inning
}

function sameSlot(item: DragItem, target: DropTarget): boolean {
  if (!compatible(item, target) || crossInning(item, target)) return false
  return item.index === target.index
}

/** Across innings only a swap makes sense, so the whole cell acts as the swap zone. */
function effectiveZone(item: DragItem, target: DropTarget, zone: DropZone): DropZone {
  return crossInning(item, target) ? 'on' : zone
}

/** The state change a drop produces, or null when it would be a no-op. */
export function dropAction(item: DragItem, target: DropTarget, rawZone: DropZone): Action | null {
  if (!compatible(item, target)) return null
  if (item.kind === 'cell' && target.kind === 'cell' && item.inning !== target.inning) {
    return { type: 'swap-across', fromInning: item.inning, fromIndex: item.index, toInning: target.inning, toIndex: target.index }
  }
  const zone = effectiveZone(item, target, rawZone)
  const insertBefore = zone === 'before' ? target.index : target.index + 1
  if (zone === 'on') {
    if (item.index === target.index) return null
    switch (target.kind) {
      case 'cell':
        return { type: 'swap-cell', inning: target.inning, a: item.index, b: target.index }
      case 'inning':
        return { type: 'swap-innings', a: item.index, b: target.index }
      case 'batter':
        return { type: 'swap-batters', a: item.index, b: target.index }
    }
  }
  switch (target.kind) {
    case 'cell':
      return { type: 'move-cell', inning: target.inning, from: item.index, insertBefore }
    case 'inning':
      return { type: 'move-inning', from: item.index, insertBefore }
    case 'batter':
      return { type: 'move-batter', from: item.index, insertBefore }
  }
}

/** Data attributes that let the touch handler recognise a drag source / drop target. */
export function dropAttrs(target: DropTarget, draggable: boolean): Record<string, string> {
  const attrs: Record<string, string> = { 'data-drop': target.kind, 'data-index': String(target.index) }
  if (target.kind === 'cell') attrs['data-inning'] = String(target.inning)
  if (!draggable) attrs['data-nodrag'] = '1'
  return attrs
}

function readTarget(el: HTMLElement): DropTarget | null {
  const kind = el.dataset.drop
  const index = Number(el.dataset.index)
  if (!Number.isInteger(index)) return null
  if (kind === 'cell') {
    const inning = Number(el.dataset.inning)
    return Number.isInteger(inning) ? { kind, inning, index } : null
  }
  if (kind === 'inning' || kind === 'batter') return { kind, index }
  return null
}

/** Mouse (HTML5) drag-and-drop handlers for one drop target. */
export function useDropTarget(target: DropTarget, dispatch: (a: Action) => void) {
  const [zone, setZone] = useState<DropZone | null>(null)
  const zoneOf = (e: DragEvent) => zoneFromRect(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY, axisOf(target))
  return {
    zone,
    onDragOver(e: DragEvent) {
      const d = currentDrag()
      if (!d || !compatible(d, target)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const z = effectiveZone(d, target, zoneOf(e))
      setZone(sameSlot(d, target) && z === 'on' ? null : z)
    },
    onDragLeave() {
      setZone(null)
    },
    onDrop(e: DragEvent) {
      e.preventDefault()
      const d = currentDrag()
      setZone(null)
      if (!d) return
      const action = dropAction(d, target, zoneOf(e))
      if (action) dispatch(action)
      endDrag()
    },
    onDragEnd: endDrag,
  }
}

const ZONE_CLASSES = ['zone-before', 'zone-after', 'zone-on']
const HOLD_MS = 220
const MOVE_TOLERANCE = 10
const EDGE_PX = 48
const SCROLL_STEP = 10

/** Nearest ancestor that can scroll sideways (the plan table wrapper). */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let n = el; n; n = n.parentElement) {
    const ov = getComputedStyle(n).overflowX
    if ((ov === 'auto' || ov === 'scroll') && n.scrollWidth > n.clientWidth) return n
  }
  return null
}

/**
 * Touch drag-and-drop. Native HTML5 drag events never fire on touch screens, so
 * this watches for a press-and-hold on any `[data-drop]` element, then follows
 * the finger, highlights the element underneath and performs the same drop
 * actions as the mouse path. A quick swipe still scrolls normally.
 */
export function installTouchDnd(root: HTMLElement, dispatch: (a: Action) => void): () => void {
  let timer: number | null = null
  let item: DragItem | null = null
  let source: HTMLElement | null = null
  let ghost: HTMLElement | null = null
  let highlighted: HTMLElement | null = null
  let pending: { target: DropTarget; zone: DropZone } | null = null
  let startX = 0
  let startY = 0
  let lastX = 0
  let lastY = 0
  let raf: number | null = null
  let scroller: HTMLElement | null = null

  /** While dragging near an edge, keep scrolling so far-away targets can be reached. */
  const autoScroll = () => {
    raf = null
    if (!item) return
    let moved = false
    if (scroller) {
      const r = scroller.getBoundingClientRect()
      if (lastX > r.right - EDGE_PX && scroller.scrollLeft < scroller.scrollWidth - scroller.clientWidth) {
        scroller.scrollLeft += SCROLL_STEP
        moved = true
      } else if (lastX < r.left + EDGE_PX && scroller.scrollLeft > 0) {
        scroller.scrollLeft -= SCROLL_STEP
        moved = true
      }
    }
    if (lastY > window.innerHeight - EDGE_PX) {
      window.scrollBy(0, SCROLL_STEP)
      moved = true
    } else if (lastY < EDGE_PX && window.scrollY > 0) {
      window.scrollBy(0, -SCROLL_STEP)
      moved = true
    }
    if (moved) updateTarget(lastX, lastY)
    raf = window.requestAnimationFrame(autoScroll)
  }

  const cancelTimer = () => {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
  }
  const clearHighlight = () => {
    highlighted?.classList.remove(...ZONE_CLASSES)
    highlighted = null
    pending = null
  }
  const finish = () => {
    cancelTimer()
    if (raf !== null) window.cancelAnimationFrame(raf)
    raf = null
    scroller = null
    clearHighlight()
    source?.classList.remove('touch-dragging')
    ghost?.remove()
    ghost = null
    item = null
    source = null
    document.body.classList.remove('touch-drag-active')
  }
  const moveGhost = (x: number, y: number) => {
    if (!ghost) return
    ghost.style.transform = `translate(${x + 12}px, ${y - 18}px)`
  }

  const onStart = (e: TouchEvent) => {
    if (e.touches.length !== 1 || item) return
    const t = e.target as Element
    if (t.closest('button, input, select, textarea, a')) return
    const el = t.closest<HTMLElement>('[data-drop]')
    if (!el || el.dataset.nodrag === '1') return
    const target = readTarget(el)
    if (!target) return
    startX = e.touches[0].clientX
    startY = e.touches[0].clientY
    cancelTimer()
    timer = window.setTimeout(() => {
      timer = null
      item = target
      source = el
      el.classList.add('touch-dragging')
      document.body.classList.add('touch-drag-active')
      ghost = document.createElement('div')
      ghost.className = 'touch-ghost'
      ghost.textContent = el.querySelector('.name')?.textContent ?? el.textContent ?? ''
      document.body.appendChild(ghost)
      moveGhost(startX, startY)
      lastX = startX
      lastY = startY
      scroller = scrollParent(el)
      raf = window.requestAnimationFrame(autoScroll)
    }, HOLD_MS)
  }

  const updateTarget = (x: number, y: number) => {
    if (!item) return
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]') ?? null
    const target = el ? readTarget(el) : null
    if (!el || !target || !compatible(item, target)) {
      clearHighlight()
      return
    }
    const zone = effectiveZone(item, target, zoneFromRect(el.getBoundingClientRect(), x, y, axisOf(target)))
    if (sameSlot(item, target) && zone === 'on') {
      clearHighlight()
      return
    }
    if (highlighted !== el) clearHighlight()
    el.classList.remove(...ZONE_CLASSES)
    el.classList.add(`zone-${zone}`)
    highlighted = el
    pending = { target, zone }
  }

  const onMove = (e: TouchEvent) => {
    const t = e.touches[0]
    if (!t) return
    if (!item) {
      if (timer !== null && Math.hypot(t.clientX - startX, t.clientY - startY) > MOVE_TOLERANCE) cancelTimer()
      return
    }
    e.preventDefault() // we are dragging: do not scroll
    lastX = t.clientX
    lastY = t.clientY
    moveGhost(lastX, lastY)
    updateTarget(lastX, lastY)
  }

  const onEnd = () => {
    if (item && pending) {
      const action = dropAction(item, pending.target, pending.zone)
      if (action) dispatch(action)
    }
    finish()
  }

  const onContextMenu = (e: Event) => {
    // A long press opens the context menu on Android; not while we are dragging.
    if (item || timer !== null) e.preventDefault()
  }

  root.addEventListener('touchstart', onStart, { passive: true })
  root.addEventListener('touchmove', onMove, { passive: false })
  root.addEventListener('touchend', onEnd)
  root.addEventListener('touchcancel', finish)
  root.addEventListener('contextmenu', onContextMenu)
  return () => {
    finish()
    root.removeEventListener('touchstart', onStart)
    root.removeEventListener('touchmove', onMove)
    root.removeEventListener('touchend', onEnd)
    root.removeEventListener('touchcancel', finish)
    root.removeEventListener('contextmenu', onContextMenu)
  }
}
