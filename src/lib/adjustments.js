// Pure helpers for the "adjust" operation. No DOM/canvas here so this module
// is fully unit-testable in Node.

import { clamp } from './seededRandom.js'

export const defaultAdjustments = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  grayscale: 0,
  sepia: 0,
  hue: 0,
  blur: 0,
  invert: 0
}

// Valid range for each adjustment, used for clamping untrusted/serialized input.
export const adjustmentRanges = {
  brightness: [0, 400],
  contrast: [0, 400],
  saturate: [0, 400],
  grayscale: [0, 100],
  sepia: [0, 100],
  hue: [0, 360],
  blur: [0, 100],
  invert: [0, 100]
}

/** Returns true if the adjustments are all at their no-op defaults. */
export function isIdentityAdjustment(a) {
  return Object.keys(defaultAdjustments).every(
    (k) => Number(a[k]) === defaultAdjustments[k]
  )
}

/** Clamp every field into its valid range and coerce to numbers. */
export function normalizeAdjustments(a) {
  const out = {}
  for (const key of Object.keys(defaultAdjustments)) {
    const [min, max] = adjustmentRanges[key]
    const value = a[key] === undefined ? defaultAdjustments[key] : Number(a[key])
    out[key] = clamp(Number.isFinite(value) ? value : defaultAdjustments[key], min, max)
  }
  return out
}

/**
 * Build a CSS/Canvas filter string from an adjustments object.
 * Works identically for `element.style.filter` (live preview) and
 * `ctx.filter` (baked render) — one source of truth, so preview and output
 * can never diverge.
 */
export function adjustmentsToFilter(a) {
  const n = normalizeAdjustments(a)
  return [
    `brightness(${n.brightness}%)`,
    `contrast(${n.contrast}%)`,
    `saturate(${n.saturate}%)`,
    `grayscale(${n.grayscale}%)`,
    `sepia(${n.sepia}%)`,
    `hue-rotate(${n.hue}deg)`,
    `blur(${n.blur}px)`,
    `invert(${n.invert}%)`
  ].join(' ')
}
