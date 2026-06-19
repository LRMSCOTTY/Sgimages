/**
 * Netlify Function: video
 * Handles all /api/video/* routes.
 * Video generation uses context.waitUntil() for background AI API calls.
 * Job state is stored in Netlify Blobs so polling works across invocations.
 */

import { getStore } from '@netlify/blobs'
import { v4 as uuidv4 } from 'uuid'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  })
}

function jobStore() {
  return getStore({ name: 'video-jobs', consistency: 'strong' })
}

// ── Build enhanced prompt ──────────────────────────────────
function buildPrompt(base, params) {
  const { cameraRig, motionPath, motionBrushRegions, effects, referenceImages, soundDesign, negativePrompt } = params

  const EFFECT_PROMPTS = {
    shatter: 'exploding into cinematic debris and fragments with dramatic impact',
    melt: 'melting and liquefying with surreal viscous flow',
    inflate: 'inflating and expanding like a balloon, smooth and rounded',
    deflate: 'deflating and collapsing inward, wrinkled and soft',
    rain: 'with heavy cinematic rainfall, wet reflections on surfaces, dramatic atmosphere',
    snow: 'with gentle snowfall, soft white flakes drifting, winter atmosphere',
    fog: 'with thick atmospheric fog and mist rolling in, ethereal and moody',
    'wildfire-smoke': 'with billowing wildfire smoke, orange sky, ash particles',
    'lens-flare': 'with dramatic cinematic lens flare sweep across the frame',
    'bokeh-pull': 'with rack focus bokeh pull from blurred to sharp, shallow depth of field',
    'light-leak': 'with warm light leak and film grain overlay, vintage aesthetic',
    'dolly-zoom': 'with dramatic Vertigo dolly zoom effect, background warps as subject stays',
    hyperlapse: 'in fast-motion hyperlapse, time accelerated, smooth motion blur',
    reverse: 'playing in reverse, backwards motion creating surreal dreamlike effect',
    'slow-mo': 'in extreme cinematic slow motion at 240fps, every detail suspended in time',
    strobe: 'with dramatic strobe flash effect, staccato rhythmic light pulses'
  }

  let prompt = base
  if (cameraRig?.promptAppend) prompt += `. ${cameraRig.promptAppend}`
  if (motionPath?.directionString) prompt += `. Camera motion: ${motionPath.directionString}`
  if (motionBrushRegions?.length) {
    const desc = motionBrushRegions.map(r => `the ${r.region || 'area'} moves ${r.direction}`).join(', ')
    prompt += `. Motion: ${desc}`
  }
  if (effects?.length) {
    const strs = effects.map(id => EFFECT_PROMPTS[id]).filter(Boolean)
    if (strs.length) prompt += `. Visual effects: ${strs.join('; ')}`
  }
  if (referenceImages?.length) {
    const refs = referenceImages.map(r => `${r.tag || 'reference'}: ${r.label || 'image'}`).join(', ')
    prompt += `. Maintain visual consistency with ${refs}`
  }
  if (soundDesign?.mood && soundDesign.mood !== 'silence') {
    prompt += `, accompanied by ${soundDesign.mood.replace(/-/g, ' ')} music`
  }
  if (negativePrompt) prompt += `. Avoid: ${negativePrompt}`
  return prompt
}

