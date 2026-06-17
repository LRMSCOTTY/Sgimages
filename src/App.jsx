import { useCallback, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Toolbar from './components/Toolbar.jsx'
import CanvasStage from './components/CanvasStage.jsx'
import GeneratePanel from './components/GeneratePanel.jsx'
import AdjustPanel from './components/AdjustPanel.jsx'
import BackgroundPanel from './components/BackgroundPanel.jsx'
import GenerativeEditPanel from './components/GenerativeEditPanel.jsx'
import { downloadDataURL } from './lib/imageUtils.js'

const TOOLS = {
  generate: 'generate',
  adjust: 'adjust',
  background: 'background',
  generative: 'generative'
}

export default function App() {
  const [tool, setTool] = useState(TOOLS.generate)
  const [image, setImage] = useState(null) // current dataURL or null
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')
  const [error, setError] = useState(null)

  // Commit a new image state, pushing the previous one onto the undo stack.
  const commit = useCallback(
    (next) => {
      setPast((p) => (image ? [...p, image] : p))
      setFuture([])
      setImage(next)
      setError(null)
    },
    [image]
  )

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p
      const previous = p[p.length - 1]
      setFuture((f) => (image ? [image, ...f] : f))
      setImage(previous)
      return p.slice(0, -1)
    })
  }, [image])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f
      const next = f[0]
      setPast((p) => (image ? [...p, image] : p))
      setImage(next)
      return f.slice(1)
    })
  }, [image])

  // Wraps an async AI/image task with busy + error handling.
  const runTask = useCallback(
    async (label, fn) => {
      setBusy(true)
      setBusyLabel(label)
      setError(null)
      try {
        const result = await fn()
        if (result) commit(result)
      } catch (e) {
        console.error(e)
        setError(e.message || 'Something went wrong')
      } finally {
        setBusy(false)
        setBusyLabel('')
      }
    },
    [commit]
  )

  const handleDownload = useCallback(() => {
    if (image) downloadDataURL(image, `sgimages-${Date.now()}.png`)
  }, [image])

  const handleClear = useCallback(() => {
    setPast([])
    setFuture([])
    setImage(null)
    setError(null)
  }, [])

  const panel = useMemo(() => {
    const shared = { image, runTask, busy, setImage: commit }
    switch (tool) {
      case TOOLS.generate:
        return <GeneratePanel {...shared} />
      case TOOLS.adjust:
        return <AdjustPanel {...shared} />
      case TOOLS.background:
        return <BackgroundPanel {...shared} />
      case TOOLS.generative:
        return <GenerativeEditPanel {...shared} />
      default:
        return null
    }
  }, [tool, image, runTask, busy, commit])

  return (
    <div className="app">
      <Sidebar tool={tool} setTool={setTool} />
      <main className="workspace">
        <Toolbar
          canUndo={past.length > 0}
          canRedo={future.length > 0}
          canExport={!!image}
          onUndo={undo}
          onRedo={redo}
          onDownload={handleDownload}
          onClear={handleClear}
        />
        <div className="workspace-body">
          <CanvasStage image={image} busy={busy} busyLabel={busyLabel} error={error} />
          <aside className="panel">{panel}</aside>
        </div>
      </main>
    </div>
  )
}
