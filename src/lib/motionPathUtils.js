// Bezier path → camera motion instruction converter

export function sampleBezierPath(points, numSamples = 60) {
  if (points.length < 2) return []
  const samples = []

  for (let i = 0; i < numSamples; i++) {
    const t = i / (numSamples - 1)
    const pt = interpolatePath(points, t)
    samples.push({ t, x: pt.x, y: pt.y })
  }

  // Compute zoom from path convergence
  const start = samples[0]
  const end = samples[samples.length - 1]
  const pathLength = samples.reduce((acc, s, i) => {
    if (i === 0) return 0
    const prev = samples[i - 1]
    return acc + Math.hypot(s.x - prev.x, s.y - prev.y)
  }, 0)

  return samples.map((s, i) => ({
    t: s.t,
    x: s.x,
    y: s.y,
    zoom: 1 + (i / numSamples) * 0.3 // slight zoom over time
  }))
}

function interpolatePath(points, t) {
  // Catmull-Rom spline through all points
  if (points.length === 1) return points[0]
  if (points.length === 2) return lerpPoint(points[0], points[1], t)

  const segCount = points.length - 1
  const segT = t * segCount
  const seg = Math.min(Math.floor(segT), segCount - 1)
  const localT = segT - seg

  const p0 = points[Math.max(0, seg - 1)]
  const p1 = points[seg]
  const p2 = points[Math.min(segCount, seg + 1)]
  const p3 = points[Math.min(segCount, seg + 2)]

  return catmullRom(p0, p1, p2, p3, localT)
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t
  const t3 = t2 * t
  return {
    x: 0.5 * ((2*p1.x) + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y: 0.5 * ((2*p1.y) + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3)
  }
}

function lerpPoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

// Convert sampled path to human-readable camera direction for prompt injection
export function pathToDirectionString(samples, imageW, imageH) {
  if (!samples.length) return ''

  const first = samples[0]
  const last = samples[samples.length - 1]
  const mid = samples[Math.floor(samples.length / 2)]

  const dx = (last.x - first.x) / imageW
  const dy = (last.y - first.y) / imageH

  const parts = []

  if (Math.abs(dx) > 0.05) parts.push(dx > 0 ? 'pan right' : 'pan left')
  if (Math.abs(dy) > 0.05) parts.push(dy > 0 ? 'tilt down' : 'tilt up')

  // Detect zoom from path convergence
  const spread = samples.reduce((acc, s) => acc + Math.hypot(s.x - mid.x, s.y - mid.y), 0) / samples.length
  const startSpread = Math.hypot(first.x - mid.x, first.y - mid.y)
  if (startSpread > 0 && spread / startSpread > 1.2) parts.push('zoom out')
  else if (startSpread > 0 && spread / startSpread < 0.8) parts.push('zoom in')

  return parts.length ? parts.join(', ') : 'slow drift'
}

// Convert path to Luma camera_motion JSON
export function pathToLumaMotion(samples, imageW, imageH) {
  if (!samples.length) return null
  const desc = pathToDirectionString(samples, imageW, imageH)
  return { type: 'custom', description: desc }
}

// Convert path to Runway camera motion descriptor
export function pathToRunwayMotion(samples, imageW, imageH) {
  if (!samples.length) return null
  return pathToDirectionString(samples, imageW, imageH)
}
