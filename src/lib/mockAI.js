// ---------------------------------------------------------------------------
// Mock AI engine.
//
// This module simulates an AI image backend entirely in the browser so the app
// is fully runnable with no API keys. Each function returns a Promise<dataURL>
// after a short, realistic delay. The generation is procedural but deterministic
// (seeded from the prompt) so the same prompt yields the same image.
//
// To plug in a real provider later, replace the bodies of these functions with
// `fetch()` calls to your endpoint — the signatures and return types are the
// contract the UI depends on.
// ---------------------------------------------------------------------------

import { loadImage } from './imageUtils'

const SIMULATED_LATENCY = 900 // ms

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Tiny deterministic string hash → 32-bit int. */
function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Mulberry32 seeded PRNG. */
function makeRng(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)]
}

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

/**
 * Generate an image procedurally from a text prompt.
 * Produces a layered abstract composition seeded by the prompt text.
 */
export async function generateImage(prompt, { width = 768, height = 768 } = {}) {
  await delay(SIMULATED_LATENCY + Math.random() * 600)

  const seed = hashString(prompt || 'sgimages')
  const rng = makeRng(seed)
  const palette = PALETTES[seed % PALETTES.length]

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, width, height)
  grad.addColorStop(0, palette[0])
  grad.addColorStop(0.5, palette[1])
  grad.addColorStop(1, palette[2])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  // Soft glowing orbs
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

  // Geometric accents
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

  // Fine grain for texture
  addGrain(ctx, width, height, 0.04)

  // Caption stamp so it's obvious this came from the prompt
  drawCaption(ctx, prompt, width, height)

  return canvas.toDataURL('image/png')
}

/**
 * Generative edit: re-imagine an existing image guided by a prompt.
 * Applies a prompt-seeded stylized transform (tint + light leaks + grain)
 * so the change is clearly visible.
 */
export async function generativeEdit(src, prompt) {
  await delay(SIMULATED_LATENCY + Math.random() * 500)

  const img = await loadImage(src)
  const seed = hashString('edit:' + prompt)
  const rng = makeRng(seed)
  const palette = PALETTES[seed % PALETTES.length]

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')

  // Base image with a seeded hue shift
  ctx.filter = `hue-rotate(${Math.floor(rng() * 360)}deg) saturate(${110 + rng() * 60}%)`
  ctx.drawImage(img, 0, 0)
  ctx.filter = 'none'

  // Color overlay tint
  ctx.globalCompositeOperation = 'overlay'
  ctx.fillStyle = hexWithAlpha(pick(rng, palette), 0.45)
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'source-over'

  // Light leaks
  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < 3; i++) {
    const x = rng() * canvas.width
    const y = rng() * canvas.height
    const r = (0.3 + rng() * 0.4) * Math.max(canvas.width, canvas.height)
    const radial = ctx.createRadialGradient(x, y, 0, x, y, r)
    radial.addColorStop(0, hexWithAlpha(pick(rng, palette), 0.4))
    radial.addColorStop(1, hexWithAlpha(pick(rng, palette), 0))
    ctx.fillStyle = radial
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.globalCompositeOperation = 'source-over'

  addGrain(ctx, canvas.width, canvas.height, 0.05)

  return canvas.toDataURL('image/png')
}

/**
 * Background removal via corner-color sampling + flood tolerance.
 * Samples the four corners to estimate the background color, then makes
 * pixels within `tolerance` of that color transparent. This is a genuine
 * (if simple) chroma-key style algorithm — best on images with a fairly
 * uniform background.
 */
export async function removeBackground(src, { tolerance = 40 } = {}) {
  await delay(SIMULATED_LATENCY)

  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const d = imageData.data

  // Average the four corners to estimate background color.
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

  const tol = tolerance * tolerance * 3 // squared distance threshold
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - br
    const dg = d[i + 1] - bg
    const db = d[i + 2] - bb
    const dist = dr * dr + dg * dg + db * db
    if (dist < tol) {
      // Feather alpha near the threshold edge for a softer cutout.
      const ratio = dist / tol
      d[i + 3] = Math.round(d[i + 3] * Math.min(1, ratio))
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

// --- helpers ---------------------------------------------------------------

function hexWithAlpha(hex, alpha) {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function addGrain(ctx, width, height, strength) {
  const imageData = ctx.getImageData(0, 0, width, height)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * strength
    d[i] = clamp(d[i] + n)
    d[i + 1] = clamp(d[i + 1] + n)
    d[i + 2] = clamp(d[i + 2] + n)
  }
  ctx.putImageData(imageData, 0, 0)
}

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v
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
