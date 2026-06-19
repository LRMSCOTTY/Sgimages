const API_BASE = 'https://api.lumalabs.ai/dream-machine/v1'

function headers() {
  return {
    'Authorization': `Bearer ${process.env.LUMA_API_KEY}`,
    'Content-Type': 'application/json'
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

export async function generateTextToVideo({ prompt, duration = 5, aspectRatio = '16:9', cameraMotion }) {
  const body = {
    prompt: buildPrompt(prompt, cameraMotion),
    loop: false,
    aspect_ratio: aspectRatio
  }

  const res = await fetch(`${API_BASE}/generations`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Luma text_to_video failed: ${res.status}`)
  const { id } = await res.json()
  return pollGeneration(id)
}

export async function generateImageToVideo({ imageUrl, prompt, duration = 5, aspectRatio = '16:9', cameraMotion }) {
  const body = {
    prompt: buildPrompt(prompt, cameraMotion),
    keyframes: {
      frame0: { type: 'image', url: imageUrl }
    },
    aspect_ratio: aspectRatio
  }

  const res = await fetch(`${API_BASE}/generations`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Luma image_to_video failed: ${res.status}`)
  const { id } = await res.json()
  return pollGeneration(id)
}

async function pollGeneration(genId, maxWaitMs = 180_000) {
  const deadline = Date.now() + maxWaitMs
  let interval = 3000

  while (Date.now() < deadline) {
    await sleep(interval)
    interval = Math.min(interval * 1.3, 10000)

    const res = await fetch(`${API_BASE}/generations/${genId}`, { headers: headers() })
    if (!res.ok) throw new Error(`Luma poll failed: ${res.status}`)
    const gen = await res.json()

    if (gen.state === 'completed') return gen.assets?.video || null
    if (gen.state === 'failed') throw new Error(gen.failure_reason || 'Luma generation failed')
  }
  throw new Error('Luma generation timed out')
}

function buildPrompt(prompt, cameraMotion) {
  if (!cameraMotion) return prompt
  const lumaMotion = LUMA_MOTION_MAP[cameraMotion.id] || cameraMotion.promptAppend || ''
  return lumaMotion ? `${prompt}. Camera: ${lumaMotion}` : prompt
}

const LUMA_MOTION_MAP = {
  'drone-establishing': 'slow aerial descent, wide establishing drone shot',
  'steadicam-walk': 'smooth steadicam tracking shot, fluid movement',
  'handheld-doc': 'handheld documentary style, subtle organic camera movement',
  'dolly-push-in': 'slow cinematic dolly push-in, deepening focus',
  'hitchcock-zoom': 'simultaneous dolly back and zoom in, Vertigo effect',
  'whip-pan': 'dynamic whip pan with motion blur',
  'rack-focus': 'rack focus pull from foreground to background',
  'orbital': '360 degree orbital rotation around subject',
  'tilt-reveal': 'slow upward tilt from ground revealing sky'
}
