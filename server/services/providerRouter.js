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
  'ltx-video': [5],
  'hunyuanvideo': [5],
  'mochi-1': [5],
  'svd': [4]
}

const EFFECT_PROMPTS = {
  'shatter': 'exploding into cinematic debris and fragments with dramatic impact',
  'melt': 'melting and liquefying with surreal viscous flow',
  'inflate': 'inflating and expanding like a balloon, smooth and rounded',
  'deflate': 'deflating and collapsing inward, wrinkled and soft',
  'rain': 'with heavy cinematic rainfall, wet reflections on surfaces, dramatic atmosphere',
  'snow': 'with gentle snowfall, soft white flakes drifting, winter atmosphere',
  'fog': 'with thick atmospheric fog and mist rolling in, ethereal and moody',
  'wildfire-smoke': 'with billowing wildfire smoke, orange sky, ash particles',
  'lens-flare': 'with dramatic cinematic lens flare sweep across the frame',
  'bokeh-pull': 'with rack focus bokeh pull from blurred to sharp, shallow depth of field',
  'light-leak': 'with warm light leak and film grain overlay, vintage aesthetic',
  'dolly-zoom': 'with dramatic Vertigo dolly zoom effect, background warps as subject stays',
  'hyperlapse': 'in fast-motion hyperlapse, time accelerated, smooth motion blur',
  'reverse': 'playing in reverse, backwards motion creating surreal dreamlike effect',
  'slow-mo': 'in extreme cinematic slow motion at 240fps, every detail suspended in time',
  'strobe': 'with dramatic strobe flash effect, staccato rhythmic light pulses'
}

function getNativeDuration(model, requestedDuration) {
  const native = NATIVE_DURATIONS[model] || [5]
  const sorted = [...native].sort((a, b) => b - a)
  return sorted.find(d => d <= requestedDuration) || sorted[sorted.length - 1]
}

function segmentsNeeded(totalDuration, segmentDuration) {
  return Math.ceil(totalDuration / segmentDuration)
}

