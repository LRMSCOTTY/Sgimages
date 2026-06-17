import { describe, it, expect } from 'vitest'
import {
  defaultAdjustments,
  isIdentityAdjustment,
  normalizeAdjustments,
  adjustmentsToFilter
} from '../adjustments.js'

describe('adjustments', () => {
  it('defaults are identity', () => {
    expect(isIdentityAdjustment(defaultAdjustments)).toBe(true)
  })

  it('detects non-identity', () => {
    expect(isIdentityAdjustment({ ...defaultAdjustments, brightness: 120 })).toBe(false)
  })

  it('normalize clamps out-of-range values', () => {
    const n = normalizeAdjustments({ brightness: 9999, blur: -10, invert: 50 })
    expect(n.brightness).toBe(400)
    expect(n.blur).toBe(0)
    expect(n.invert).toBe(50)
  })

  it('normalize fills missing fields with defaults', () => {
    const n = normalizeAdjustments({})
    expect(n).toEqual(defaultAdjustments)
  })

  it('normalize coerces non-finite to default', () => {
    const n = normalizeAdjustments({ contrast: NaN, saturate: 'oops' })
    expect(n.contrast).toBe(defaultAdjustments.contrast)
    expect(n.saturate).toBe(defaultAdjustments.saturate)
  })

  it('filter string is built from normalized values', () => {
    const f = adjustmentsToFilter(defaultAdjustments)
    expect(f).toContain('brightness(100%)')
    expect(f).toContain('hue-rotate(0deg)')
    expect(f).toContain('blur(0px)')
  })

  it('preview and bake share one filter string (no divergence)', () => {
    const params = { ...defaultAdjustments, contrast: 130, hue: 45 }
    // Same function used for element.style.filter and ctx.filter.
    expect(adjustmentsToFilter(params)).toBe(adjustmentsToFilter(params))
    expect(adjustmentsToFilter(params)).toContain('contrast(130%)')
  })
})
