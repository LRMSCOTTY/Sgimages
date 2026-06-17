// Web Worker: runs the render pipeline on a background thread using
// OffscreenCanvas, so pixel-heavy work (generation, background removal,
// generative grading) never blocks scrolling, typing, or slider drags.
//
// Protocol:
//   main → worker: { id, doc }
//   worker → main: { id, ok, bitmap } | { id, ok:false, error }
// The result is an ImageBitmap, transferred (zero-copy) back to the main thread.

import { renderDocument } from '../lib/renderEngine.js'

const env = {
  createCanvas: (w, h) => new OffscreenCanvas(w, h),
  decodeSource: async (source) => {
    const res = await fetch(source.dataURL)
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    return { drawable: bitmap, width: bitmap.width, height: bitmap.height }
  }
}

self.onmessage = async (e) => {
  const { id, doc } = e.data
  try {
    const canvas = await renderDocument(doc, env)
    const bitmap = canvas.transferToImageBitmap()
    self.postMessage({ id, ok: true, bitmap }, [bitmap])
  } catch (error) {
    self.postMessage({ id, ok: false, error: error?.message || String(error) })
  }
}
