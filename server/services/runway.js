const API_BASE = 'https://api.dev.runwayml.com/v1'
const RUNWAY_VERSION = '2024-11-06'

function headers() {
  return {
    'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
    'X-Runway-Version': RUNWAY_VERSION,
    'Content-Type': 'application/json'
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

export async function generateTextToVideo({ prompt, duration = 5, aspectRatio = '16:9' }) {
  const ratio = aspectRatio === '9:16' ? '720:1280' : aspectRatio === '1:1' ? '960:960' : '1280:720'
  const body = {
    model: 'gen3a_turbo',
    prompt_text: prompt,
    duration: Math.min(duration, 10),
    ratio
  }

  const res = await fetch(`${API_BASE}/text_to_video`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Runway text_to_video failed: ${res.status}`)
  const { id } = await res.json()
  return pollTask(id)
}

export async function generateImageToVideo({ imageUrl, prompt, duration = 5, aspectRatio = '16:9', cameraMotion }) {
  const ratio = aspectRatio === '9:16' ? '720:1280' : aspectRatio === '1:1' ? '960:960' : '1280:720'
  const body = {
    model: 'gen3a_turbo',
    prompt_image: imageUrl,
    prompt_text: buildPrompt(prompt, cameraMotion),
    duration: Math.min(duration, 10),
    ratio
  }

  const res = await fetch(`${API_BASE}/image_to_video`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Runway image_to_video failed: ${res.status}`)
  const { id } = await res.json()
  return pollTask(id)
}

async function pollTask(taskId, maxWaitMs = 180_000) {
  const deadline = Date.now() + maxWaitMs
  let interval = 3000

  while (Date.now() < deadline) {
    await sleep(interval)
    interval = Math.min(interval * 1.3, 8000)

    const res = await fetch(`${API_BASE}/tasks/${taskId}`, { headers: headers() })
    if (!res.ok) throw new Error(`Runway poll failed: ${res.status}`)
    const task = await res.json()

    if (task.status === 'SUCCEEDED') return task.output?.[0] || null
    if (task.status === 'FAILED') throw new Error(task.failure || 'Runway generation failed')
  }
  throw new Error('Runway generation timed out')
}

function buildPrompt(prompt, cameraMotion) {
  if (!cameraMotion) return prompt
  return `${prompt}. ${cameraMotion.promptAppend || ''}`
}
