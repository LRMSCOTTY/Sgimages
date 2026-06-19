import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import { promises as fs } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

ffmpeg.setFfmpegPath(ffmpegStatic)

const STORAGE_DIR = process.env.STORAGE_DIR || './public/videos'

function parseFraction(str) {
  if (!str) return 30
  const [num, den] = str.split('/').map(Number)
  return den ? num / den : num || 30
}

export async function ensureStorageDir() {
  await fs.mkdir(STORAGE_DIR, { recursive: true })
}

export async function downloadVideo(url, filename) {
  await ensureStorageDir()
  const outPath = path.join(STORAGE_DIR, filename || `${uuidv4()}.mp4`)

  // If it's a remote URL, fetch it
  if (url.startsWith('http')) {
    const { default: fetch } = await import('node-fetch')
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to download video: ${res.status}`)
    const buf = await res.arrayBuffer()
    await fs.writeFile(outPath, Buffer.from(buf))
    return outPath
  }

  return url // already a local path
}

export async function trimVideo(inputPath, startSec, durationSec) {
  const outPath = inputPath.replace(/\.\w+$/, `_trim_${uuidv4().slice(0, 8)}.mp4`)
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startSec)
      .setDuration(durationSec)
      .output(outPath)
      .on('end', () => resolve(outPath))
      .on('error', reject)
      .run()
  })
}

export async function concatVideos(inputPaths, outputFilename) {
  await ensureStorageDir()
  const outPath = path.join(STORAGE_DIR, outputFilename || `${uuidv4()}.mp4`)

  // Write concat manifest
  const listPath = path.join(STORAGE_DIR, `list_${uuidv4().slice(0,8)}.txt`)
  const listContent = inputPaths.map(p => `file '${path.resolve(p)}'`).join('\n')
  await fs.writeFile(listPath, listContent)

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy'])
      .output(outPath)
      .on('end', async () => {
        await fs.unlink(listPath).catch(() => {})
        resolve(outPath)
      })
      .on('error', async (err) => {
        await fs.unlink(listPath).catch(() => {})
        reject(err)
      })
      .run()
  })
}

const LUT_FILTERS = {
  'teal-orange': "curves=r='0/0 0.5/0.4 1/0.8':b='0/0 0.5/0.6 1/1',hue=s=1.2",
  'thriller': "eq=saturation=0.3:contrast=1.2",
  'warm-indie': "curves=r='0/0 1/1':g='0/0 1/0.9':b='0/0 1/0.8',eq=brightness=0.02",
  'bleach-bypass': "eq=saturation=0.5:contrast=1.3:brightness=-0.05",
  'cross-process': "curves=r='0/0 0.5/0.7 1/1':b='0/0.1 1/0.9',hue=s=1.4",
  'kodachrome': "curves=r='0/0.05 1/1':g='0/0 1/0.88':b='0/0 1/0.78',eq=contrast=1.1",
  'day-for-night': "curves=all='0/0 1/0.45',hue=s=0.3",
  'cyberpunk': "hue=s=1.9,curves=r='0/0 0.5/0.4':b='0/0.1 1/1',eq=contrast=1.25"
}

export async function createSeamlessLoop(inputPath, crossfadeSec = 0.5) {
  const outPath = inputPath.replace(/\.\w+$/, `_loop_${uuidv4().slice(0, 8)}.mp4`)
  const info = await getVideoInfo(inputPath)
  const dur = info.duration || 5
  const offset = Math.max(0.1, dur - crossfadeSec)

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .complexFilter([
        '[0:v]split=2[main][copy]',
        '[copy]reverse[rev]',
        `[main][rev]xfade=transition=fade:duration=${crossfadeSec}:offset=${offset}[out]`
      ])
      .outputOptions(['-map', '[out]', '-c:v', 'libx264', '-crf', '23'])
      .output(outPath)
      .on('end', () => resolve(outPath))
      .on('error', reject)
      .run()
  })
}

export async function applyColorGrade(inputPath, lutName) {
  const outPath = inputPath.replace(/\.\w+$/, `_graded_${uuidv4().slice(0, 8)}.mp4`)
  const filter = LUT_FILTERS[lutName]
  if (!filter) throw new Error(`Unknown grade: ${lutName}`)

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(filter)
      .output(outPath)
      .on('end', () => resolve(outPath))
      .on('error', reject)
      .run()
  })
}

export async function extractLastFrame(videoPath) {
  const outPath = videoPath.replace(/\.\w+$/, `_lastframe_${uuidv4().slice(0, 8)}.jpg`)
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .inputOptions(['-sseof', '-0.1'])
      .frames(1)
      .output(outPath)
      .on('end', () => resolve(outPath))
      .on('error', reject)
      .run()
  })
}

export async function extractFirstFrame(videoPath) {
  const outPath = videoPath.replace(/\.\w+$/, `_thumb_${uuidv4().slice(0, 8)}.jpg`)
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .frames(1)
      .output(outPath)
      .on('end', () => resolve(outPath))
      .on('error', reject)
      .run()
  })
}

export async function getVideoInfo(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err) return reject(err)
      const stream = meta.streams.find(s => s.codec_type === 'video')
      resolve({
        duration: meta.format.duration,
        width: stream?.width,
        height: stream?.height,
        fps: parseFraction(stream?.r_frame_rate) || 30
      })
    })
  })
}
