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

export async function createSeamlessLoop(inputPath) {
  const outPath = inputPath.replace(/\.\w+$/, `_loop_${uuidv4().slice(0, 8)}.mp4`)

  return new Promise((resolve, reject) => {
    // Crossfade last 10% of clip back to beginning for seamless loop
    ffmpeg(inputPath)
      .complexFilter([
        '[0:v]split=2[main][copy]',
        '[copy]reverse[rev]',
        `[main][rev]xfade=transition=fade:duration=0.5:offset=3.5[out]`
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
  const lutPath = `./server/assets/luts/${lutName}.cube`

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(`lut3d=${lutPath}`)
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
