import type { AppState } from './types'
import { coerceState } from './storage'

/**
 * Share links carry the whole setup in the URL fragment as
 * `#s=<v>.<base64url>` where v is 1 for deflate-compressed JSON and 0 for
 * plain JSON (used when the browser lacks CompressionStream). The fragment is
 * never sent to a server.
 */
const PREFIX = 's='

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function pipe(bytes: Uint8Array, stream: ReadableWritablePair<Uint8Array, BufferSource>): Promise<Uint8Array> {
  const src = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(src).arrayBuffer())
}

/** Strip transient bits so the link stays short. */
function shareable(state: AppState): AppState {
  return { ...state }
}

/** Build the fragment (without the leading '#') that encodes the state. */
export async function encodeShareFragment(state: AppState): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(shareable(state)))
  if (typeof CompressionStream === 'function') {
    try {
      const packed = await pipe(json, new CompressionStream('deflate-raw'))
      return `${PREFIX}1.${toBase64Url(packed)}`
    } catch {
      // fall through to plain encoding
    }
  }
  return `${PREFIX}0.${toBase64Url(json)}`
}

/** Decode a fragment produced by encodeShareFragment; null when it is not a share link. */
export async function decodeShareFragment(fragment: string): Promise<AppState | null> {
  const raw = fragment.replace(/^#/, '')
  if (!raw.startsWith(PREFIX)) return null
  const body = raw.slice(PREFIX.length)
  const dot = body.indexOf('.')
  if (dot < 0) throw new Error('This share link is not in a format the planner understands.')
  const version = body.slice(0, dot)
  let bytes = fromBase64Url(body.slice(dot + 1))
  if (version === '1') {
    if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot open compressed share links. Try a newer browser.')
    bytes = await pipe(bytes, new DecompressionStream('deflate-raw'))
  } else if (version !== '0') {
    throw new Error('This share link was made by a newer version of the planner.')
  }
  return coerceState(JSON.parse(new TextDecoder().decode(bytes)))
}

export function shareUrl(fragment: string): string {
  return `${location.origin}${location.pathname}${location.search}#${fragment}`
}
