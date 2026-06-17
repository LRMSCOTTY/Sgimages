import { describe, it, expect } from 'vitest'
import {
  initHistory,
  commit,
  undo,
  redo,
  canUndo,
  canRedo,
  HISTORY_LIMIT
} from '../history.js'

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

describe('history reducer', () => {
  it('starts empty', () => {
    const s = initHistory()
    expect(s.present).toBeNull()
    expect(canUndo(s)).toBe(false)
    expect(canRedo(s)).toBe(false)
  })

  it('commit advances present and enables undo', () => {
    let s = initHistory(null)
    s = commit(s, { v: 1 })
    expect(s.present).toEqual({ v: 1 })
    s = commit(s, { v: 2 })
    expect(s.present).toEqual({ v: 2 })
    expect(canUndo(s)).toBe(true)
  })

  it('undo/redo are inverses', () => {
    let s = initHistory(null)
    s = commit(s, { v: 1 })
    s = commit(s, { v: 2 })
    s = commit(s, { v: 3 })

    s = undo(s)
    expect(s.present).toEqual({ v: 2 })
    s = undo(s)
    expect(s.present).toEqual({ v: 1 })
    s = redo(s)
    expect(s.present).toEqual({ v: 2 })
    s = redo(s)
    expect(s.present).toEqual({ v: 3 })
    expect(canRedo(s)).toBe(false)
  })

  it('commit after undo clears the redo stack (branching)', () => {
    let s = initHistory(null)
    s = commit(s, { v: 1 })
    s = commit(s, { v: 2 })
    s = undo(s) // back to v1, redo→v2 available
    expect(canRedo(s)).toBe(true)
    s = commit(s, { v: 9 })
    expect(canRedo(s)).toBe(false)
    expect(s.present).toEqual({ v: 9 })
  })

  it('ignores no-op commits (equal documents)', () => {
    let s = initHistory(null)
    s = commit(s, { v: 1 }, eq)
    const before = s
    s = commit(s, { v: 1 }, eq)
    expect(s).toBe(before) // unchanged reference
    expect(canUndo(s)).toBe(false)
  })

  it('caps history at HISTORY_LIMIT', () => {
    let s = initHistory(null)
    for (let i = 0; i < HISTORY_LIMIT + 25; i++) {
      s = commit(s, { v: i })
    }
    expect(s.past.length).toBeLessThanOrEqual(HISTORY_LIMIT)
    expect(s.present).toEqual({ v: HISTORY_LIMIT + 24 })
  })

  it('undo/redo at the ends are safe no-ops', () => {
    let s = initHistory({ v: 0 })
    expect(undo(s)).toBe(s)
    expect(redo(s)).toBe(s)
  })
})
