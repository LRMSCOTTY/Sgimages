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
  // Image-to-video (open source, comparable to Kling/Runway)
  'wan2.1': 'wavespeedai/wan-2.1-i2v-480p',
  // Text-to-video (open source, comparable to Runway)
  'cogvideox': 'thudm/cogvideox-5b',
  // Fastest open-source T2V (Lightricks, comparable to Runway Turbo)
  'ltx-video': 'lightricks/ltx-video',
  // Highest quality open-source T2V (Tencent, comparable to Luma Ray2)
  'hunyuanvideo': 'tencent/hunyuanvideo',
  // Excellent motion quality (Genmo)
  'mochi-1': 'genmo/mochi-1',
  // Classic
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

export async function generateImageToVideo({ imageUrl, prompt, model = 'wan2.1', duration = 5, aspectRatio = '16:9' }, progressCb) {
  let input
  if (model === 'svd') {
    input = { input_image: imageUrl, video_length: 14, sizing_strategy: 'maintain_aspect_ratio' }
  } else if (model === 'wan2.1') {
    input = { image: imageUrl, prompt, num_frames: 81 }
  } else {
    input = { image: imageUrl, prompt }
  }
  return run(model, input, progressCb)
}

export async function generateTextToVideo({ prompt, model = 'cogvideox', duration = 5, aspectRatio = '16:9', negativePrompt }, progressCb) {
  let input
  const numFrames = Math.ceil(duration * 24)

  if (model === 'cogvideox') {
    input = { prompt, num_frames: Math.min(numFrames, 49), guidance_scale: 6 }
  } else if (model === 'ltx-video') {
    const [w, h] = aspectRatio === '9:16' ? [480, 832] : aspectRatio === '1:1' ? [512, 512] : [704, 480]
    input = {
      prompt,
      negative_prompt: negativePrompt || 'worst quality, inconsistent motion, blurry, jittery, distorted',
      width: w, height: h,
      num_frames: Math.min(numFrames, 121),
      guidance_scale: 3,
      num_inference_steps: 40
    }
  } else if (model === 'hunyuanvideo') {
    const [w, h] = aspectRatio === '9:16' ? [544, 960] : aspectRatio === '1:1' ? [720, 720] : [960, 544]
    input = {
      prompt,
      width: w, height: h,
      video_length: Math.min(numFrames + 1, 129),
      num_inference_steps: 50,
      guidance_scale: 6
    }
  } else if (model === 'mochi-1') {
    input = {
      prompt,
      num_frames: Math.min(numFrames, 84),
      seed: Math.floor(Math.random() * 2 ** 32)
    }
  } else {
    input = { prompt }
  }

  return run(model, input, progressCb)
}