// ── AI Provider calls ──────────────────────────────────────
async function callProvider(params, progressCb) {
  const { model, mode, prompt: basePrompt, sourceImageUrl, sourceImageEndUrl,
    duration = 5, aspectRatio = '16:9' } = params

  const prompt = buildPrompt(basePrompt || '', params)

  switch (model) {
    case 'runway-gen3-turbo':
    case 'runway-gen3-alpha': {
      if (!process.env.RUNWAY_API_KEY) throw new Error('RUNWAY_API_KEY not configured')
      const runway = await import('../../server/services/runway.js')
      if (progressCb) progressCb(15)
      const url = mode === 'text-to-video'
        ? await runway.generateTextToVideo({ prompt, duration, aspectRatio })
        : await runway.generateImageToVideo({ imageUrl: sourceImageUrl, endImageUrl: sourceImageEndUrl, prompt, duration, aspectRatio })
      if (progressCb) progressCb(95)
      return url
    }

    case 'luma-dream-machine': {
      if (!process.env.LUMA_API_KEY) throw new Error('LUMA_API_KEY not configured')
      const luma = await import('../../server/services/luma.js')
      if (progressCb) progressCb(15)
      let url
      if (mode === 'keyframe') {
        url = await luma.generateKeyframeVideo({ startImageUrl: sourceImageUrl, endImageUrl: sourceImageEndUrl, prompt, aspectRatio })
      } else if (mode === 'text-to-video') {
        url = await luma.generateTextToVideo({ prompt, duration, aspectRatio })
      } else {
        url = await luma.generateImageToVideo({ imageUrl: sourceImageUrl, prompt, duration, aspectRatio })
      }
      if (progressCb) progressCb(95)
      return url
    }

    case 'kling-v2': {
      if (!process.env.KLING_ACCESS_KEY) throw new Error('KLING_ACCESS_KEY not configured')
      const kling = await import('../../server/services/kling.js')
      if (progressCb) progressCb(15)
      const url = mode === 'text-to-video'
        ? await kling.generateTextToVideo({ prompt, duration, aspectRatio })
        : await kling.generateImageToVideo({ imageUrl: sourceImageUrl, prompt, duration })
      if (progressCb) progressCb(95)
      return url
    }

    case 'ltx-video':
    case 'hunyuanvideo':
    case 'mochi-1':
    case 'wan2.1':
    case 'cogvideox': {
      if (!process.env.REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not configured')
      const replicate = await import('../../server/services/replicate.js')
      if (progressCb) progressCb(15)
      const url = mode === 'image-to-video'
        ? await replicate.generateImageToVideo({ imageUrl: sourceImageUrl, prompt, model, duration, aspectRatio }, progressCb)
        : await replicate.generateTextToVideo({ prompt, model, duration, aspectRatio }, progressCb)
      if (progressCb) progressCb(95)
      return url
    }

    default:
      throw new Error(`Unknown model: ${model}`)
  }
}

// ── Background generation ──────────────────────────────────
async function processGeneration(jobId, params) {
  const store = jobStore()
  try {
    await store.setJSON(jobId, { status: 'processing', progress: 5, createdAt: Date.now() })

    const videoUrl = await callProvider(params, async (progress) => {
      await store.setJSON(jobId, { status: 'processing', progress }).catch(() => {})
    })

    await store.setJSON(jobId, {
      status: 'completed',
      progress: 100,
      result: {
        videoUrl,
        thumbnailUrl: null,
        durationSeconds: params.duration || 5,
        model: params.model
      },
      completedAt: Date.now()
    })
  } catch (e) {
    console.error('[video bg]', e)
    await store.setJSON(jobId, { status: 'failed', error: e.message || 'Generation failed' })
  }
}

// ── Main handler ───────────────────────────────────────────
export default async function handler(req, context) {
  const url = new URL(req.url)
  const subpath = url.pathname.replace(/^\/api\/video\/?/, '') || ''
  const method = req.method

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  try {
    // POST /generate
    if (subpath === 'generate' && method === 'POST') {
      const params = await req.json()
      const jobId = `job_${uuidv4()}`

      const store = jobStore()
      await store.setJSON(jobId, { status: 'queued', progress: 0, createdAt: Date.now() })

      context.waitUntil(processGeneration(jobId, params))

      const avgSeconds = {
        'runway-gen3-turbo': 40, 'runway-gen3-alpha': 70,
        'luma-dream-machine': 60, 'kling-v2': 120,
        'wan2.1': 180, 'cogvideox': 90,
        'ltx-video': 60, 'hunyuanvideo': 90, 'mochi-1': 90
      }
      return json({ jobId, status: 'queued', estimatedSeconds: avgSeconds[params.model] || 60, model: params.model }, 202)
    }

    // GET /jobs/:id
    const jobMatch = subpath.match(/^jobs\/([^/]+)$/)
    if (jobMatch && method === 'GET') {
      const jobId = jobMatch[1]
      const job = await jobStore().get(jobId, { type: 'json' })
      if (!job) return json({ error: 'Job not found' }, 404)
      return json(job)
    }

    // POST /multi-model (battle arena)
    if (subpath === 'multi-model' && method === 'POST') {
      const params = await req.json()
      const { models = ['ltx-video', 'luma-dream-machine', 'wan2.1'] } = params
      const store = jobStore()
      const battleId = `battle_${Date.now()}`
      const jobs = await Promise.all(models.map(async (model) => {
        const jobId = `job_${uuidv4()}`
        await store.setJSON(jobId, { status: 'queued', progress: 0, createdAt: Date.now() })
        context.waitUntil(processGeneration(jobId, { ...params, model }))
        return { model, jobId }
      }))
      return json({ battleId, jobs }, 202)
    }

    // POST /upload (image — return data URL since no persistent storage)
    if (subpath === 'upload' && method === 'POST') {
      const formData = await req.formData()
      const file = formData.get('image')
      if (!file) return json({ error: 'No file uploaded' }, 400)
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const dataUrl = `data:${file.type || 'image/png'};base64,${base64}`
      return json({ url: dataUrl })
    }

    // FFmpeg-based routes are unavailable on serverless
    if (['loop', 'grade', 'compose', 'extend'].includes(subpath) && method === 'POST') {
      return json({
        error: 'FFmpeg processing (loop/grade/compose/extend) is not available on serverless. Use Railway deployment for these features.',
        code: 'SERVERLESS_LIMITATION'
      }, 501)
    }

    return json({ error: 'Not found' }, 404)
  } catch (e) {
    console.error('[video]', e)
    return json({ error: e.message || 'Internal server error' }, 500)
  }
}

export const config = { path: '/api/video/*' }
