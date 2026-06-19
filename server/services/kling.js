import * as jose from 'jose'

const API_BASE = 'https://api.klingai.com'

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function makeJWT() {
  const key = await jose.importSecret(
    new TextEncoder().encode(process.env.KLING_API_SECRET)
  )
  return jose.SignJWT({ iss: process.env.KLING_API_KEY })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(key)
}

async function headers() {
  const token = await makeJWT()
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

export async function generateImageToVideo({ imageUrl, prompt, duration = 5 }) {
  const body = {
    model_name: 'kling-v2',
    image: imageUrl,
    prompt,
    duration: String(Math.min(duration, 10))
  }

  const res = await fetch(`${API_BASE}/v1/videos/image2video`, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Kling image2video failed: ${res.status}`)
  const { data } = await res.json()
  return pollTask(data.task_id)
}

export async function generateTextToVideo({ prompt, duration = 5, aspectRatio = '16:9' }) {
  const ratioMap = { '16:9': '16:9', '9:16': '9:16', '1:1': '1:1' }
  const body = {
    model_name: 'kling-v2',
    prompt,
    duration: String(Math.min(duration, 10)),
    aspect_ratio: ratioMap[aspectRatio] || '16:9'
  }

  const res = await fetch(`${API_BASE}/v1/videos/text2video`, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Kling text2video failed: ${res.status}`)
  const { data } = await res.json()
  return pollTask(data.task_id)
}

async function pollTask(taskId, maxWaitMs = 300_000) {
  const deadline = Date.now() + maxWaitMs
  let interval = 5000

  while (Date.now() < deadline) {
    await sleep(interval)
    interval = Math.min(interval * 1.2, 10000)

    const res = await fetch(`${API_BASE}/v1/videos/image2video/${taskId}`, {
      headers: await headers()
    })
    if (!res.ok) throw new Error(`Kling poll failed: ${res.status}`)
    const { data } = await res.json()

    if (data.task_status === 'succeed') {
      return data.task_result?.videos?.[0]?.url || null
    }
    if (data.task_status === 'failed') {
      throw new Error(data.task_status_msg || 'Kling generation failed')
    }
  }
  throw new Error('Kling generation timed out')
}
