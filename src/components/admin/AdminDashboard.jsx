import { useState } from 'react'
import ClaudeChat from './ClaudeChat.jsx'
import AdminStats from './AdminStats.jsx'
import AppConfig from './AppConfig.jsx'

const TABS = [
  { id: 'claude', label: '◆ Claude AI', desc: 'AI assistant with full app context' },
  { id: 'stats', label: '📊 Stats', desc: 'Users, providers, uptime' },
  { id: 'config', label: '⚙️ Config', desc: 'App configuration' },
]

export default function AdminDashboard({ user, onClose }) {
  const [tab, setTab] = useState('claude')
  const [configRefresh, setConfigRefresh] = useState(0)

  const handleConfigChange = () => {
    if (tab === 'config') setConfigRefresh(n => n + 1)
  }

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div className="admin-brand">ProvidAI</div>
          <div className="admin-brand-sub">Admin Dashboard</div>
        </div>

        <nav className="admin-nav">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`admin-nav-item ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="admin-nav-label">{t.label}</span>
              <span className="admin-nav-desc">{t.desc}</span>
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-chip">
            <div className="admin-user-chip-avatar">
              {(user?.name || user?.email || 'A')[0].toUpperCase()}
            </div>
            <div>
              <div className="admin-user-chip-name">{user?.name || 'Admin'}</div>
              <div className="admin-user-chip-role">Administrator</div>
            </div>
          </div>
          <button className="admin-back-btn" onClick={onClose}>
            ← Back to App
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="admin-main">
        {tab === 'claude' && (
          <ClaudeChat onConfigChange={handleConfigChange} />
        )}
        {tab === 'stats' && <AdminStats />}
        {tab === 'config' && <AppConfig refreshTrigger={configRefresh} />}
      </div>
    </div>
  )
}
