// ---------------------------------------------------------------------------
// Non-destructive editing model.
//
// A *document* is an immutable `source` plus an ordered list of `ops` (the
// "recipe"). The visible image is always a pure function of (source, ops):
//
//     image = render(source, ops)
//
// Nothing is ever baked until export. This is what lets us toggle, reorder,
// delete, or re-tune any edit at any time — the same advantage Lightroom and
// Luminar Neo build their workflows around — while keeping undo history tiny
// (a few hundred bytes of JSON instead of multi-megabyte base64 snapshots).
//
// Everything in this file is pure and DOM-free, so it is fully unit-tested.
// The actual pixel rendering lives in renderEngine.js.
// ---------------------------------------------------------------------------

import { defaultAdjustments, normalizeAdjustments } from './adjustments.js'
import { hashString } from './seededRandom.js'

export const OP_TYPES = {
  adjust: 'adjust',
  rotate: 'rotate',
  flip: 'flip',
  removeBackground: 'removeBackground',
  generative: 'generative'
}

// Human-readable metadata for the edit-stack UI.
export const OP_META = {
  adjust: { label: 'Adjustments', icon: '🎛️' },
  rotate: { label: 'Rotate', icon: '↻' },
  flip: { label: 'Flip', icon: '⇋' },
  removeBackground: { label: 'Remove background', icon: '✂️' },
  generative: { label: 'Generative edit', icon: '🪄' }
}

let opCounter = 0
/** Monotonic id generator (seedable for deterministic tests). */
export function nextOpId() {
  opCounter += 1
  return `op_${opCounter}`
}
export function __resetOpIds() {
  opCounter = 0
}

// --- Source factories ------------------------------------------------------

/**
 * A "generated" source stores only its generation params, never pixels — so it
 * is reproducible and costs nothing to keep in history.
 */
export function makeGeneratedSource(prompt, { width = 768, height = 768 } = {}) {
  return { kind: 'generated', prompt, width, height }
}

/** An "uploaded" source must keep its pixels (we can't regenerate them). */
export function makeUploadedSource(dataURL, { width, height } = {}) {
  return { kind: 'uploaded', dataURL, width, height }
}

// --- Op factories ----------------------------------------------------------

export function makeAdjustOp(params = {}) {
  return {
    id: nextOpId(),
    type: OP_TYPES.adjust,
    enabled: true,
    params: normalizeAdjustments({ ...defaultAdjustments, ...params })
  }
}

export function makeRotateOp(degrees) {
  return { id: nextOpId(), type: OP_TYPES.rotate, enabled: true, params: { degrees } }
}

export function makeFlipOp(axis /* 'h' | 'v' */) {
  return { id: nextOpId(), type: OP_TYPES.flip, enabled: true, params: { axis } }
}

export function makeRemoveBackgroundOp(tolerance = 40) {
  return {
    id: nextOpId(),
    type: OP_TYPES.removeBackground,
    enabled: true,
    params: { tolerance }
  }
}

export function makeGenerativeOp(prompt) {
  return { id: nextOpId(), type: OP_TYPES.generative, enabled: true, params: { prompt } }
}

// --- Immutable recipe transforms (return new arrays) -----------------------

export function addOp(ops, op) {
  return [...ops, op]
}

export function removeOp(ops, id) {
  return ops.filter((o) => o.id !== id)
}

export function toggleOp(ops, id) {
  return ops.map((o) => (o.id === id ? { ...o, enabled: !o.enabled } : o))
}

export function updateOpParams(ops, id, params) {
  return ops.map((o) => (o.id === id ? { ...o, params: { ...o.params, ...params } } : o))
}

/** Move the op at `index` by `delta` (clamped). Returns a new array. */
export function moveOp(ops, index, delta) {
  const target = index + delta
  if (index < 0 || index >= ops.length || target < 0 || target >= ops.length) {
    return ops
  }
  const next = [...ops]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  return next
}

/**
 * Collapse consecutive enabled `adjust` ops into one for rendering efficiency:
 * stacking N CSS-filter passes is wasteful and compounds rounding error, so we
 * keep only the most recent adjust in any consecutive run (its params already
 * represent the user's intended final state for that layer).
 */
export function optimizeOps(ops) {
  const out = []
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    const last = out[out.length - 1]
    if (
      op.type === OP_TYPES.adjust &&
      last &&
      last.type === OP_TYPES.adjust &&
      op.enabled &&
      last.enabled
    ) {
      out[out.length - 1] = op // keep the later adjust, drop the earlier
    } else {
      out.push(op)
    }
  }
  return out
}

// --- Serialization & identity ----------------------------------------------

/** Stable JSON of the full document (used for caching + persistence). */
export function serializeDocument(doc) {
  return JSON.stringify({ source: doc.source, ops: doc.ops })
}

export function deserializeDocument(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json
  return { source: parsed.source, ops: parsed.ops || [] }
}

/**
 * A deterministic cache key for a document up to (and including) op index `n`.
 * Two documents with the same key always render to the same pixels, so the
 * render layer can safely memoize on it.
 */
export function recipeKey(source, ops, n = ops.length) {
  const enabled = ops.slice(0, n).filter((o) => o.enabled)
  return hashString(JSON.stringify({ source, ops: enabled })).toString(16)
}
