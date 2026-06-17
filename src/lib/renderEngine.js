// Deterministic render of a document (source + ops) into a canvas.
//
// Environment-agnostic: the caller injects `createCanvas` and `decodeSource`
// so the identical pipeline runs inside a Web Worker (OffscreenCanvas) or on
// the main thread (HTMLCanvasElement) with no branching in the core logic.
// One render path = preview and export can never disagree.

import { adjustmentsToFilter } from './adjustments.js'
import { OP_TYPES, optimizeOps } from './recipe.js'
import {
  paintGeneration,
  paintGenerative,
  removeBackgroundInPlace
} from './generation.js'

/**
 * @param {object} doc           { source, ops }
 * @param {object} env
 * @param {(w:number,h:number)=>Canvas} env.createCanvas
 * @param {(source)=>Promise<{drawable,width,height}>} env.decodeSource
 * @returns {Promise<Canvas>} the rendered canvas
 */
export async function renderDocument(doc, env) {
  let canvas = await buildBase(doc.source, env)
  const ops = optimizeOps(doc.ops || []).filter((o) => o.enabled)

  for (const op of ops) {
    canvas = applyOp(canvas, op, env)
  }
  return canvas
}

async function buildBase(source, env) {
  if (source.kind === 'generated') {
    const canvas = env.createCanvas(source.width, source.height)
    const ctx = canvas.getContext('2d')
    paintGeneration(ctx, source.prompt, source.width, source.height)
    return canvas
  }
  // uploaded
  const { drawable, width, height } = await env.decodeSource(source)
  const canvas = env.createCanvas(width, height)
  canvas.getContext('2d').drawImage(drawable, 0, 0, width, height)
  return canvas
}

function applyOp(canvas, op, env) {
  switch (op.type) {
    case OP_TYPES.adjust:
      return applyAdjust(canvas, op.params, env)
    case OP_TYPES.rotate:
      return applyRotate(canvas, op.params.degrees, env)
    case OP_TYPES.flip:
      return applyFlip(canvas, op.params.axis, env)
    case OP_TYPES.removeBackground:
      removeBackgroundInPlace(canvas.getContext('2d'), canvas.width, canvas.height, op.params.tolerance)
      return canvas
    case OP_TYPES.generative:
      paintGenerative(canvas.getContext('2d'), op.params.prompt, canvas.width, canvas.height)
      return canvas
    default:
      return canvas
  }
}

function applyAdjust(canvas, params, env) {
  const out = env.createCanvas(canvas.width, canvas.height)
  const ctx = out.getContext('2d')
  ctx.filter = adjustmentsToFilter(params)
  ctx.drawImage(canvas, 0, 0)
  return out
}

function applyRotate(canvas, degrees, env) {
  const swap = Math.abs(degrees) % 180 === 90
  const out = env.createCanvas(swap ? canvas.height : canvas.width, swap ? canvas.width : canvas.height)
  const ctx = out.getContext('2d')
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((degrees * Math.PI) / 180)
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
  return out
}

function applyFlip(canvas, axis, env) {
  const out = env.createCanvas(canvas.width, canvas.height)
  const ctx = out.getContext('2d')
  ctx.translate(axis === 'h' ? out.width : 0, axis === 'v' ? out.height : 0)
  ctx.scale(axis === 'h' ? -1 : 1, axis === 'v' ? -1 : 1)
  ctx.drawImage(canvas, 0, 0)
  return out
}
