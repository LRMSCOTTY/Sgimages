import express from 'express'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { createJob, getJob, getAllJobs, cancelJob, enqueueJob, subscribeJob } from '../services/queue.js'
import { generate, generateMultiAngle } from '../services/providerRouter.js'
import { downloadVideo, concatVideos, applyColorGrade, createSeamlessLoop, extractLastFrame } from '../services/ffmpeg.js'
import { handleUpload, handleVideoUpload } from '../middleware/upload.js'

const router = express.Router()

// POST /api/video/generate
router.post('/generate', async (req, res) => {
  const { model, mode, prompt, negativePrompt, sourceImageUrl, sourceImageEndUrl, duration,
    aspectRatio, cameraRig, motionPath, motionBrushRegions, promptKeyframes, loopMode,
    effects, referenceImages, soundDesign, battleId } = req.body

  if (!prompt && mode === 'text-to-video') {
    return res.status(400).json({ error: 'prompt required for text-to-video' })
  }
  if (!sourceImageUrl && mode === 'image-to-video') {
    return res.status(400).json({ error: 'sourceImageUrl required for image-to-video' })
  }

  const validDurations = [3, 5, 10, 15, 25, 30]
  if (!validDurations.includes(duration)) {
    return res.status(400).json({ error: `duration must be one of ${validDurations.join(', ')}` })
  }

  const jobId = createJob({ model, mode, prompt, negativePrompt, sourceImageUrl, sourceImageEndUrl,
    duration, aspectRatio, cameraRig, motionPath, motionBrushRegions, promptKeyframes, loopMode,
    effects, referenceImages, soundDesign, battleId })

  enqueueJob(jobId, async (jid, progressCb) => {
    if (mode === 'multi-angle') {
      return generateMultiAngle({ imageUrl: sourceImageUrl, targetAngle: req.body.targetAngle }, progressCb)
    }
    return generate({ model, mode, prompt, negativePrompt, sourceImageUrl, sourceImageEndUrl,
      duration, aspectRatio, cameraRig, motionPath, motionBrushRegions, promptKeyframes, loopMode,
      effects, referenceImages, soundDesign }, progressCb)
  })

  const avgSeconds = { 'runway-gen3-turbo': 40, 'runway-gen3-alpha': 70,
    'luma-dream-machine': 60, 'kling-v2': 120, 'wan2.1': 180, 'cogvideox': 90 }

  res.status(202).json({
    jobId,
    status: 'queued',
    estimatedSeconds: avgSeconds[model] || 60,
    model
  })
})

// POST /api/video/multi-model — triggers battle across multiple models
router.post('/multi-model', async (req, res) => {
  const { models, ...rest } = req.body
  const battleId = `battle_${Date.now()}`

  const jobs = (models || ['runway-gen3-turbo', 'luma-dream-machine', 'kling-v2']).map(model => {
    const jobId = createJob({ ...rest, model, battleId })
    enqueueJob(jobId, (jid, progressCb) =>
      generate({ ...rest, model }, progressCb)
    )
    return { model, jobId }
  })

  res.status(202).json({ battleId, jobs })
})

// GET /api/video/jobs
router.get('/jobs', (req, res) => {
  res.json(getAllJobs())
})

// GET /api/video/jobs/:id
router.get('/jobs/:id', (req, res) => {
  const job = getJob(req.params.id)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json(job)
})

