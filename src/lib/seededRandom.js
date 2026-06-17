// Deterministic, dependency-free randomness so every operation is reproducible.
// The same seed always yields the same sequence — this is the backbone of the
// engine's "same recipe → same pixels" correctness guarantee.

/** FNV-1a string hash → unsigned 32-bit int. */
export function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Mulberry32 PRNG. Returns a function producing floats in [0, 1). */
export function makeRng(seed) {
  let a = seed >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministically pick an element of `arr` using rng. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)]
}

/** Clamp a value into the [0, 255] byte range. */
export function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

/** Clamp a value into an arbitrary [min, max] range. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v
}
