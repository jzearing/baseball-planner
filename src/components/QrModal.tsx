import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

interface Props {
  url: string | null
  title: string
  onClose: () => void
}

/**
 * Shows the share link as a QR code another coach can scan with their phone camera.
 * Mount it with `key={url}` so its state resets whenever the link changes.
 */
export function QrModal({ url, title, onClose }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!url) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [url, onClose])

  useEffect(() => {
    if (!url || !canvas.current) return
    // Medium error correction copes with screen glare when one phone scans another, and an
    // integer scale keeps every module the same size, which scanners need on a dense code.
    QRCode.toCanvas(canvas.current, url, { errorCorrectionLevel: 'M', margin: 2, scale: 4 }).catch((err: unknown) => {
      setError(
        err instanceof Error && /too big|data too long|capacity/i.test(err.message)
          ? 'This setup is too large to fit in a QR code. Use Share link or Export JSON instead.'
          : `Could not draw the QR code: ${err instanceof Error ? err.message : String(err)}`,
      )
    })
  }, [url])

  if (!url) return null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="modal-backdrop no-print" onClick={onClose} role="presentation">
      <div className="modal qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="qr-title">Scan to open {title || 'this lineup'}</h2>
        <p className="muted small">Point a phone camera at the code. It opens an editable copy of the whole setup; nothing is uploaded anywhere.</p>
        {error ? <p className="notice">{error}</p> : <canvas ref={canvas} className="qr-canvas" aria-label="QR code for the share link" />}
        <div className="row modal-actions">
          <button type="button" className="secondary" onClick={() => void copy()}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <span className="spacer" />
          <button type="button" className="primary" onClick={onClose} autoFocus>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
