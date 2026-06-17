import { describe, it, expect } from 'vitest'
import { hashString, makeRng, pick, clamp, clampByte } from '../seededRandom.js'

describe('seededRandom', () => {
  it('hashString is deterministic and unsigned', () => {
    expect(hashString('hello')).toBe(hashString('hello'))
    expect(hashString('hello')).toBeGreaterThanOrEqual(0)
    expect(hashString('a')).not.toBe(hashString('b'))
  })

  it('makeRng produces a reproducible sequence for a given seed', () => {
    const a = makeRng(42)
    const b = makeRng(42)
    const seqA = [a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })

  it('makeRng stays within [0, 1)', () => {
    const rng = makeRng(7)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('different seeds diverge', () => {
    const a = makeRng(1)()
    const b = makeRng(2)()
    expect(a).not.toBe(b)
  })

  it('pick is deterministic for a seeded rng', () => {
    const arr = ['x', 'y', 'z']
    expect(pick(makeRng(99), arr)).toBe(pick(makeRng(99), arr))
  })

  it('clamp and clampByte bound values', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(50, 0, 10)).toBe(10)
    expect(clampByte(-20)).toBe(0)
    expect(clampByte(300)).toBe(255)
    expect(clampByte(128)).toBe(128)
  })
})
