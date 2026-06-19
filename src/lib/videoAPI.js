import { runMockJob } from './mockVideoAI.js'

// Detect if the backend server is available
let serverAvailable = null

async function checkServer() {
  if (serverAvailable !== null) return serverAvailable
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(2000) })
    const data = await res.json()
    serverAvailable = data.status === 'ok' && !data.mockMode
    return serverAvailable
  } catch {
    serverAvailable = false
    return false
  }
}

// Force mock mode (set to true during dev without server)
export const FORCE_MOCK = import.meta.env.VITE_MOCK_VIDEO === 'true'

export async function submitGenerate(params) {
  const useMock = FORCE_MOCK || !(await checkServer())

  if (useMock) {
    // Return a synthetic job ID for mock mode
    return { jobId: `mock_${Date.now()}`, status: 'queued', estimatedSeconds: 5, model: params.model, isMock: true }
  }

  const res = await fetch('/api/video/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || `Server error ${res.status}`)
  }
  return res.json()
}

export async function submitMultiModel(params) {
  const useMock = FORCE_MOCK || !(await checkServer())

  if (useMock) {
    const models = params.models || ['runway-gen3-turbo', 'luma-dream-machine', 'kling-v2']
    return {
      battleId: `battle_${Date.now()}`,
      jobs: models.map(m => ({ model: m, jobId: `mock_${Date.now()}_${m}`, isMock: true }))
    }
  }

  const res = await fetch('/api/video/multi-model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  if (!res.ok) throw new Error(`Server error ${res.status}`)
  return res.json()
}

export async function getJobStatus(jobId) {
  if (jobId.startsWith('mock_')) return null
  const res = await fetch(`/api/video/jobs/${jobId}`)
  if (!res.ok) return null
  return res.json()
}

export function subscribeJobSSE(jobId, onUpdate) {
  if (jobId.startsWith('mock_')) return null
  const es = new EventSource(`/api/video/jobs/${jobId}/stream`)
  es.onmessage = (e) => {
    try { onUpdate(JSON.parse(e.data)) } catch {}
  }
  es.onerror = () => es.close()
  return () => es.close()
}

export async function uploadSourceImage(dataURL) {
  const useMock = FORCE_MOCK || !(await checkServer())

  if (useMock) {
    // In mock mode, just return the data URL as-is
    return dataURL
  }

  // Convert dataURL to blob and upload
  const res = await fetch(dataURL)
  const blob = await res.blob()
  const form = new FormData()
  form.append('image', blob, 'source.png')

  const up = await fetch('/api/video/upload', { method: 'POST', body: form })
  if (!up.ok) throw new Error('Upload failed')
  const { url } = await up.json()
  return url
}

export async function analyzeScene(sceneDescription, imageDescription) {
  const useMock = FORCE_MOCK || !(await checkServer())

  if (useMock) {
    await new Promise(r => setTimeout(r, 1500))
    return getMockShotPlan(sceneDescription)
  }

  const res = await fetch('/api/director/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sceneDescription, imageDescription })
  })
  if (!res.ok) throw new Error(`Director failed: ${res.status}`)
  const { shotPlan } = await res.json()
  return shotPlan
}

export async function generateStoryboard(sceneDescription, numPanels = 4) {
  const useMock = FORCE_MOCK || !(await checkServer())

  if (useMock) {
    await new Promise(r => setTimeout(r, 1800))
    const shots = getMockShotPlan(sceneDescription)
    return shots.slice(0, numPanels).map((s, i) => ({
      id: `panel_${Date.now()}_${i}`,
      index: i, shotType: s.shot, prompt: s.prompt,
      cameraRig: s.cameraRig, duration: s.duration, model: s.model,
      notes: s.notes, imageUrl: null, videoUrl: null, status: 'draft'
    }))
  }

  const res = await fetch('/api/storyboard/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sceneDescription, numPanels })
  })
  if (!res.ok) throw new Error(`Storyboard failed: ${res.status}`)
  const { panels } = await res.json()
  return panels
}

// Run a job — handles both mock and real modes
export async function runJob(params, onProgress) {
  const job = await submitGenerate(params)

  if (job.isMock) {
    const result = await runMockJob(params, onProgress)
    return result
  }

  // Real job: subscribe to SSE
  return new Promise((resolve, reject) => {
    const close = subscribeJobSSE(job.jobId, (update) => {
      if (update.progress && onProgress) onProgress(update.progress)
      if (update.status === 'completed') {
        close?.()
        resolve(update.result)
      }
      if (update.status === 'failed') {
        close?.()
        reject(new Error(update.error || 'Generation failed'))
      }
    })

    // Fallback: poll every 5s if SSE fails
    const poll = setInterval(async () => {
      const status = await getJobStatus(job.jobId)
      if (!status) return
      if (onProgress) onProgress(status.progress)
      if (status.status === 'completed') { clearInterval(poll); close?.(); resolve(status.result) }
      if (status.status === 'failed') { clearInterval(poll); close?.(); reject(new Error(status.error)) }
    }, 5000)
  })
}

async function submitServerJob(endpoint, body) {
  const res = await fetch(`/api/video/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Server error ${res.status}`)
  return res.json()
}

async function waitForJob(jobId, onProgress) {
  return new Promise((resolve, reject) => {
    const close = subscribeJobSSE(jobId, (update) => {
      if (update.progress && onProgress) onProgress(update.progress)
      if (update.status === 'completed') { close?.(); resolve(update.result) }
      if (update.status === 'failed') { close?.(); reject(new Error(update.error || 'Job failed')) }
    })
    const poll = setInterval(async () => {
      const status = await getJobStatus(jobId)
      if (!status) return
      if (onProgress) onProgress(status.progress)
      if (status.status === 'completed') { clearInterval(poll); close?.(); resolve(status.result) }
      if (status.status === 'failed') { clearInterval(poll); close?.(); reject(new Error(status.error)) }
    }, 5000)
  })
}