export async function generate(jobParams, progressCb) {
  const { model, mode, prompt, negativePrompt, sourceImageUrl, sourceImageEndUrl,
    duration, aspectRatio, cameraRig, motionPath, motionBrushRegions,
    promptKeyframes, loopMode, effects, referenceImages, soundDesign } = jobParams

  const finalPrompt = composePrompt(prompt, cameraRig, promptKeyframes, duration,
    negativePrompt, motionPath, motionBrushRegions, effects, referenceImages, soundDesign)

  const nativeDur = getNativeDuration(model, duration)
  const needsChaining = duration > nativeDur

  let videoUrl

  if (mode === 'keyframe') {
    videoUrl = await generateKeyframe(model, finalPrompt, sourceImageUrl, sourceImageEndUrl, aspectRatio, progressCb)
  } else if (!needsChaining) {
    videoUrl = await generateSingle(model, mode, finalPrompt, sourceImageUrl, nativeDur, aspectRatio, cameraRig, motionPath, progressCb)
  } else {
    videoUrl = await generateChained(model, mode, finalPrompt, sourceImageUrl, duration, nativeDur, aspectRatio, cameraRig, motionPath, progressCb)
  }

  await ensureStorageDir()
  const filename = `${uuidv4()}.mp4`
  const localPath = await downloadVideo(videoUrl, filename)

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

async function generateKeyframe(model, prompt, startImageUrl, endImageUrl, aspectRatio, progressCb) {
  if (progressCb) progressCb(20)
  if (!process.env.LUMA_API_KEY) throw new Error('LUMA_API_KEY not configured — keyframe mode requires Luma')
  return luma.generateKeyframeVideo({ startImageUrl, endImageUrl, prompt, aspectRatio })
}

async function generateSingle(model, mode, prompt, imageUrl, dur, aspectRatio, cameraRig, motionPath, progressCb) {
  if (progressCb) progressCb(20)

  switch (model) {
    case 'runway-gen3-turbo':
    case 'runway-gen3-alpha':
      if (!process.env.RUNWAY_API_KEY) throw new Error('RUNWAY_API_KEY not configured')
      return mode === 'text-to-video'
        ? runway.generateTextToVideo({ prompt, duration: dur, aspectRatio, motionPath })
        : runway.generateImageToVideo({ imageUrl, prompt, duration: dur, aspectRatio, cameraMotion: cameraRig, motionPath })

    case 'luma-dream-machine':
      if (!process.env.LUMA_API_KEY) throw new Error('LUMA_API_KEY not configured')
      return mode === 'text-to-video'
        ? luma.generateTextToVideo({ prompt, duration: dur, aspectRatio, cameraMotion: cameraRig, motionPath })
        : luma.generateImageToVideo({ imageUrl, prompt, duration: dur, aspectRatio, cameraMotion: cameraRig, motionPath })

    case 'kling-v2':
      if (!process.env.KLING_API_KEY) throw new Error('KLING_API_KEY not configured')
      return mode === 'text-to-video'
        ? kling.generateTextToVideo({ prompt, duration: dur, aspectRatio, motionPath })
        : kling.generateImageToVideo({ imageUrl, prompt, duration: dur, motionPath })

    case 'wan2.1':
      if (!process.env.REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not configured')
      return replicate.generateImageToVideo({ imageUrl, prompt, model: 'wan2.1', dur, aspectRatio }, progressCb)

    case 'cogvideox':
      if (!process.env.REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not configured')
      return replicate.generateTextToVideo({ prompt, model: 'cogvideox', duration: dur, aspectRatio }, progressCb)

    case 'ltx-video':
      if (!process.env.REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not configured')
      return mode === 'image-to-video'
        ? replicate.generateImageToVideo({ imageUrl, prompt, model: 'ltx-video', duration: dur, aspectRatio }, progressCb)
        : replicate.generateTextToVideo({ prompt, model: 'ltx-video', duration: dur, aspectRatio }, progressCb)

    case 'hunyuanvideo':
      if (!process.env.REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not configured')
      return replicate.generateTextToVideo({ prompt, model: 'hunyuanvideo', duration: dur, aspectRatio }, progressCb)

    case 'mochi-1':
      if (!process.env.REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not configured')
      return replicate.generateTextToVideo({ prompt, model: 'mochi-1', duration: dur, aspectRatio }, progressCb)

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
    imageUrl = null
    mode = 'text-to-video'
  }

  const outPath = await concatVideos(segmentPaths, `chained_${uuidv4()}.mp4`)
  await Promise.all(segmentPaths.map(p => fs.unlink(p).catch(() => {})))
  return `/${path.relative('.', outPath).replace(/\\/g, '/')}`
}

function composePrompt(basePrompt, cameraRig, promptKeyframes, duration, negativePrompt,
  motionPath, motionBrushRegions, effects, referenceImages, soundDesign) {
  let prompt = basePrompt

  if (cameraRig?.promptAppend) {
    prompt += `. ${cameraRig.promptAppend}`
  }

  if (motionPath?.directionString) {
    prompt += `. Camera motion: ${motionPath.directionString}`
  }

  if (motionBrushRegions?.length) {
    const regionDesc = motionBrushRegions
      .map(r => `the ${r.region || 'area'} moves ${r.direction}`)
      .join(', ')
    prompt += `. Motion: ${regionDesc}`
  }

  if (promptKeyframes && promptKeyframes.length > 1) {
    const sorted = [...promptKeyframes].sort((a, b) => a.t - b.t)
    const keyframeDesc = sorted.map(kf => `at ${kf.t}%: ${kf.prompt}`).join('; ')
    prompt += `. Scene evolution: ${keyframeDesc}`
  }

  if (effects?.length) {
    const effectStrs = effects.map(id => EFFECT_PROMPTS[id]).filter(Boolean)
    if (effectStrs.length) prompt += `. Visual effects: ${effectStrs.join('; ')}`
  }

  if (referenceImages?.length) {
    const refs = referenceImages.map(r => `${r.tag || 'reference'}: ${r.label || 'image'}`).join(', ')
    prompt += `. Maintain visual consistency with ${refs}`
  }

  if (soundDesign?.mood && soundDesign.mood !== 'silence') {
    prompt += `, accompanied by ${soundDesign.mood.replace(/-/g, ' ')} music`
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
