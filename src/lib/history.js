// Pure undo/redo over document states. Because a document is just
// { source, ops } (tiny JSON), keeping a deep history is cheap — unlike the
// common approach of snapshotting full-resolution images, which blows up
// memory after a handful of edits.
//
// State shape: { past: Doc[], present: Doc | null, future: Doc[] }

export const HISTORY_LIMIT = 100

export function initHistory(present = null) {
  return { past: [], present, future: [] }
}

export function canUndo(state) {
  return state.past.length > 0
}

export function canRedo(state) {
  return state.future.length > 0
}

/**
 * Commit a new present. The previous present is pushed onto `past` and the
 * redo stack is cleared. No-ops (identical document) are ignored so history
 * doesn't fill with duplicates.
 */
export function commit(state, nextDoc, areEqual = referenceEqual) {
  if (state.present && areEqual(state.present, nextDoc)) {
    return state
  }
  const past = state.present ? [...state.past, state.present] : state.past
  const trimmed = past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past
  return { past: trimmed, present: nextDoc, future: [] }
}

export function undo(state) {
  if (!canUndo(state)) return state
  const previous = state.past[state.past.length - 1]
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: state.present ? [state.present, ...state.future] : state.future
  }
}

export function redo(state) {
  if (!canRedo(state)) return state
  const next = state.future[0]
  return {
    past: state.present ? [...state.past, state.present] : state.past,
    present: next,
    future: state.future.slice(1)
  }
}

export function reset(present = null) {
  return initHistory(present)
}

function referenceEqual(a, b) {
  return a === b
}