// GET /api/video/jobs/:id/stream  — SSE for real-time updates
router.get('/jobs/:id/stream', (req, res) => {
  const job = getJob(req.params.id)
  if (!job) return res.status(404).json({ error: 'Job not found' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  // Send current state immediately
  res.write(`data: ${JSON.stringify({ type: 'job_update', ...job })}\n\n`)

  // If already done, close immediately
  if (job.status === 'completed' || job.status === 'failed') {
    return res.end()
  }

  subscribeJob(req.params.id, res)
})

// DELETE /api/video/jobs/:id
router.delete('/jobs/:id', (req, res) => {
  const cancelled = cancelJob(req.params.id)
  if (!cancelled) return res.status(404).json({ error: 'Job not found or already completed' })
  res.json({ cancelled: true })
})

// POST /api/video/upload — upload source image
router.post('/upload', handleUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const url = `/public/videos/uploads/${req.file.filename}`
  res.json({ url, filename: req.file.filename })
})

// POST /api/video/loop — create seamless loop from completed clip
router.post('/loop', async (req, res) => {
  const { videoUrl } = req.body
  if (!videoUrl) return res.status(400).json({ error: 'videoUrl required' })

  const jobId = createJob({ type: 'loop', videoUrl })
  enqueueJob(jobId, async () => {
    const filename = `dl_${uuidv4()}.mp4`
    const local = await downloadVideo(videoUrl.startsWith('http') ? videoUrl : `.${videoUrl}`, filename)
    const out = await createSeamlessLoop(local)
    return { videoUrl: `/${path.relative('.', out).replace(/\\/g, '/')}` }
  })
  res.status(202).json({ jobId })
})

// POST /api/video/grade — apply color grade to video
router.post('/grade', async (req, res) => {
  const { videoUrl, grade } = req.body
  if (!videoUrl || !grade) return res.status(400).json({ error: 'videoUrl and grade required' })

  const jobId = createJob({ type: 'grade', videoUrl, grade })
  enqueueJob(jobId, async () => {
    const filename = `dl_${uuidv4()}.mp4`
    const local = await downloadVideo(videoUrl.startsWith('http') ? videoUrl : `.${videoUrl}`, filename)
    const out = await applyColorGrade(local, grade)
    return { videoUrl: `/${path.relative('.', out).replace(/\\/g, '/')}` }
  })
  res.status(202).json({ jobId })
})

// POST /api/video/compose — concatenate multiple clips for final export
router.post('/compose', async (req, res) => {
  const { clipUrls, outputName } = req.body
  if (!clipUrls?.length) return res.status(400).json({ error: 'clipUrls array required' })

  const jobId = createJob({ type: 'compose', clipUrls })
  enqueueJob(jobId, async () => {
    const locals = await Promise.all(clipUrls.map((url, i) => {
      const filename = `compose_${i}_${uuidv4()}.mp4`
      return downloadVideo(url.startsWith('http') ? url : `.${url}`, filename)
    }))
    const outFile = outputName || `export_${uuidv4()}.mp4`
    const out = await concatVideos(locals, outFile)
    return { videoUrl: `/${path.relative('.', out).replace(/\\/g, '/')}` }
  })
  res.status(202).json({ jobId })
})

// POST /api/video/extend — extend a clip by generating from its last frame
router.post('/extend', async (req, res) => {
  const { videoUrl, model, prompt, duration = 5, aspectRatio = '16:9' } = req.body
  if (!videoUrl) return res.status(400).json({ error: 'videoUrl required' })

  const jobId = createJob({ type: 'extend', videoUrl })
  enqueueJob(jobId, async (jid, progressCb) => {
    const filename = `dl_${uuidv4()}.mp4`
    const local = await downloadVideo(videoUrl.startsWith('http') ? videoUrl : `.${videoUrl}`, filename)
    const lastFrame = await extractLastFrame(local)
    const lastFrameUrl = `/${path.relative('.', lastFrame).replace(/\\/g, '/')}`

    const result = await generate({
      model: model || 'runway-gen3-turbo',
      mode: 'image-to-video',
      prompt: prompt || 'Continue the scene naturally',
      sourceImageUrl: `http://localhost:${process.env.PORT || 3001}${lastFrameUrl}`,
      duration,
      aspectRatio
    }, progressCb)

    const extLocal = await downloadVideo(result.videoUrl.startsWith('http') ? result.videoUrl : `.${result.videoUrl}`, `ext_${uuidv4()}.mp4`)
    const merged = await concatVideos([local, extLocal], `extended_${uuidv4()}.mp4`)
    return { videoUrl: `/${path.relative('.', merged).replace(/\\/g, '/')}` }
  })
  res.status(202).json({ jobId })
})

// POST /api/video/upload-video — upload source video for remix
router.post('/upload-video', handleVideoUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const url = `/public/videos/uploads/${req.file.filename}`
  res.json({ url, filename: req.file.filename })
})

export default router
