import * as runway from './runway.js'
import * as luma from './luma.js'
import * as kling from './kling.js'
import * as replicate from './replicate.js'
import { downloadVideo, trimVideo, concatVideos, ensureStorageDir } from './ffmpeg.js'
import { promises as fs } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const STORAGE_DIR = process.env.STORAGE_DIR || './public/videos'

const NATIVE_DURATIONS = {
  'runway-gen3-turbo': [5, 10],
  'runway-gen3-alpha': [5, 10],
  'luma-dream-machine': [5, 9],
  'kling-v2': [5, 10],
  'hailuo-minimax': [6],
  'wan2.1': [5],
  'cogvideox': [6],
  'svd': [4]
}

function getNativeDuration(model, requestedDuration) {
  const native = NATIVE_DURATIONS[model] || [5]
  const sorted = [...native].sort((a, b) => b - a)
  // Use the longest native duration that fits within requested
  return sorted.find(d => d <= requestedDuration) || sorted[sorted.length - 1]
}

function segmentsNeeded(totalDuration, segmentDuration) {
  return Math.ceil(totalDuration / segmentDuration)
}

export async function generate(jobParams, progressCb) {
  const { model, mode, prompt, negativePrompt, sourceImageUrl, duration,
    aspectRatio, cameraRig, motionPath, promptKeyframes, loopMode } = jobParams

  // Compose the final prompt
  const finalPrompt = composePrompt(prompt, cameraRig, promptKeyframes, duration, negativePrompt)

  // Determine if we need to chain clips
  const nativeDur = getNativeDuration(model, duration)
  const needsChaining = duration > nativeDur

  let videoUrl

  if (!needsChaining) {
    videoUrl = await generateSingle(model, mode, finalPrompt, sourceImageUrl, nativeDur, aspectRatio, cameraRig, motionPath, progressCb)
  } else {
    // Generate multiple segments and chain them
    videoUrl = await generateChained(model, mode, finalPrompt, sourceImageUrl, duration, nativeDur, aspectRatio, cameraRig, motionPath, progressCb)
  }

  // Download to local storage
  await ensureStorageDir()
  const filename = `${uuidv4()}.mp4`
  const localPath = await downloadVideo(videoUrl, filename)

  // Trim to exact duration if needed
  let finalPath = localPath
  if (needsChaining) {
    finalPath = await trimVideo(localPath, 0, duration)
    await fs.unlink(localPath).catch(() => {})
  }

  const relPath = path.relative('.', finalPath)
  return {
    videoUrl: `/${relPath.replace(/\\/g, '/')}`,
    thumbnailUrl: null,
    durationSeconds: duration,
    model
  }
}

async function generateSingle(model, mode, prompt, imageUrl, dur, aspectRatio, cameraRig, motionPath, progressCb) {
  if (progressCb) progressCb(20)

  switch (model) {
    case 'runway-gen3-turbo':
    case 'runway-gen3-alpha':
      if (!process.env.RUNWAY_API_KEY) throw new Error('RUNWAY_API_KEY not configured')
      return mode === 'text-to-video'
        ? runway.generateTextToVideo({ prompt, duration: dur, aspectRatio })
        : runway.generateImageToVideo({ imageUrl, prompt, duration: dur, aspectRatio, cameraMotion: cameraRig })

    case 'luma-dream-machine':
      if (!process.env.LUMA_API_KEY) throw new Error('LUMA_API_KEY not configured')
      return mode === 'text-to-video'
        ? luma.generateTextToVideo({ prompt, duration: dur, aspectRatio, cameraMotion: cameraRig })
        : luma.generateImageToVideo({ imageUrl, prompt, duration: dur, aspectRatio, cameraMotion: cameraRig })

    case 'kling-v2':
      if (!process.env.KLING_API_KEY) throw new Error('KLING_API_KEY not configured')
      return mode === 'text-to-video'
        ? kling.generateTextToVideo({ prompt, duration: dur, aspectRatio })
        : kling.generateImageToVideo({ imageUrl, prompt, duration: dur })

    case 'wan2.1':
      if (!process.env.REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not configured')
      return replicate.generateImageToVideo({ imageUrl, prompt, model: 'wan2.1' }, progressCb)

    case 'cogvideox':
      if (!process.env.REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not configured')
      return replicate.generateTextToVideo({ prompt, model: 'cogvideox' }, progressCb)

    default:
      throw new Error(`Unknown model: ${model}`)
  }
}

async function generateChained(model, mode, prompt, imageUrl, totalDuration, nativeDur, aspectRatio, cameraRig, motionPath, progressCb) {
  const numSegments = segmentsNeeded(totalDuration, nativeDur)
  const segmentPaths = []

  for (let i = 0; i < numSegments; i++) {
    if (progressCb) progressCb(10 + Math.round((i / numSegments) * 70))
    const url = await generateSingle(model, mode, prompt, imageUrl, nativeDur, aspectRatio, cameraRig, motionPath, null)
    const localPath = await downloadVideo(url, `seg_${uuidv4()}.mp4`)
    segmentPaths.push(localPath)
    // For subsequent segments, use the last frame as the new image reference if possible
    imageUrl = null
    mode = 'text-to-video' // fall back to t2v for subsequent segments
  }

  const outPath = await concatVideos(segmentPaths, `chained_${uuidv4()}.mp4`)

  // Cleanup segments
  await Promise.all(segmentPaths.map(p => fs.unlink(p).catch(() => {})))

  return `/${path.relative('.', outPath).replace(/\\/g, '/')}`
}

function composePrompt(basePrompt, cameraRig, promptKeyframes, duration, negativePrompt) {
  let prompt = basePrompt

  if (cameraRig?.promptAppend) {
    prompt += `. ${cameraRig.promptAppend}`
  }

  if (promptKeyframes && promptKeyframes.length > 1) {
    const sorted = [...promptKeyframes].sort((a, b) => a.t - b.t)
    const keyframeDesc = sorted.map(kf => `at ${kf.t}%: ${kf.prompt}`).join('; ')
    prompt += `. Scene evolution: ${keyframeDesc}`
  }

  if (negativePrompt) {
    prompt += `. Avoid: ${negativePrompt}`
  }

  return prompt
}

export async function generateMultiAngle({ imageUrl, targetAngle }, progressCb) {
  if (!process.env.REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not configured')
  if (progressCb) progressCb(20)
  const url = await replicate.generateMultiAngle({ imageUrl, azimuth: targetAngle || 90 })
  if (progressCb) progressCb(90)

  await ensureStorageDir()
  const filename = `multiangle_${uuidv4()}.png`
  const localPath = await downloadVideo(url, filename)
  return {
    imageUrl: `/${path.relative('.', localPath).replace(/\\/g, '/')}`,
    angle: targetAngle || 90
  }
}
