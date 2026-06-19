// Mock video generation using Canvas + MediaRecorder.
// Creates a genuine animated WebM/MP4 blob entirely in-browser.
// When real API keys are configured server-side, this is bypassed.

const PALETTES = [
  ['#7c5cff', '#23d5ab', '#1b1b2f'],
  ['#ff512f', '#dd2476', '#1a2a6c'],
  ['#1d976c', '#93f9b9', '#0f2027'],
  ['#f7971e', '#ffd200', '#3a1c71'],
  ['#005aa7', '#fffde4', '#43cea2'],
  ['#ee9ca7', '#ffdde1', '#614385'],
  ['#0f2027', '#203a43', '#2c5364'],
  ['#42275a', '#734b6d', '#ff6b35']
]

function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function hexRgb(hex) {
  const c = hex.replace('#', '')
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)]
}

function lerp(a, b, t) { return a + (b-a)*t }

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// Returns a promise that resolves to a blob URL for an animated video
export async function generateMockVideo({ prompt = '', duration = 5, aspectRatio = '16:9', model = 'mock' } = {}) {
  // Simulate realistic generation latency
  await delay(1200 + Math.random() * 1800)

  return new Promise((resolve, reject) => {
    const [w, h] = aspectRatio === '9:16' ? [480, 854] : aspectRatio === '1:1' ? [640, 640] : [854, 480]

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')

    const seed = hashStr(prompt || 'mock')
    const palette = PALETTES[seed % PALETTES.length]
    const [c0, c1, c2] = palette.map(hexRgb)

    const chunks = []
    const stream = canvas.captureStream(24)
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4'

    let recorder
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_000_000 })
    } catch {
      recorder = new MediaRecorder(stream)
    }

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] })
      resolve(URL.createObjectURL(blob))
    }
    recorder.onerror = reject

    const durationMs = Math.min(duration, 10) * 1000
    let startTime = null
    let animId = null

    // Particle system
    const particles = Array.from({ length: 30 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5,
      r: 2 + Math.random() * 6, life: Math.random()
    }))

    function draw(ts) {
      if (!startTime) startTime = ts
      const elapsed = ts - startTime
      const t = Math.min(elapsed / durationMs, 1)

      // Animated gradient background
      const hue0 = (t * 120) % 360
      const grad = ctx.createLinearGradient(0, 0, w * Math.cos(t*Math.PI), h)
      grad.addColorStop(0, `hsl(${hue0}, 60%, 12%)`)
      grad.addColorStop(0.5, `hsl(${(hue0+60)%360}, 70%, 20%)`)
      grad.addColorStop(1, `hsl(${(hue0+120)%360}, 60%, 12%)`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      // Animated orbs
      for (let i = 0; i < 3; i++) {
        const ox = w * (0.2 + 0.6 * ((Math.sin(t * Math.PI * (1+i*0.3) + i * 2) + 1) / 2))
        const oy = h * (0.2 + 0.6 * ((Math.cos(t * Math.PI * (0.8+i*0.2) + i) + 1) / 2))
        const cr = PALETTES[seed % PALETTES.length][i % 3]
        const [r,g,b] = hexRgb(cr)
        const orbR = w * (0.15 + 0.05 * Math.sin(t*Math.PI*2+i))
        const radial = ctx.createRadialGradient(ox, oy, 0, ox, oy, orbR)
        radial.addColorStop(0, `rgba(${r},${g},${b},0.45)`)
        radial.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.fillStyle = radial
        ctx.fillRect(0, 0, w, h)
      }

      // Particles
      ctx.save()
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.life += 0.005
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        const alpha = 0.3 + 0.3 * Math.sin(p.life * Math.PI * 4)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * (0.7 + 0.3 * Math.sin(p.life)), 0, Math.PI*2)
        ctx.fillStyle = `rgba(255,255,255,${alpha})`
        ctx.fill()
      }
      ctx.restore()

      // Scanline effect
      ctx.fillStyle = 'rgba(0,0,0,0.03)'
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2)

      // Model badge
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.beginPath()
      ctx.roundRect(w*0.04, h*0.04, w*0.22, h*0.065, 6)
      ctx.fill()
      ctx.fillStyle = 'rgba(124,92,255,0.9)'
      ctx.font = `600 ${Math.round(w*0.028)}px system-ui`
      ctx.textBaseline = 'middle'
      ctx.fillText('MOCK · ' + model.toUpperCase().slice(0,12), w*0.06, h*0.073)
      ctx.restore()

      // Prompt text
      const text = prompt.length > 52 ? prompt.slice(0,49)+'…' : (prompt || 'AI Video Preview')
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      const th = h * 0.08
      ctx.fillRect(0, h - th - 8, w, th + 8)
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.font = `500 ${Math.round(w*0.032)}px system-ui`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.shadowColor = 'rgba(0,0,0,0.8)'
      ctx.shadowBlur = 8
      ctx.fillText(text, w/2, h - th/2 - 4)
      ctx.restore()

      // Progress bar
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(w*0.05, h-6, w*0.9, 3)
      ctx.fillStyle = `rgba(${lerp(c0[0],c1[0],t)},${lerp(c0[1],c1[1],t)},${lerp(c0[2],c1[2],t)},0.9)`
      ctx.fillRect(w*0.05, h-6, w*0.9*t, 3)

      if (t < 1) {
        animId = requestAnimationFrame(draw)
      } else {
        recorder.stop()
      }
    }

    recorder.start(200)
    animId = requestAnimationFrame(draw)
  })
}

// Simulate the full server job flow with SSE-like progress callbacks
export async function runMockJob({ prompt, duration, aspectRatio, model, mode }, onProgress) {
  const steps = [
    { progress: 5, delay: 300, msg: 'Queued...' },
    { progress: 15, delay: 500, msg: 'Initializing model...' },
    { progress: 30, delay: 800, msg: 'Generating frames...' },
    { progress: 55, delay: 600, msg: 'Rendering motion...' },
    { progress: 75, delay: 500, msg: 'Post-processing...' },
    { progress: 90, delay: 400, msg: 'Finalizing...' }
  ]

  for (const step of steps) {
    await delay(step.delay)
    if (onProgress) onProgress(step.progress, step.msg)
  }

  const videoUrl = await generateMockVideo({ prompt, duration, aspectRatio, model })
  if (onProgress) onProgress(100, 'Complete')
  return { videoUrl, durationSeconds: duration, model }
}
