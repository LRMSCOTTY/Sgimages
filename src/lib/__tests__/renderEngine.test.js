import { describe, it, expect, beforeEach } from 'vitest'
import { renderDocument } from '../renderEngine.js'
import {
  __resetOpIds,
  makeGeneratedSource,
  makeUploadedSource,
  makeRotateOp,
  makeAdjustOp,
  toggleOp
} from '../recipe.js'

// A minimal canvas/2d-context mock that records the calls we assert on. It lets
// us verify the render *orchestration* (dimensions, op order, skipping disabled
// ops) without a real canvas, which Node/jsdom doesn't provide.
function makeMockEnv() {
  const filters = []
  function makeCtx(canvas) {
    return {
      canvas,
      set filter(v) {
        filters.push(v)
      },
      drawImage() {},
      translate() {},
      rotate() {},
      scale() {},
      save() {},
      restore() {},
      beginPath() {},
      arc() {},
      fill() {},
      fillRect() {},
      fillText() {},
      set font(_) {},
      set textBaseline(_) {},
      set shadowColor(_) {},
      set shadowBlur(_) {},
      set fillStyle(_) {},
      set globalAlpha(_) {},
      set globalCompositeOperation(_) {},
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData() {}
    }
  }
  const env = {
    filters,
    createCanvas(width, height) {
      const canvas = { width, height }
      canvas.getContext = () => makeCtx(canvas)
      return canvas
    },
    async decodeSource(source) {
      return { drawable: { src: source.dataURL }, width: 320, height: 240 }
    }
  }
  return env
}

beforeEach(() => __resetOpIds())

describe('renderEngine orchestration', () => {
  it('generated source yields a canvas at the requested size', async () => {
    const env = makeMockEnv()
    const doc = { source: makeGeneratedSource('hi', { width: 256, height: 128 }), ops: [] }
    const canvas = await renderDocument(doc, env)
    expect(canvas.width).toBe(256)
    expect(canvas.height).toBe(128)
  })

  it('uploaded source uses decodeSource dimensions', async () => {
    const env = makeMockEnv()
    const doc = { source: makeUploadedSource('data:abc'), ops: [] }
    const canvas = await renderDocument(doc, env)
    expect(canvas.width).toBe(320)
    expect(canvas.height).toBe(240)
  })

  it('a 90° rotate swaps width and height', async () => {
    const env = makeMockEnv()
    const doc = {
      source: makeGeneratedSource('x', { width: 400, height: 300 }),
      ops: [makeRotateOp(90)]
    }
    const canvas = await renderDocument(doc, env)
    expect(canvas.width).toBe(300)
    expect(canvas.height).toBe(400)
  })

  it('disabled ops are skipped', async () => {
    const env = makeMockEnv()
    const rot = makeRotateOp(90)
    const ops = toggleOp([rot], rot.id) // disabled
    const doc = { source: makeGeneratedSource('x', { width: 400, height: 300 }), ops }
    const canvas = await renderDocument(doc, env)
    // rotate skipped → dimensions unchanged
    expect(canvas.width).toBe(400)
    expect(canvas.height).toBe(300)
  })

  it('adjust op applies a CSS filter during render', async () => {
    const env = makeMockEnv()
    const doc = {
      source: makeGeneratedSource('x', { width: 64, height: 64 }),
      ops: [makeAdjustOp({ contrast: 150 })]
    }
    await renderDocument(doc, env)
    expect(env.filters.some((f) => f.includes('contrast(150%)'))).toBe(true)
  })

  it('consecutive adjust ops are collapsed (one filter pass)', async () => {
    const env = makeMockEnv()
    const doc = {
      source: makeGeneratedSource('x', { width: 64, height: 64 }),
      ops: [makeAdjustOp({ brightness: 110 }), makeAdjustOp({ brightness: 140 })]
    }
    await renderDocument(doc, env)
    const adjustFilters = env.filters.filter((f) => f.includes('brightness'))
    expect(adjustFilters).toHaveLength(1)
    expect(adjustFilters[0]).toContain('brightness(140%)')
  })
})
