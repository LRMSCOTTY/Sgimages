// Canvas-based image helpers. All operations are real, client-side transforms.

/** Load an image source (dataURL / objectURL) into an HTMLImageElement. */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/** Read a File (from an <input>) into a dataURL string. */
export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Build a CSS/Canvas filter string from an adjustments object.
 * Values are designed so that the defaults in `defaultAdjustments` are no-ops.
 */
export function adjustmentsToFilter(a) {
  return [
    `brightness(${a.brightness}%)`,
    `contrast(${a.contrast}%)`,
    `saturate(${a.saturate}%)`,
    `grayscale(${a.grayscale}%)`,
    `sepia(${a.sepia}%)`,
    `hue-rotate(${a.hue}deg)`,
    `blur(${a.blur}px)`,
    `invert(${a.invert}%)`
  ].join(' ')
}

export const defaultAdjustments = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  grayscale: 0,
  sepia: 0,
  hue: 0,
  blur: 0,
  invert: 0
}

/** Apply adjustments to a source image and return a new dataURL. */
export async function applyAdjustments(src, adjustments) {
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.filter = adjustmentsToFilter(adjustments)
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/png')
}

/** Rotate an image by 90° increments. */
export async function rotate(src, degrees) {
  const img = await loadImage(src)
  const rad = (degrees * Math.PI) / 180
  const swap = Math.abs(degrees) % 180 === 90
  const canvas = document.createElement('canvas')
  canvas.width = swap ? img.naturalHeight : img.naturalWidth
  canvas.height = swap ? img.naturalWidth : img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(rad)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
  return canvas.toDataURL('image/png')
}

/** Flip an image horizontally or vertically. */
export async function flip(src, axis /* 'h' | 'v' */) {
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.translate(axis === 'h' ? canvas.width : 0, axis === 'v' ? canvas.height : 0)
  ctx.scale(axis === 'h' ? -1 : 1, axis === 'v' ? -1 : 1)
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/png')
}

/** Trigger a browser download of a dataURL. */
export function downloadDataURL(dataURL, filename = 'sgimages-export.png') {
  const link = document.createElement('a')
  link.href = dataURL
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
