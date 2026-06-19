const IMAGE_TOOLS = [
  { id: 'generate', label: 'Generate', hint: 'Text → image', icon: '✨' },
  { id: 'adjust', label: 'Adjust', hint: 'Filters & transforms', icon: '🎛️' },
  { id: 'background', label: 'Background', hint: 'Remove background', icon: '✂️' },
  { id: 'generative', label: 'Reimagine', hint: 'Generative edit', icon: '🪄' }
]

export default function Sidebar({ tool, setTool, user, onLogout }) {
  const isVideo = tool === 'video'
  const isAdmin = tool === 'admin'

  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-mark">◆</span>
        <span className="brand-name">ProvidAI</span>
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

      {user?.is_admin && (
        <>
          <div className="sidebar-divider" />
          <div className="sidebar-section-label">Administration</div>
          <ul className="tool-list">
            <li>
              <button
                className={`tool-btn admin-tool-btn ${isAdmin ? 'active' : ''}`}
                onClick={() => setTool('admin')}
                title="Admin dashboard with Claude AI"
              >
                <span className="tool-icon">◆</span>
                <span className="tool-text">
                  <span className="tool-label">Admin</span>
                  <span className="tool-hint">Claude AI · Config · Users</span>
                </span>
              </button>
            </li>
          </ul>
        </>
      )}

      <div className="sidebar-foot">
        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {(user.name || user.email || 'U')[0].toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.name || user.email}</div>
              {user.is_admin && <div className="sidebar-user-role">Admin</div>}
            </div>
            <button className="sidebar-logout" onClick={onLogout} title="Sign out">↩</button>
          </div>
        )}
        <span className="badge">{isVideo ? 'Video Creator' : isAdmin ? 'Admin' : 'Mock AI'}</span>
        <p>{isVideo ? '6 AI providers · 5 unique features' : isAdmin ? 'Claude AI assistant' : 'Runs fully in your browser.'}</p>
      </div>
    </nav>
  )
}
