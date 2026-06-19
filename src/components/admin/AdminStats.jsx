import { useEffect, useState } from 'react'
import { getAdminStats } from '../../lib/adminAPI.js'

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card" style={{ borderColor: color + '40' }}>
      <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function ProviderBadge({ name, active }) {
  return (
    <div className={`provider-badge ${active ? 'active' : 'inactive'}`}>
      <span className="provider-dot" />
      {name}
    </div>
  )
}

export default function AdminStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setStats(await getAdminStats())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="admin-loading"><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} /></div>
  if (error) return <div className="admin-error">Failed to load stats: {error}</div>

  const uptimeMin = Math.floor((stats?.uptime || 0) / 60)
  const uptimeH = Math.floor(uptimeMin / 60)
  const uptimeStr = uptimeH > 0 ? `${uptimeH}h ${uptimeMin % 60}m` : `${uptimeMin}m`

  return (
    <div className="admin-stats">
      <div className="admin-section-header">
        <h3>App Overview</h3>
        <button className="admin-refresh-btn" onClick={load}>↻ Refresh</button>
      </div>

      <div className="stat-cards">
        <StatCard label="Total Users" value={stats.users} color="#6366f1" />
        <StatCard label="Total Projects" value={stats.projects} color="#8b5cf6" />
        <StatCard label="Server Uptime" value={uptimeStr} color="#10b981" />
        <StatCard
          label="Database"
          value={stats.dbAvailable ? 'Connected' : 'Not configured'}
          color={stats.dbAvailable ? '#10b981' : '#f59e0b'}
          sub={stats.dbAvailable ? 'PostgreSQL' : 'Using dev mode'}
        />
      </div>

      <div className="admin-section-header" style={{ marginTop: 24 }}>
        <h3>AI Providers</h3>
      </div>
      <div className="provider-badges">
        <ProviderBadge name="Replicate (LTX-Video, HunyuanVideo, Mochi-1)" active={stats.providers?.replicate} />
        <ProviderBadge name="Runway Gen-3" active={stats.providers?.runway} />
        <ProviderBadge name="Luma Dream Machine" active={stats.providers?.luma} />
        <ProviderBadge name="Kling AI" active={stats.providers?.kling} />
        <ProviderBadge name="Anthropic (Claude Director + Admin)" active={stats.providers?.anthropic} />
      </div>
      {!Object.values(stats.providers || {}).some(Boolean) && (
        <div className="admin-notice">
          ⚠ No API keys configured — app is running in mock mode. Add <code>REPLICATE_API_TOKEN</code> to Railway variables to enable real video generation.
        </div>
      )}

      {stats.recentUsers?.length > 0 && (
        <>
          <div className="admin-section-header" style={{ marginTop: 24 }}>
            <h3>Recent Sign-ups</h3>
          </div>
          <div className="admin-user-list">
            {stats.recentUsers.map(u => (
              <div key={u.id} className="admin-user-row">
                <div className="admin-user-avatar">{(u.name || u.email)[0].toUpperCase()}</div>
                <div className="admin-user-info">
                  <div className="admin-user-name">{u.name || '(no name)'}</div>
                  <div className="admin-user-email">{u.email}</div>
                </div>
                <div className="admin-user-date">{new Date(u.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="admin-meta">
        Node {stats.nodeVersion} · {stats.env} mode
      </div>
    </div>
  )
}
