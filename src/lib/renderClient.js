// Main-thread orchestrator for rendering.
//
// Efficiency systems implemented here:
//   1. Off-main-thread:   work runs in a Web Worker (OffscreenCanvas) when
//                         available, so the UI thread stays at 60fps.
//   2. Latest-wins:       rapid edits (slider drags) supersede in-flight
//                         renders; stale results are dropped, never painted.
//   3. Memoization:       identical recipes (e.g. undo→redo) return the cached
//                         bitmap instantly without re-rendering.
//   4. Graceful fallback: when Worker/OffscreenCanvas is unavailable, the very
//                         same pipeline runs synchronously on the main thread.

import { renderDocument } from './renderEngine.js'
import { recipeKey } from './recipe.js'

const STALE = { stale: true }

function supportsWorker() {
  return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
}

// DOM-based environment for the main-thread fallback and for exporting.
const domEnv = {
  createCanvas: (w, h) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  },
  decodeSource: (source) =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve({ drawable: img, width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => reject(new Error('Failed to decode image'))
      img.src = source.dataURL
    })
}

export class RenderClient {
  constructor() {
    this.seq = 0
    this.lastKey = null
    this.lastResult = null
    this.worker = null
    this.pending = new Map()

    if (supportsWorker()) {
      try {
        this.worker = new Worker(new URL('../workers/render.worker.js', import.meta.url), {
          type: 'module'
        })
        this.worker.onmessage = (e) => this._onMessage(e)
        this.worker.onerror = () => this._failAll()
      } catch {
        this.worker = null
      }
    }
  }

  get usingWorker() {
    return !!this.worker
  }

  _onMessage(e) {
    const { id, ok, bitmap, error } = e.data
    const entry = this.pending.get(id)
    if (!entry) return
    this.pending.delete(id)
    if (id !== this.seq) {
      // A newer render superseded this one — drop it.
      if (bitmap && bitmap.close) bitmap.close()
      entry.resolve(STALE)
      return
    }
    if (ok) {
      const result = { drawable: bitmap, width: bitmap.width, height: bitmap.height, key: entry.key }
      this._cache(entry.key, result)
      entry.resolve(result)
    } else {
      entry.reject(new Error(error || 'Render failed'))
    }
  }

  _failAll() {
    for (const [, entry] of this.pending) entry.reject(new Error('Worker error'))
    this.pending.clear()
  }

  _cache(key, result) {
    this.lastKey = key
    this.lastResult = result
  }

  /**
   * Render a document to a drawable (ImageBitmap or canvas).
   * Resolves to { drawable, width, height, key } or the STALE sentinel if a
   * newer request superseded this one.
   */
  async render(doc) {
    const key = recipeKey(doc.source, doc.ops)
    const id = ++this.seq

    if (key === this.lastKey && this.lastResult) {
      return this.lastResult // memoized — no work needed
    }

    if (this.worker) {
      return new Promise((resolve, reject) => {
        this.pending.set(id, { resolve, reject, key })
        this.worker.postMessage({ id, doc })
      })
    }

    // Main-thread fallback.
    const canvas = await renderDocument(doc, domEnv)
    if (id !== this.seq) return STALE
    const result = { drawable: canvas, width: canvas.width, height: canvas.height, key }
    this._cache(key, result)
    return result
  }

  /** Full-resolution export to a PNG blob (always rendered on demand). */
  async exportBlob(doc, type = 'image/png', quality) {
    const canvas = await renderDocument(doc, domEnv)
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality))
  }

  dispose() {
    if (this.worker) this.worker.terminate()
    this.pending.clear()
  }
}

export { STALE }
