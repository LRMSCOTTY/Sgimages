import { describe, it, expect, beforeEach } from 'vitest'
import {
  OP_TYPES,
  __resetOpIds,
  makeGeneratedSource,
  makeUploadedSource,
  makeAdjustOp,
  makeRotateOp,
  makeRemoveBackgroundOp,
  addOp,
  removeOp,
  toggleOp,
  updateOpParams,
  moveOp,
  optimizeOps,
  serializeDocument,
  deserializeDocument,
  recipeKey
} from '../recipe.js'

beforeEach(() => __resetOpIds())

describe('recipe model', () => {
  it('generated source stores params, not pixels', () => {
    const s = makeGeneratedSource('a cat', { width: 512, height: 512 })
    expect(s).toEqual({ kind: 'generated', prompt: 'a cat', width: 512, height: 512 })
    expect(s.dataURL).toBeUndefined()
  })

  it('op factories produce enabled ops with ids', () => {
    const op = makeAdjustOp({ brightness: 120 })
    expect(op.type).toBe(OP_TYPES.adjust)
    expect(op.enabled).toBe(true)
    expect(op.id).toMatch(/^op_/)
    expect(op.params.brightness).toBe(120)
  })

  it('add/remove/toggle/update are immutable', () => {
    const a = makeAdjustOp()
    let ops = addOp([], a)
    expect(ops).toHaveLength(1)

    const toggled = toggleOp(ops, a.id)
    expect(toggled[0].enabled).toBe(false)
    expect(ops[0].enabled).toBe(true) // original untouched

    const updated = updateOpParams(ops, a.id, { contrast: 150 })
    expect(updated[0].params.contrast).toBe(150)
    expect(ops[0].params.contrast).toBe(100)

    const removed = removeOp(ops, a.id)
    expect(removed).toHaveLength(0)
    expect(ops).toHaveLength(1)
  })

  it('moveOp reorders and respects bounds', () => {
    const a = makeRotateOp(90)
    const b = makeRemoveBackgroundOp()
    const ops = [a, b]
    expect(moveOp(ops, 0, 1)).toEqual([b, a])
    expect(moveOp(ops, 0, -1)).toBe(ops) // out of bounds → unchanged ref
    expect(moveOp(ops, 1, 1)).toBe(ops)
  })

  it('optimizeOps collapses consecutive enabled adjusts', () => {
    const a1 = makeAdjustOp({ brightness: 110 })
    const a2 = makeAdjustOp({ brightness: 130 })
    const rot = makeRotateOp(90)
    const a3 = makeAdjustOp({ contrast: 120 })
    const optimized = optimizeOps([a1, a2, rot, a3])
    // a1 collapses into a2; rot and a3 remain.
    expect(optimized).toHaveLength(3)
    expect(optimized[0]).toBe(a2)
    expect(optimized[1]).toBe(rot)
    expect(optimized[2]).toBe(a3)
  })

  it('optimizeOps does not collapse across a disabled adjust', () => {
    const a1 = makeAdjustOp({ brightness: 110 })
    const a2 = { ...makeAdjustOp({ brightness: 130 }), enabled: false }
    const a3 = makeAdjustOp({ brightness: 150 })
    expect(optimizeOps([a1, a2, a3])).toHaveLength(3)
  })

  it('serialize/deserialize round-trips', () => {
    const doc = { source: makeUploadedSource('data:abc'), ops: [makeAdjustOp(), makeRotateOp(90)] }
    const restored = deserializeDocument(serializeDocument(doc))
    expect(restored).toEqual(doc)
  })

  it('recipeKey is stable and ignores disabled ops', () => {
    const source = makeGeneratedSource('x')
    const a = makeAdjustOp({ brightness: 120 })
    const b = makeRotateOp(90)

    const k1 = recipeKey(source, [a, b])
    const k2 = recipeKey(source, [a, b])
    expect(k1).toBe(k2)

    const disabled = toggleOp([a, b], b.id)
    // disabling b changes the rendered output → different key
    expect(recipeKey(source, disabled)).not.toBe(k1)
    // and it equals the key of just [a]
    expect(recipeKey(source, disabled)).toBe(recipeKey(source, [a]))
  })

  it('recipeKey changes when params change', () => {
    const source = makeGeneratedSource('x')
    const a = makeAdjustOp({ brightness: 120 })
    const k1 = recipeKey(source, [a])
    const a2 = updateOpParams([a], a.id, { brightness: 121 })
    expect(recipeKey(source, a2)).not.toBe(k1)
  })
})
