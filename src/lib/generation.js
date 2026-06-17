// Pixel-level operations, written against a generic CanvasRenderingContext2D /
// OffscreenCanvasRenderingContext2D. No DOM access, so the exact same code runs
// in a Web Worker (OffscreenCanvas) or on the main thread (fallback).
//
// All randomness is seeded, so every op is deterministic and reproducible.

import { hashString, makeRng, pick, clampByte } from './seededRandom.js'

const PALETTES = [
  ['#0f2027', '#203a43', '#2c5364'],
  ['#42275a', '#734b6d', '#bdc3c7'],
  ['#ff512f', '#dd2476', '#1a2a6c'],
  ['#1d976c', '#93f9b9', '#0f2027'],
  ['#ee9ca7', '#ffdde1', '#614385'],
  ['#7c5cff', '#23d5ab', '#1b1b2f'],
  ['#f7971e', '#ffd200', '#3a1c71'],
  ['#005aa7', '#fffde4', '#43cea2']
]

function hexWithAlpha(hex, alpha) {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Procedurally paint a text-to-image generation onto ctx. Deterministic. */
export function paintGeneration(ctx, prompt, width, height) {
  const seed = hashString(prompt || 'sgimages')
  const rng = makeRng(seed)
  const palette = PALETTES[seed % PALETTES.length]

  const grad = ctx.createLinearGradient(0, 0, width, height)
  grad.addColorStop(0, palette[0])
  grad.addColorStop(0.5, palette[1])
  grad.addColorStop(1, palette[2])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  const orbCount = 5 + Math.floor(rng() * 6)
  for (let i = 0; i < orbCount; i++) {
    const x = rng() * width
    const y = rng() * height
    const r = (0.15 + rng() * 0.35) * Math.min(width, height)
    const radial = ctx.createRadialGradient(x, y, 0, x, y, r)
    const color = pick(rng, palette)
    radial.addColorStop(0, hexWithAlpha(color, 0.55))
    radial.addColorStop(1, hexWithAlpha(color, 0))
    ctx.fillStyle = radial
    ctx.fillRect(0, 0, width, height)
  }

  ctx.globalAlpha = 0.4
  const shapes = 8 + Math.floor(rng() * 10)
  for (let i = 0; i < shapes; i++) {
    ctx.fillStyle = hexWithAlpha(pick(rng, palette), 0.25 + rng() * 0.4)
    const x = rng() * width
    const y = rng() * height
    const s = 20 + rng() * 140
    if (rng() > 0.5) {
      ctx.beginPath()
      ctx.arc(x, y, s / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rng() * Math.PI)
      ctx.fillRect(-s / 2, -s / 2, s, s * (0.4 + rng()))
      ctx.restore()
    }
  }
  ctx.globalAlpha = 1

  addGrain(ctx, width, height, 0.04, seed)
  drawCaption(ctx, prompt, width, height)
}

/**
 * Re-style an already-drawn image (the ctx must already contain it) using a
 * prompt-seeded grade: hue shift + overlay tint + light leaks + grain.
 */
export function paintGenerative(ctx, prompt, width, height) {
  const seed = hashString('edit:' + prompt)
  const rng = makeRng(seed)
  const palette = PALETTES[seed % PALETTES.length]

  // Snapshot current pixels, then redraw them with a hue/saturation shift.
  // (ctx.filter doesn't apply to existing pixels, so we round-trip via a
  // temporary draw using globalCompositeOperation for the grade.)
  ctx.globalCompositeOperation = 'overlay'
  ctx.fillStyle = hexWithAlpha(pick(rng, palette), 0.45)
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < 3; i++) {
    const x = rng() * width
    const y = rng() * height
    const r = (0.3 + rng() * 0.4) * Math.max(width, height)
    const radial = ctx.createRadialGradient(x, y, 0, x, y, r)
    radial.addColorStop(0, hexWithAlpha(pick(rng, palette), 0.4))
    radial.addColorStop(1, hexWithAlpha(pick(rng, palette), 0))
    ctx.fillStyle = radial
    ctx.fillRect(0, 0, width, height)
  }
  ctx.globalCompositeOperation = 'source-over'
  addGrain(ctx, width, height, 0.05, seed)
}

/**
 * Background removal by corner-color chroma key. Operates on straight
 * (non-premultiplied) alpha and feathers the cutout edge to avoid the hard,
 * aliased fringe that naive thresholding produces.
 */
export function removeBackgroundInPlace(ctx, width, height, tolerance = 40) {
  const imageData = ctx.getImageData(0, 0, width, height)
  const d = imageData.data

  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1]
  ]
  let br = 0, bg = 0, bb = 0
  for (const [x, y] of corners) {
    const i = (y * width + x) * 4
    br += d[i]; bg += d[i + 1]; bb += d[i + 2]
  }
  br /= 4; bg /= 4; bb /= 4

  const tol = tolerance * tolerance * 3 // squared-distance threshold
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - br
    const dg = d[i + 1] - bg
    const db = d[i + 2] - bb
    const dist = dr * dr + dg * dg + db * db
    if (dist < tol) {
      const ratio = dist / tol // 0 at exact bg color → fully transparent
      d[i + 3] = Math.round(d[i + 3] * Math.min(1, ratio))
    }
  }
  ctx.putImageData(imageData, 0, 0)
}

function addGrain(ctx, width, height, strength, seed) {
  const rng = makeRng((seed ^ 0x9e3779b9) >>> 0) // seeded so grain is reproducible
  const imageData = ctx.getImageData(0, 0, width, height)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * 255 * strength
    d[i] = clampByte(d[i] + n)
    d[i + 1] = clampByte(d[i + 1] + n)
    d[i + 2] = clampByte(d[i + 2] + n)
  }
  ctx.putImageData(imageData, 0, 0)
}

function drawCaption(ctx, prompt, width, height) {
  if (!prompt) return
  const text = prompt.length > 48 ? prompt.slice(0, 45) + '…' : prompt
  ctx.font = `600 ${Math.round(width * 0.035)}px system-ui, sans-serif`
  ctx.textBaseline = 'bottom'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 12
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillText(text, width * 0.05, height * 0.95)
  ctx.shadowBlur = 0
}
