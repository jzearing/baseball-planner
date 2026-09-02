import { useEffect, useRef, useState } from 'react'

export interface MultiSelectOption {
  value: string
  label: string
}

interface Props {
  options: MultiSelectOption[]
  selected: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  /** Word used in the "N selected" summary, e.g. "players". */
  noun?: string
}

/** A dropdown button that opens a list of checkboxes. */
export function MultiSelect({ options, selected, onChange, placeholder = 'Select…', noun = 'selected' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false)
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const set = new Set(selected)
  const chosen = options.filter((o) => set.has(o.value))
  let summary = placeholder
  if (chosen.length === options.length && options.length > 0) summary = `All ${noun}`
  else if (chosen.length > 3) summary = `${chosen.length} ${noun}`
  else if (chosen.length > 0) summary = chosen.map((o) => o.label).join(', ')

  const toggle = (value: string) => {
    onChange(set.has(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  return (
    <div className={`multiselect${open ? ' open' : ''}`} ref={ref}>
      <button type="button" className="multiselect-button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="multiselect-summary">{summary}</span>
        <span className="multiselect-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="multiselect-menu" role="listbox">
          {options.length === 0 && <div className="multiselect-empty">Nothing to choose from yet</div>}
          {options.length > 1 && (
            <div className="multiselect-actions">
              <button type="button" className="link" onClick={() => onChange(options.map((o) => o.value))}>
                All
              </button>
              <button type="button" className="link" onClick={() => onChange([])}>
                None
              </button>
            </div>
          )}
          {options.map((o) => (
            <label key={o.value} className="multiselect-item">
              <input type="checkbox" checked={set.has(o.value)} onChange={() => toggle(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
