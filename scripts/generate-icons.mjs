import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dir, '../public')

// CRC32 lookup table
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  crcTable[n] = c
}
function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crcBuf])
}

// Create a PNG with a radial gradient: indigo (#6366f1) → purple (#8b5cf6) center
function createPNG(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2  // 8-bit RGB

  const cx = size / 2, cy = size / 2
  const maxDist = Math.sqrt(cx * cx + cy * cy)
  const rowSize = 1 + size * 3
  const raw = Buffer.alloc(size * rowSize)

  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0  // filter: None
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      const t = Math.min(dist / maxDist, 1)

      // indigo #6366f1 → purple #8b5cf6 (radial gradient: center=purple, edge=indigo)
      const r = Math.round(0x63 + (0x8b - 0x63) * (1 - t))
      const g = Math.round(0x66 + (0x5c - 0x66) * (1 - t))
      const b = Math.round(0xf1 + (0xf6 - 0xf1) * (1 - t))

      const off = y * rowSize + 1 + x * 3
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b
    }
  }

  // Add a centered "play" triangle as a bright overlay
  const triSize = size * 0.28
  const triX = cx - triSize * 0.35
  const triTop = cy - triSize * 0.5
  const triBot = cy + triSize * 0.5

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dy = y - cy
      const progress = (y - triTop) / (triSize)
      if (progress >= 0 && progress <= 1) {
        const halfW = triSize * 0.5 * progress
        if (x >= triX && x <= triX + halfW * 1.8) {
          const off = y * rowSize + 1 + x * 3
          // White with slight transparency blending
          const blend = 0.92
          raw[off]   = Math.round(raw[off]   * (1 - blend) + 255 * blend)
          raw[off+1] = Math.round(raw[off+1] * (1 - blend) + 255 * blend)
          raw[off+2] = Math.round(raw[off+2] * (1 - blend) + 255 * blend)
        }
      }
    }
  }

  const compressed = deflateSync(raw)
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))])
}

mkdirSync(publicDir, { recursive: true })
writeFileSync(join(publicDir, 'icon-192.png'), createPNG(192))
writeFileSync(join(publicDir, 'icon-512.png'), createPNG(512))
writeFileSync(join(publicDir, 'apple-touch-icon.png'), createPNG(180))
console.log('✓ ProvidAI icons generated in public/')
