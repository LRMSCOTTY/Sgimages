import { useCallback, useMemo, useState, useEffect } from 'react'
import { useAuthStore } from './store/authStore.js'
import { getMe } from './lib/authAPI.js'
import LandingPage from './components/LandingPage.jsx'
import AuthPage from './components/auth/AuthPage.jsx'
import Sidebar from './components/Sidebar.jsx'
import Toolbar from './components/Toolbar.jsx'
import CanvasStage from './components/CanvasStage.jsx'
import GeneratePanel from './components/GeneratePanel.jsx'
import AdjustPanel from './components/AdjustPanel.jsx'
import BackgroundPanel from './components/BackgroundPanel.jsx'
import GenerativeEditPanel from './components/GenerativeEditPanel.jsx'
import VideoStudio from './components/video/VideoStudio.jsx'
import AdminDashboard from './components/admin/AdminDashboard.jsx'
import { downloadDataURL } from './lib/imageUtils.js'

const IMAGE_TOOLS = { generate: 'generate', adjust: 'adjust', background: 'background', generative: 'generative' }

export default function App() {
  const { user, token, setAuth, clearAuth, initialized, setInitialized } = useAuthStore()
  const [tool, setTool] = useState('generate')
  const [image, setImage] = useState(null)
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')
  const [error, setError] = useState(null)

  // Verify token on mount
  useEffect(() => {
    if (!token) { setInitialized(); return }
    getMe().then(user => {
      if (user) setAuth(token, user)
      else clearAuth()
    })
  }, [])

  const isVideoMode = tool === 'video'
  const isAdminMode = tool === 'admin'

  const commit = useCallback((next) => {
    setPast((p) => (image ? [...p, image] : p))
    setFuture([])
    setImage(next)
    setError(null)
  }, [image])

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

  const runTask = useCallback(async (label, fn) => {
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
  }, [commit])

  const handleDownload = useCallback(() => {
    if (image) downloadDataURL(image, `providai-${Date.now()}.png`)
  }, [image])

  const handleClear = useCallback(() => {
    setPast([])
    setFuture([])
    setImage(null)
    setError(null)
  }, [])

  const imagePanel = useMemo(() => {
    if (isVideoMode || isAdminMode) return null
    const shared = { image, runTask, busy, setImage: commit }
    switch (tool) {
      case IMAGE_TOOLS.generate: return <GeneratePanel {...shared} />
      case IMAGE_TOOLS.adjust: return <AdjustPanel {...shared} />
      case IMAGE_TOOLS.background: return <BackgroundPanel {...shared} />
      case IMAGE_TOOLS.generative: return <GenerativeEditPanel {...shared} />
      default: return null
    }
  }, [tool, image, runTask, busy, commit, isVideoMode])

  // Loading spinner while verifying token
  if (!initialized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d0d0d' }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    )
  }

  // Not logged in — show landing page (which contains AuthPage)
  if (!user) {
    return <LandingPage />
  }

  // Logged in — show the full app
  if (isAdminMode) {
    return (
      <AdminDashboard user={user} onClose={() => setTool('generate')} />
    )
  }

  return (
    <div className="app">
      <Sidebar tool={tool} setTool={setTool} user={user} onLogout={clearAuth} />
      {isVideoMode ? (
        <main className="workspace video-workspace">
          <VideoStudio sourceImage={image} />
        </main>
      ) : (
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
            <aside className="panel">{imagePanel}</aside>
          </div>
        </main>
      )}
    </div>
  )
}
