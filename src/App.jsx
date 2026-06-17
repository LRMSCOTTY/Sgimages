import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Toolbar from './components/Toolbar.jsx'
import CanvasStage from './components/CanvasStage.jsx'
import EditStack from './components/EditStack.jsx'
import GeneratePanel from './components/GeneratePanel.jsx'
import AdjustPanel from './components/AdjustPanel.jsx'
import BackgroundPanel from './components/BackgroundPanel.jsx'
import GenerativeEditPanel from './components/GenerativeEditPanel.jsx'
import { RenderClient } from './lib/renderClient.js'
import { normalizeAdjustments } from './lib/adjustments.js'
import {
  initHistory,
  commit as histCommit,
  undo as histUndo,
  redo as histRedo,
  canUndo,
  canRedo
} from './lib/history.js'
import {
  makeGeneratedSource,
  makeUploadedSource,
  makeAdjustOp,
  makeRotateOp,
  makeFlipOp,
  makeRemoveBackgroundOp,
  makeGenerativeOp,
  addOp,
  removeOp,
  toggleOp,
  updateOpParams,
  moveOp,
  serializeDocument,
  OP_TYPES
} from './lib/recipe.js'

const docsEqual = (a, b) => serializeDocument(a) === serializeDocument(b)
const DRAFT_ID = '__draft_adjust__'

// Produce the document to render, folding in an uncommitted adjust draft so the
// preview goes through the exact same deterministic pipeline as the final render
// (no double-application, no preview/output divergence).
function applyDraft(doc, draft) {
  if (!doc || !draft) return doc
  const params = normalizeAdjustments(draft.params)
  if (draft.opId && doc.ops.some((o) => o.id === draft.opId)) {
    return { source: doc.source, ops: updateOpParams(doc.ops, draft.opId, params) }
  }
  const draftOp = { id: DRAFT_ID, type: OP_TYPES.adjust, enabled: true, params }
  return { source: doc.source, ops: addOp(doc.ops, draftOp) }
}

export default function App() {
  const clientRef = useRef(null)
  if (!clientRef.current) clientRef.current = new RenderClient()

  const [tool, setTool] = useState('generate')
  const [history, setHistory] = useState(() => initHistory(null))
  const [renderResult, setRenderResult] = useState(null)
  const [draft, setDraft] = useState(null) // { opId?, params } for live adjust
  const [selectedOpId, setSelectedOpId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')
  const [error, setError] = useState(null)

  const committedDoc = history.present
  const effectiveDoc = useMemo(() => applyDraft(committedDoc, draft), [committedDoc, draft])

  // Re-render whenever the effective document changes. The client runs the work
  // off-thread, drops superseded (stale) renders, and memoizes repeats.
  useEffect(() => {
    let cancelled = false
    if (!effectiveDoc) {
      setRenderResult(null)
      return
    }
    setBusy(true)
    clientRef.current
      .render(effectiveDoc)
      .then((res) => {
        if (cancelled || res.stale) return
        setRenderResult(res)
        setError(null)
        setBusy(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message || 'Render failed')
        setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [effectiveDoc])

  useEffect(() => () => clientRef.current?.dispose(), [])

  const commit = useCallback((nextDoc) => {
    setHistory((h) => histCommit(h, nextDoc, docsEqual))
    setDraft(null)
  }, [])

  const startDocument = useCallback(
    (source) => {
      commit({ source, ops: [] })
      setSelectedOpId(null)
    },
    [commit]
  )

  const pushOp = useCallback(
    (op) => {
      if (!committedDoc) return
      commit({ source: committedDoc.source, ops: addOp(committedDoc.ops, op) })
    },
    [committedDoc, commit]
  )

  const editor = useMemo(
    () => ({
      doc: committedDoc,
      busy,
      hasImage: !!committedDoc,
      selectedOpId,
      setSelectedOpId,

      generate: (prompt, size) => startDocument(makeGeneratedSource(prompt, size)),
      upload: (dataURL) => startDocument(makeUploadedSource(dataURL)),

      addRotate: (deg) => pushOp(makeRotateOp(deg)),
      addFlip: (axis) => pushOp(makeFlipOp(axis)),
      addRemoveBackground: (tol) => pushOp(makeRemoveBackgroundOp(tol)),
      addGenerative: (prompt) => pushOp(makeGenerativeOp(prompt)),

      // Live adjust preview (uncommitted).
      setAdjustDraft: (params, opId) => setDraft({ params, opId }),
      clearDraft: () => setDraft(null),

      // Commit the adjust: update the edited op or append a fresh one.
      commitAdjust: (params, opId) => {
        if (!committedDoc) return
        if (opId && committedDoc.ops.some((o) => o.id === opId)) {
          commit({ source: committedDoc.source, ops: updateOpParams(committedDoc.ops, opId, params) })
        } else {
          const op = makeAdjustOp(params)
          commit({ source: committedDoc.source, ops: addOp(committedDoc.ops, op) })
          setSelectedOpId(op.id)
        }
      },

      toggleOp: (id) =>
        committedDoc && commit({ source: committedDoc.source, ops: toggleOp(committedDoc.ops, id) }),
      removeOp: (id) => {
        if (!committedDoc) return
        commit({ source: committedDoc.source, ops: removeOp(committedDoc.ops, id) })
        if (id === selectedOpId) setSelectedOpId(null)
      },
      moveOp: (index, delta) =>
        committedDoc && commit({ source: committedDoc.source, ops: moveOp(committedDoc.ops, index, delta) })
    }),
    [committedDoc, busy, selectedOpId, commit, startDocument, pushOp]
  )

  const undo = useCallback(() => {
    setHistory((h) => histUndo(h))
    setDraft(null)
  }, [])
  const redo = useCallback(() => {
    setHistory((h) => histRedo(h))
    setDraft(null)
  }, [])
  const clear = useCallback(() => {
    setHistory(initHistory(null))
    setSelectedOpId(null)
    setDraft(null)
  }, [])

  const download = useCallback(async () => {
    if (!committedDoc) return
    setBusy(true)
    setBusyLabel('Exporting…')
    try {
      const blob = await clientRef.current.exportBlob(committedDoc)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sgimages-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }, [committedDoc])

  const panel = useMemo(() => {
    switch (tool) {
      case 'generate':
        return <GeneratePanel editor={editor} />
      case 'adjust':
        return <AdjustPanel editor={editor} />
      case 'background':
        return <BackgroundPanel editor={editor} />
      case 'generative':
        return <GenerativeEditPanel editor={editor} />
      default:
        return null
    }
  }, [tool, editor])

  return (
    <div className="app">
      <Sidebar tool={tool} setTool={setTool} usingWorker={clientRef.current.usingWorker} />
      <main className="workspace">
        <Toolbar
          canUndo={canUndo(history)}
          canRedo={canRedo(history)}
          canExport={!!committedDoc}
          onUndo={undo}
          onRedo={redo}
          onDownload={download}
          onClear={clear}
        />
        <div className="workspace-body">
          <div className="center-col">
            <CanvasStage render={renderResult} busy={busy} busyLabel={busyLabel} error={error} empty={!committedDoc} />
            {committedDoc && (
              <EditStack
                ops={committedDoc.ops}
                selectedOpId={selectedOpId}
                onSelect={setSelectedOpId}
                onToggle={editor.toggleOp}
                onRemove={editor.removeOp}
                onMove={editor.moveOp}
              />
            )}
          </div>
          <aside className="panel">{panel}</aside>
        </div>
      </main>
    </div>
  )
}
