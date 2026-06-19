import fetch from 'node-fetch'

const API_BASE = 'https://api.replicate.com/v1'

function headers() {
  return {
    'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
    'Content-Type': 'application/json'
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

const MODELS = {
  'wan2.1': 'wavespeedai/wan-2.1-i2v-480p',
  'cogvideox': 'thudm/cogvideox-5b',
  'svd': 'stability-ai/stable-video-diffusion',
  'zero123plus': 'lucataco/zero123plus'
}

export async function run(model, input, progressCb) {
  const modelId = MODELS[model] || model
  const [owner, name] = modelId.split('/')

  const res = await fetch(`${API_BASE}/models/${owner}/${name}/predictions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ input })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Replicate create prediction failed: ${res.status} ${err}`)
  }
  const prediction = await res.json()
  return pollPrediction(prediction.id, progressCb)
}

async function pollPrediction(predId, progressCb, maxWaitMs = 300_000) {
  const deadline = Date.now() + maxWaitMs
  let interval = 3000
  let lastProgress = 10

  while (Date.now() < deadline) {
    await sleep(interval)
    interval = Math.min(interval * 1.2, 8000)

    const res = await fetch(`${API_BASE}/predictions/${predId}`, { headers: headers() })
    if (!res.ok) throw new Error(`Replicate poll failed: ${res.status}`)
    const pred = await res.json()

    if (pred.logs) {
      lastProgress = Math.min(lastProgress + 10, 90)
      if (progressCb) progressCb(lastProgress)
    }

    if (pred.status === 'succeeded') {
      const out = pred.output
      if (Array.isArray(out)) return out[0]
      return out
    }
    if (pred.status === 'failed' || pred.status === 'canceled') {
      throw new Error(pred.error || 'Replicate prediction failed')
    }
  }
  throw new Error('Replicate prediction timed out')
}

export async function generateMultiAngle({ imageUrl, azimuth = 90 }) {
  return run('zero123plus', {
    image: imageUrl,
    elevation: 0,
    azimuth
  })
}

export async function generateImageToVideo({ imageUrl, prompt, model = 'wan2.1' }, progressCb) {
  const input = model === 'svd'
    ? { input_image: imageUrl, video_length: 14, sizing_strategy: 'maintain_aspect_ratio' }
    : model === 'wan2.1'
    ? { image: imageUrl, prompt, num_frames: 81 }
    : { image: imageUrl, prompt }

  return run(model, input, progressCb)
}

export async function generateTextToVideo({ prompt, model = 'cogvideox' }, progressCb) {
  const input = model === 'cogvideox'
    ? { prompt, num_frames: 49, guidance_scale: 6 }
    : { prompt }

  return run(model, input, progressCb)
}
