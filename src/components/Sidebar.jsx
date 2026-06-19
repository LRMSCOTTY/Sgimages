const IMAGE_TOOLS = [
  { id: 'generate', label: 'Generate', hint: 'Text → image', icon: '✨' },
  { id: 'adjust', label: 'Adjust', hint: 'Filters & transforms', icon: '🎛️' },
  { id: 'background', label: 'Background', hint: 'Remove background', icon: '✂️' },
  { id: 'generative', label: 'Reimagine', hint: 'Generative edit', icon: '🪄' }
]

export default function Sidebar({ tool, setTool }) {
  const isVideo = tool === 'video'

  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-mark">◆</span>
        <span className="brand-name">Sgimages</span>
      </div>

      <div className="sidebar-section-label">Image Studio</div>
      <ul className="tool-list">
        {IMAGE_TOOLS.map((t) => (
          <li key={t.id}>
            <button
              className={`tool-btn ${tool === t.id ? 'active' : ''}`}
              onClick={() => setTool(t.id)}
              title={t.hint}
            >
              <span className="tool-icon">{t.icon}</span>
              <span className="tool-text">
                <span className="tool-label">{t.label}</span>
                <span className="tool-hint">{t.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar-divider" />

      <div className="sidebar-section-label">Video Studio</div>
      <ul className="tool-list">
        <li>
          <button
            className={`tool-btn video-tool-btn ${isVideo ? 'active' : ''}`}
            onClick={() => setTool('video')}
            title="Professional AI video creator"
          >
            <span className="tool-icon">🎬</span>
            <span className="tool-text">
              <span className="tool-label">Video Studio</span>
              <span className="tool-hint">AI video creator</span>
            </span>
            {isVideo && <span className="sidebar-badge-live">LIVE</span>}
          </button>
        </li>
      </ul>

      <div className="sidebar-foot">
        <span className="badge">{isVideo ? 'Video Creator' : 'Mock AI'}</span>
        <p>{isVideo ? '6 AI providers · 5 unique features' : 'Runs fully in your browser.'}</p>
      </div>
    </nav>
  )
}