export async function callLoopForge(videoUrl, onProgress) {
  const useMock = FORCE_MOCK || !(await checkServer())
  if (useMock) {
    if (onProgress) onProgress(50)
    await new Promise(r => setTimeout(r, 2000))
    if (onProgress) onProgress(100)
    return { videoUrl }
  }
  const { jobId } = await submitServerJob('loop', { videoUrl })
  return waitForJob(jobId, onProgress)
}

export async function callColorGrade(videoUrl, grade, onProgress) {
  const useMock = FORCE_MOCK || !(await checkServer())
  if (useMock) {
    if (onProgress) onProgress(50)
    await new Promise(r => setTimeout(r, 1500))
    if (onProgress) onProgress(100)
    return { videoUrl }
  }
  const { jobId } = await submitServerJob('grade', { videoUrl, grade })
  return waitForJob(jobId, onProgress)
}

export async function composeProject(clipUrls, outputName, onProgress) {
  const useMock = FORCE_MOCK || !(await checkServer())
  if (useMock) {
    if (onProgress) onProgress(50)
    await new Promise(r => setTimeout(r, 2000))
    if (onProgress) onProgress(100)
    return { videoUrl: clipUrls[0] }
  }
  const { jobId } = await submitServerJob('compose', { clipUrls, outputName })
  return waitForJob(jobId, onProgress)
}

export async function callExtend(clip, onProgress) {
  const useMock = FORCE_MOCK || !(await checkServer())
  if (useMock) {
    if (onProgress) onProgress(30)
    const result = await runMockJob({ ...clip, mode: 'image-to-video' }, onProgress)
    return result
  }
  const { jobId } = await submitServerJob('extend', {
    videoUrl: clip.result?.videoUrl,
    model: clip.model,
    prompt: clip.prompt,
    duration: clip.duration,
    aspectRatio: clip.aspectRatio
  })
  return waitForJob(jobId, onProgress)
}

export async function uploadSourceVideo(file) {
  const useMock = FORCE_MOCK || !(await checkServer())
  if (useMock) return URL.createObjectURL(file)

  const form = new FormData()
  form.append('video', file, file.name)
  const res = await fetch('/api/video/upload-video', { method: 'POST', body: form })
  if (!res.ok) throw new Error('Video upload failed')
  const { url } = await res.json()
  return url
}

function getMockShotPlan(description) {
  const lower = (description || '').toLowerCase()
  const isPerson = /person|people|man|woman|character/.test(lower)
  const isLandscape = /mountain|ocean|forest|city|landscape|nature/.test(lower)
  const isProduct = /product|item|object|thing/.test(lower)

  if (isPerson) {
    return [
      { shot: 'Establishing Wide', prompt: `${description}, wide establishing shot, cinematic lighting`, cameraRig: 'dolly-push-in', duration: 5, model: 'runway-gen3-turbo', notes: 'Sets the scene and context' },
      { shot: 'Medium Shot', prompt: `${description}, medium shot, eye level, natural depth of field`, cameraRig: 'steadicam-walk', duration: 5, model: 'kling-v2', notes: 'Shows character in context' },
      { shot: 'Close-Up', prompt: `${description}, extreme close up, shallow depth of field, bokeh`, cameraRig: 'static', duration: 3, model: 'runway-gen3-turbo', notes: 'Emotional connection' },
      { shot: 'Detail Insert', prompt: `${description}, macro detail shot, cinematic color grade`, cameraRig: 'rack-focus', duration: 3, model: 'runway-gen3-turbo', notes: 'Adds visual interest' }
    ]
  }
  if (isLandscape) {
    return [
      { shot: 'Aerial Establishing', prompt: `${description}, aerial drone shot, golden hour, sweeping vista`, cameraRig: 'drone-establishing', duration: 10, model: 'luma-dream-machine', notes: 'Grand establishing shot' },
      { shot: 'Horizontal Pan', prompt: `${description}, slow horizontal pan, wide angle lens`, cameraRig: 'orbital', duration: 5, model: 'luma-dream-machine', notes: 'Reveals the environment' },
      { shot: 'Ground Level Detail', prompt: `${description}, ground level perspective, foreground elements`, cameraRig: 'dolly-push-in', duration: 5, model: 'runway-gen3-turbo', notes: 'Intimate scale shift' },
      { shot: 'Sky Reveal', prompt: `${description}, slow tilt up to sky, dramatic clouds`, cameraRig: 'tilt-reveal', duration: 5, model: 'runway-gen3-turbo', notes: 'Cinematic closure' }
    ]
  }
  return [
    { shot: 'Hero Reveal', prompt: `${description}, hero shot, dramatic lighting, slow push in`, cameraRig: 'dolly-push-in', duration: 5, model: 'runway-gen3-turbo', notes: 'Initial impression' },
    { shot: 'Showcase Orbital', prompt: `${description}, orbital 360 rotation, studio lighting`, cameraRig: 'orbital', duration: 5, model: 'luma-dream-machine', notes: 'Full view reveal' },
    { shot: 'Macro Detail', prompt: `${description}, extreme close up macro, texture emphasis`, cameraRig: 'rack-focus', duration: 3, model: 'runway-gen3-turbo', notes: 'Detail and quality' },
    { shot: 'Context Shot', prompt: `${description}, lifestyle context, natural environment`, cameraRig: 'steadicam-walk', duration: 5, model: 'runway-gen3-turbo', notes: 'Real-world application' }
  ]
}
