const TOOL_LIST = [
  { id: 'generate', label: 'Generate', hint: 'Text → image', icon: '✨' },
  { id: 'adjust', label: 'Adjust', hint: 'Filters & transforms', icon: '🎛️' },
  { id: 'background', label: 'Background', hint: 'Remove background', icon: '✂️' },
  { id: 'generative', label: 'Reimagine', hint: 'Generative edit', icon: '🪄' }
]

export default function Sidebar({ tool, setTool }) {
  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-mark">◆</span>
        <span className="brand-name">Sgimages</span>
      </div>
      <ul className="tool-list">
        {TOOL_LIST.map((t) => (
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
      <div className="sidebar-foot">
        <span className="badge">Mock AI</span>
        <p>Runs fully in your browser — no API key needed.</p>
      </div>
    </nav>
  )
}
